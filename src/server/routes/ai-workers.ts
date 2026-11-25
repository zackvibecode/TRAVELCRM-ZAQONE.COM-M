import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";
import { isPdf } from "../lib/pdf-extract";
import { runPackageEnrichment } from "../lib/workers/package-enrich";
import { runPriceCheck } from "../lib/workers/price-check";
import { runPdfSync } from "../lib/workers/pdf-sync";

/**
 * AI Workers admin API — background automation for packages. Access is
 * limited to Super Admin and Management (same gate as the AI assistant,
 * since these workers write to the same data).
 */

type Env = {
  Bindings: { DB: D1Database; AI?: Ai };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: import("../lib/auth-context").StaffIdentity;
  };
};

const aiWorkersRouter = new Hono<Env>();

aiWorkersRouter.use("*", requireRole("super_admin", "management"));

// ---------------------------------------------------------------------------
// Worker enable/disable flags, persisted in app_settings key `ai_workers`.
// ---------------------------------------------------------------------------

export interface AiWorkersSettings {
  enrich: boolean;
  pdf_sync: boolean;
  price_check: boolean;
}

const DEFAULT_SETTINGS: AiWorkersSettings = {
  enrich: true,
  pdf_sync: true,
  price_check: true,
};

export async function loadWorkersSettings(
  db: DrizzleD1Database<typeof schema>,
): Promise<AiWorkersSettings> {
  const rows = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, "ai_workers"))
    .limit(1);
  if (!rows.length) return { ...DEFAULT_SETTINGS };
  const raw = rows[0].value;
  const stored: Partial<AiWorkersSettings> =
    typeof raw === "string"
      ? (JSON.parse(raw) as Partial<AiWorkersSettings>)
      : ((raw ?? {}) as Partial<AiWorkersSettings>);
  return {
    enrich: stored?.enrich !== false,
    pdf_sync: stored?.pdf_sync !== false,
    price_check: stored?.price_check !== false,
  };
}

/** Guard: is this the first cron tick of the given KL hour for a daily worker? */
function isDailySlot(now: Date, hourKl: number): boolean {
  // KL = UTC+8. Match the 5-minute cron tick that falls inside the hour.
  const klHour = (now.getUTCHours() + 8) % 24;
  return klHour === hourKl && now.getUTCMinutes() < 5;
}

/** Guard: Monday morning slot (weekly workers). */
function isWeeklySlot(now: Date, hourKl: number): boolean {
  // getUTCDay: 0 Sun … 6 Sat — Monday = 1. Compare in KL time.
  const klDay = new Date(now.getTime() + 8 * 3600 * 1000).getUTCDay();
  const klHour = new Date(now.getTime() + 8 * 3600 * 1000).getUTCHours();
  return klDay === 1 && klHour === hourKl && now.getUTCMinutes() < 5;
}

// ---------------------------------------------------------------------------
// Run helpers — create the run row, execute, update the outcome.
// ---------------------------------------------------------------------------

async function createRun(
  db: DrizzleD1Database<typeof schema>,
  worker: "enrich" | "pdf_sync" | "price_check",
  staffId: string | null,
  summary: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.aiWorkerRuns).values({
    id,
    worker,
    status: "running",
    summary,
    staffId,
  });
  return id;
}

async function finishRun(
  db: DrizzleD1Database<typeof schema>,
  runId: string,
  status: "done" | "failed",
  summary: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .update(schema.aiWorkerRuns)
    .set({ status, summary, result })
    .where(eq(schema.aiWorkerRuns.id, runId));
}

/** Execute the enrichment worker and record the run. */
export async function executeEnrichRun(
  db: DrizzleD1Database<typeof schema>,
  ai: Ai,
  staffId: string | null,
): Promise<{ runId: string; result: Awaited<ReturnType<typeof runPackageEnrichment>> }> {
  const runId = await createRun(db, "enrich", staffId, "AI sedang melengkapkan pakej…");
  try {
    const result = await runPackageEnrichment(db, ai);
    const summary = result.enriched.length
      ? `${result.enriched.length} pakej dilengkapkan (${result.enriched.map((p) => p.name).slice(0, 3).join(", ")}${result.enriched.length > 3 ? "…" : ""})`
      : `Tiada pakej perlu dilengkapkan (${result.scanned} disemak)`;
    await finishRun(db, runId, "done", summary, result as unknown as Record<string, unknown>);
    return { runId, result };
  } catch (err) {
    await finishRun(db, runId, "failed", err instanceof Error ? err.message : "Gagal", {});
    throw err;
  }
}

