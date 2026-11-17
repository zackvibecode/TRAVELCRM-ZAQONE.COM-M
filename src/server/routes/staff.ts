import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import {
  requireRole,
  requirePermission,
} from "../middleware/auth";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    userRole: string;
  };
};

const staffRouter = new Hono<Env>();

// Only Super Admin manages staff.
staffRouter.use("*", requireRole("super_admin"));
staffRouter.use("*", requirePermission("staff:manage"));

const ROLES = [
  "super_admin",
  "management",
  "sales",
  "finance",
  "operations",
] as const;
type Role = (typeof ROLES)[number];

interface CreateStaffInput {
  name: string;
  email: string;
  role?: Role;
  password?: string;
}

interface UpdateStaffInput {
  role?: Role;
  status?: "active" | "suspended";
  name?: string;
}

/** GET /staff — list all staff with role and status. */
staffRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      status: schema.user.status,
      emailVerified: schema.user.emailVerified,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(desc(schema.user.createdAt));
  return c.json({ success: true, staff: rows });
});

/** POST /staff — invite a new staff member (account created on first sign-in). */
staffRouter.post("/", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<CreateStaffInput>()) as CreateStaffInput;

  if (!body.name?.trim() || !body.email?.trim()) {
    return c.json({ success: false, error: "name and email are required" }, 400);
  }
  const role = body.role ?? "sales";
  if (!ROLES.includes(role)) {
    return c.json({ success: false, error: "Invalid role" }, 400);
  }

  // Duplicate check.
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, body.email.trim().toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    return c.json({ success: false, error: "Email already exists" }, 409);
  }

  const id = crypto.randomUUID();
  await db.insert(schema.user).values({
    id,
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    role,
    status: "active",
    emailVerified: false,
  });

  // Audit trail.
  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    actor: "super_admin",
    role: "super_admin",
    action: "staff.invite",
    entityType: "user",
    entityId: id,
    detail: JSON.stringify({ email: body.email, role }),
  });

  return c.json({ success: true, staff: { id, name: body.name, email: body.email, role } }, 201);
});

/** PATCH /staff/:id — update role / status / name. */
staffRouter.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json<UpdateStaffInput>()) as UpdateStaffInput;

  const target = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1);
  if (target.length === 0) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  if (body.role && !ROLES.includes(body.role)) {
    return c.json({ success: false, error: "Invalid role" }, 400);
  }

  // Guard: cannot demote the last super_admin.
  if (
    target[0]!.role === "super_admin" &&
    body.role &&
    body.role !== "super_admin"
  ) {
    const admins = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.role, "super_admin"));
    if (admins.length <= 1) {
      return c.json(
        { success: false, error: "Cannot demote the last super admin" },
        400,
      );
    }
  }

  const patch: Partial<typeof schema.user.$inferInsert> = {};
  if (body.role) patch.role = body.role;
  if (body.status) patch.status = body.status;
  if (body.name?.trim()) patch.name = body.name.trim();
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 1) {
    await db.update(schema.user).set(patch).where(eq(schema.user.id, id));
  }

  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    actor: "super_admin",
    role: "super_admin",
    action: "staff.update",
    entityType: "user",
    entityId: id,
    detail: JSON.stringify(body),
  });

  return c.json({ success: true });
});

/** DELETE /staff/:id — remove a staff member (cascades sessions/accounts). */
staffRouter.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const target = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1);
  if (target.length === 0) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  if (target[0]!.role === "super_admin") {
    const admins = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.role, "super_admin"));
    if (admins.length <= 1) {
      return c.json(
        { success: false, error: "Cannot delete the last super admin" },
        400,
      );
    }
  }

  await db.delete(schema.user).where(eq(schema.user.id, id));

  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    actor: "super_admin",
    role: "super_admin",
    action: "staff.delete",
    entityType: "user",
    entityId: id,
    detail: JSON.stringify({ email: target[0]!.email }),
  });

  return c.json({ success: true });
});

export default staffRouter;
