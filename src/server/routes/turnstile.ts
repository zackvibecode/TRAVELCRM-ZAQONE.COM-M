import { Hono } from "hono";

/**
 * Cloudflare Turnstile verification endpoint.
 *
 * The browser renders the Turnstile widget and submits the `cf-turnstile-response`
 * token here; this Worker then calls the Cloudflare siteverify API to confirm the
 * token is valid for the expected action and hostname before the frontend allows
 * the login/signup request to proceed.
 */
const turnstileRouter = new Hono<{ Bindings: { TURNSTILE_SECRET_KEY?: string; TURNSTILE_HOSTNAMES?: string } }>();

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

turnstileRouter.post("/", async (c) => {
  const secret = c.env.TURNSTILE_SECRET_KEY;
  const allowedHostnames = new Set(
    (c.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );

  if (!secret || allowedHostnames.size === 0) {
    return c.json({ success: false, error: "turnstile_not_configured" }, 503);
  }

  let body: { token?: string; action?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // fall through to the token validation below
  }

  const token = typeof body.token === "string" ? body.token : "";
  const expectedAction = typeof body.action === "string" ? body.action : "";

  if (!token || token.length > 2048 || !expectedAction) {
    return c.json({ success: false, error: "invalid_request" }, 400);
  }

  const clientIp =
    c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "";

  let result: {
    success?: boolean;
    action?: string;
    hostname?: string;
  };
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        ...(clientIp ? { remoteip: clientIp.split(",")[0]!.trim() } : {}),
      }),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = (await res.json()) as typeof result;
  } catch {
    // Network error / non-2xx / non-JSON — fail closed.
    return c.json({ success: false, error: "siteverify_failed" }, 502);
  }

  if (
    result.success !== true ||
    result.action !== expectedAction ||
    typeof result.hostname !== "string" ||
    !allowedHostnames.has(result.hostname)
  ) {
    return c.json({ success: false, error: "challenge_failed" }, 403);
  }

  return c.json({ success: true });
});

export default turnstileRouter;