/** Execute the price/margin worker and record the run. */
export async function executePriceCheckRun(
  db: DrizzleD1Database<typeof schema>,
  ai: Ai,
  staffId: string | null,
): Promise<{ runId: string; result: Awaited<ReturnType<typeof runPriceCheck>> }> {
  const runId = await createRun(db, "price_check", staffId, "AI sedang menganalisis margin…");
  try {
    const result = await runPriceCheck(db, ai);
    const summary = result.lowMargin.length
      ? `${result.lowMargin.length} pakej bermargin rendah dikenal pasti (daripada ${result.analysed})`
      : `Semua ${result.analysed} pakej sihat dari segi harga`;
    await finishRun(db, runId, "done", summary, result as unknown as Record<string, unknown>);
    return { runId, result };
  } catch (err) {
    await finishRun(db, runId, "failed", err instanceof Error ? err.message : "Gagal", {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** GET /status — worker toggles + latest run per worker. */
aiWorkersRouter.get("/status", async (c) => {
  const db = c.get("db");
  const settings = await loadWorkersSettings(db);
  const latest = await db
    .select()
    .from(schema.aiWorkerRuns)
    .orderBy(desc(schema.aiWorkerRuns.createdAt))
    .limit(60);

  const latestByWorker: Record<string, unknown> = {};
  for (const run of latest) {
    if (!latestByWorker[run.worker]) latestByWorker[run.worker] = run;
  }
  return c.json({ success: true, settings, latest: latestByWorker });
});

/** GET /runs — recent runs, optionally filtered by ?worker=. */
aiWorkersRouter.get("/runs", async (c) => {
  const db = c.get("db");
  const worker = c.req.query("worker");
  const rows = worker
    ? await db
        .select()
        .from(schema.aiWorkerRuns)
        .where(eq(schema.aiWorkerRuns.worker, worker as "enrich" | "pdf_sync" | "price_check"))
        .orderBy(desc(schema.aiWorkerRuns.createdAt))
        .limit(50)
    : await db
        .select()
        .from(schema.aiWorkerRuns)
        .orderBy(desc(schema.aiWorkerRuns.createdAt))
        .limit(50);
  return c.json({ success: true, runs: rows });
});

/** POST /run/:worker — trigger a worker manually. */
aiWorkersRouter.post("/run/:worker", async (c) => {
  const db = c.get("db");
  const ai = c.env.AI;
  if (!ai) {
    return c.json(
      { success: false, error: "no_ai_binding", message: "Workers AI binding tidak aktif" },
      503,
    );
  }
  const staff = c.get("staff");
  const worker = c.req.param("worker");

  if (worker === "enrich") {
    const { result } = await executeEnrichRun(db, ai, staff?.id ?? null);
    return c.json({ success: true, result });
  }
  if (worker === "price_check") {
    const { result } = await executePriceCheckRun(db, ai, staff?.id ?? null);
    return c.json({ success: true, result });
  }
  return c.json({ success: false, error: "unknown_worker" }, 404);
});

/** POST /supplier-pdf — upload a supplier brochure and produce a review diff. */
aiWorkersRouter.post("/supplier-pdf", async (c) => {
  const db = c.get("db");
  const ai = c.env.AI;
  if (!ai) {
    return c.json(
      { success: false, error: "no_ai_binding", message: "Workers AI binding tidak aktif" },
      503,
    );
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ success: false, error: "file field is required" }, 400);
  }
  if (file.size > 15 * 1024 * 1024) {
    return c.json({ success: false, error: "PDF is larger than 15 MB" }, 413);
  }

  const bytes = await file.arrayBuffer();
  if (!isPdf(bytes)) {
    return c.json({ success: false, error: "Only PDF files are supported" }, 415);
  }

  const staff = c.get("staff");
  const runId = await createRun(
    db,
    "pdf_sync",
    staff?.id ?? null,
    `AI sedang membaca ${file.name}…`,
  );

  try {
    const result = await runPdfSync(db, ai, bytes);
    const summary = result.matchedPackageId
      ? `PDF diproses — ${result.diff.length} perubahan dicadangkan untuk "${result.matchedPackageName}"`
      : `PDF diproses — tiada pakej sedia ada sepadan; draft pakej baru disimpan`;
    await db
      .update(schema.aiWorkerRuns)
      .set({
        status: "pending_review",
        summary,
        result: result as unknown as Record<string, unknown>,
        packageId: result.matchedPackageId,
      })
      .where(eq(schema.aiWorkerRuns.id, runId));
    return c.json({ success: true, runId, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memproses PDF";
    await finishRun(db, runId, "failed", message, {});
    return c.json({ success: false, error: message }, 422);
  }
});

/** POST /runs/:id/apply — apply an approved pdf_sync diff to the package. */
aiWorkersRouter.post("/runs/:id/apply", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const rows = await db
    .select()
    .from(schema.aiWorkerRuns)
    .where(eq(schema.aiWorkerRuns.id, id))
    .limit(1);
  if (!rows.length) return c.json({ success: false, error: "not_found" }, 404);
  const run = rows[0];
  if (run.worker !== "pdf_sync") {
    return c.json({ success: false, error: "only pdf_sync runs can be applied" }, 400);
  }
  if (run.status !== "pending_review") {
    return c.json({ success: false, error: "run is not pending review" }, 409);
  }

  const result = run.result as unknown as {
    draft?: Record<string, unknown>;
    matchedPackageId?: string | null;
  };
  const draft = result?.draft;
  const packageId = result?.matchedPackageId;
  if (!draft || !packageId) {
    await db
      .update(schema.aiWorkerRuns)
      .set({ status: "failed", summary: "Run tiada draft/pakej — tidak boleh diaplikasi" })
      .where(eq(schema.aiWorkerRuns.id, id));
    return c.json({ success: false, error: "run has no draft or matched package" }, 409);
  }

  // Whitelist the fields a PDF apply may change. Only non-empty values are
  // written (the draft already respects this) — prices included, because the
  // admin saw and approved the diff before clicking Apply.
  const updates: Record<string, unknown> = {};
  const fields = [
    "name",
    "destination",
    "durationDays",
    "adultPrice",
    "childPrice",
    "infantPrice",
    "highlights",
    "inclusions",
    "exclusions",
    "itinerary",
  ] as const;
  for (const field of fields) {
    const value = draft[field];
    if (value === undefined || value === null) continue;
    if (typeof value === "number" && value === 0) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    updates[field] = value;
  }
  if (!Object.keys(updates).length) {
    return c.json({ success: false, error: "nothing to apply" }, 409);
  }

  updates.updatedAt = sql`datetime('now')`;
  await db
    .update(schema.packages)
    .set(updates)
    .where(eq(schema.packages.id, packageId));

  const staff = c.get("staff");
  await db
    .update(schema.aiWorkerRuns)
    .set({ status: "done", appliedAt: sql`datetime('now')`, staffId: staff?.id ?? run.staffId })
    .where(eq(schema.aiWorkerRuns.id, id));

  return c.json({ success: true, applied: Object.keys(updates) });
});

/** POST /runs/:id/reject — discard a pending_review run. */
aiWorkersRouter.post("/runs/:id/reject", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const rows = await db
    .select({ id: schema.aiWorkerRuns.id, status: schema.aiWorkerRuns.status })
    .from(schema.aiWorkerRuns)
    .where(eq(schema.aiWorkerRuns.id, id))
    .limit(1);
  if (!rows.length) return c.json({ success: false, error: "not_found" }, 404);
  if (rows[0].status !== "pending_review") {
    return c.json({ success: false, error: "run is not pending review" }, 409);
  }
  await db
    .update(schema.aiWorkerRuns)
    .set({ status: "failed", summary: "Ditolak oleh admin" })
    .where(eq(schema.aiWorkerRuns.id, id));
  return c.json({ success: true });
});

/** PUT /settings — update worker toggles. */
aiWorkersRouter.put("/settings", async (c) => {
  const db = c.get("db");
  let body: Partial<AiWorkersSettings>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }
  const current = await loadWorkersSettings(db);
  const next: AiWorkersSettings = {
    enrich: typeof body.enrich === "boolean" ? body.enrich : current.enrich,
    pdf_sync: typeof body.pdf_sync === "boolean" ? body.pdf_sync : current.pdf_sync,
    price_check:
      typeof body.price_check === "boolean" ? body.price_check : current.price_check,
  };
  await db
    .insert(schema.appSettings)
    .values({ key: "ai_workers", value: next, updatedAt: sql`datetime('now')` })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: next, updatedAt: sql`datetime('now')` },
    });
  return c.json({ success: true, settings: next });
});

// ---------------------------------------------------------------------------
// Cron entry — called from scheduled() in src/server/index.ts.
// ---------------------------------------------------------------------------

/** Run cron-driven workers (daily enrich ~07:00 KL, weekly price check Mon 07:00 KL). */
export async function runAiWorkersCron(
  db: DrizzleD1Database<typeof schema>,
  ai: Ai | undefined,
  now: Date,
): Promise<void> {
  if (!ai) return;
  const settings = await loadWorkersSettings(db);

  if (settings.enrich && isDailySlot(now, 7)) {
    try {
      const { result } = await executeEnrichRun(db, ai, null);
      console.log(`[ai-worker:enrich] ${result.enriched.length} enriched`);
    } catch (err) {
      console.error("[ai-worker:enrich] cron run failed", err);
    }
  }

  if (settings.price_check && isWeeklySlot(now, 7)) {
    try {
      const { result } = await executePriceCheckRun(db, ai, null);
      console.log(`[ai-worker:price-check] ${result.lowMargin.length} low-margin`);
    } catch (err) {
      console.error("[ai-worker:price-check] cron run failed", err);
    }
  }
}

export default aiWorkersRouter;
