import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export type DocumentsEnv = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const documentsRouter = new Hono<{
  Bindings: DocumentsEnv;
  Variables: Variables;
}>();

// GET /passengers/:id/documents — list document metadata for a passenger.
documentsRouter.get("/passengers/:id/documents", async (c) => {
  const db = c.get("db");
  const passengerId = c.req.param("id");

  const passenger = await db
    .select({ id: schema.passengers.id })
    .from(schema.passengers)
    .where(eq(schema.passengers.id, passengerId))
    .get();
  if (!passenger) {
    return c.json({ success: false, error: "Passenger not found" }, 404);
  }

  const docs = await db
    .select()
    .from(schema.passengerDocuments)
    .where(eq(schema.passengerDocuments.passengerId, passengerId))
    .all();

  return c.json({ success: true, documents: docs });
});

// POST /passengers/:id/documents — upload a document to R2 and record metadata.
documentsRouter.post("/passengers/:id/documents", async (c) => {
  const db = c.get("db");
  const passengerId = c.req.param("id");

  const passenger = await db
    .select({ id: schema.passengers.id })
    .from(schema.passengers)
    .where(eq(schema.passengers.id, passengerId))
    .get();
  if (!passenger) {
    return c.json({ success: false, error: "Passenger not found" }, 404);
  }

  const form = await c.req.formData();
  const file = form.get("file");
  const type = (form.get("type") as string | null) ?? "other";
  const name = (form.get("name") as string | null) ?? "document";

  if (!(file instanceof File)) {
    return c.json({ success: false, error: "file field is required" }, 400);
  }

  const validTypes = ["passport", "visa", "insurance", "other"];
  if (!validTypes.includes(type)) {
    return c.json({ success: false, error: "Invalid document type" }, 400);
  }

  const docId = crypto.randomUUID();
  const r2Key = `passengers/${passengerId}/${docId}-${file.name}`;
  const bytes = await file.arrayBuffer();

  await c.env.DOCUMENTS.put(r2Key, bytes, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const row: schema.NewPassengerDocumentRow = {
    id: docId,
    passengerId,
    type: type as "passport" | "visa" | "insurance" | "other",
    name,
    r2Key,
    mimeType: file.type || null,
    sizeBytes: file.size,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };

  await db.insert(schema.passengerDocuments).values(row).run();

  return c.json({ success: true, document: row }, 201);
});

// GET /documents/:id/download — stream a document from R2.
documentsRouter.get("/documents/:id/download", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const doc = await db
    .select()
    .from(schema.passengerDocuments)
    .where(eq(schema.passengerDocuments.id, id))
    .get();
  if (!doc) {
    return c.json({ success: false, error: "Document not found" }, 404);
  }

  const object = await c.env.DOCUMENTS.get(doc.r2Key);
  if (!object) {
    return c.json({ success: false, error: "Document file missing" }, 404);
  }

  const headers = new Headers();
  headers.set("Content-Type", doc.mimeType ?? "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${doc.name}"`);
  object.writeHttpMetadata(headers);

  return new Response(object.body, { headers });
});

export default documentsRouter;
