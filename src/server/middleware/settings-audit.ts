import type { MiddlewareHandler } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

type AuditEnv = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff?: { email: string; role: string };
    userRole?: string;
  };
};

/**
 * Post-mutation audit middleware for settings routes: after a successful
 * PUT/POST/PATCH/DELETE under /settings*, records one settings_audit_logs row
 * describing the module (first path segment), the change type, and the actor.
 * Endpoints that already write richer before/after rows keep those; this
 * middleware is the safety net for any mutation without explicit logging.
 */
export function settingsAuditMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    const method = c.req.method.toUpperCase();
    if (!["PUT", "POST", "PATCH", "DELETE"].includes(method)) return;
    if (c.res.status >= 400) return;

    try {
      const db = c.get("db") as DrizzleD1Database<typeof schema> | undefined;
      if (!db) return;

      const path = new URL(c.req.url).pathname;
      // Skip explicit logging paths that already write detailed audit rows.
      const alreadyLogged =
        path.includes("/bank-accounts") ||
        path.includes("/company") ||
        path.includes("/terms") ||
        path.includes("/booking-defaults") ||
        path.includes("/api-tokens") ||
        path.includes("/notification-templates") ||
        path.endsWith("/next") ||
        path.endsWith("/logo");
      if (alreadyLogged) return;

      const segs = path.split("/").filter(Boolean); // e.g. settings, general
      const module = segs[1] ?? "settings";
      const staff = c.get("staff");
      const changeType =
        method === "DELETE" ? "deleted" : method === "POST" ? "created" : "updated";

      await db.run(
        // Raw insert keeps this middleware decoupled from payload parsing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("drizzle-orm")).sql`INSERT INTO settings_audit_logs
          (id, actor, role, module, field, before_value, after_value, change_type, at)
          VALUES (${crypto.randomUUID()}, ${staff?.email ?? "system"},
            ${staff?.role ?? c.get("userRole") ?? "super_admin"},
            ${module}, ${module}, NULL, NULL, ${changeType}, datetime('now'))`,
      );
    } catch (err) {
      // Audit logging must never break the main request.
      console.error("[settings-audit] failed to record change:", err);
    }
  };
}
