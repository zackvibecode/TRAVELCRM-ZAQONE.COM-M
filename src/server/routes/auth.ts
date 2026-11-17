import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth-context";
import { getAuth } from "../lib/auth-context";

/**
 * Mounts Better Auth's catch-all handler under /auth/*:
 *   POST /auth/sign-in/email       — staff email + password sign-in
 *   POST /auth/sign-out            — end session
 *   GET  /auth/get-session         — current session payload
 */
const authRouter = new Hono<AuthEnv>();

authRouter.all("*", async (c) => {
  const auth = getAuth(c);
  return auth.handler(c.req.raw);
});

export default authRouter;
