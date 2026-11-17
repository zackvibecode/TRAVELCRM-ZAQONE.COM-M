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

/**
 * Compatibility alias for the Better Auth JS client default (/api/auth/*).
 * The client's default basePath is /api/auth, but this server configures
 * Better Auth with basePath /auth — rewrite the URL before handing the
 * request to the handler so route resolution matches.
 */
const apiAuthRouter = new Hono<AuthEnv>();

apiAuthRouter.all("*", async (c) => {
  const auth = getAuth(c);
  const raw = c.req.raw;
  const url = new URL(raw.url);
  url.pathname = url.pathname.replace(/^\/api\/auth/, "/auth");
  const rewritten = new Request(url.toString(), raw);
  return auth.handler(rewritten);
});

export { apiAuthRouter };
export default authRouter;
