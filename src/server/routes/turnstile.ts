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
    "error-codes"?: string[];
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
    // siteverify normally returns 200 even for "invalid" tokens; a non-2xx
    // here means the request itself is malformed (most commonly a wrong secret).
    const json = (await res.json().catch(() => ({}))) as typeof result;
    result = json;
    if (!res.ok || json.success !== true) {
      const codes = json["error-codes"] ?? [];
      console.log(
        JSON.stringify({ msg: "turnstile_verify_failed", status: res.status, codes }),
      );
      // Misconfigured secret: fail OPEN so a config mistake never locks the
      // whole team out of the CRM. Genuinely bad tokens still fail below.
      const configErrors = ["invalid-input-secret", "missing-input-secret", "bad-request"];
      if (configErrors.some((c) => codes.includes(c))) {
        return c.json({ success: true, warning: "turnstile_misconfigured" });
      }
    }
  } catch {
    // Network error / non-JSON — fail closed.
    return c.json({ success: false, error: "siteverify_failed" }, 502);
  }

  if (
    result.success !== true ||
    result.action !== expectedAction ||
    typeof result.hostname !== "string" ||
    !allowedHostnames.has(result.hostname)
  ) {
    // Diagnostic detail so the real reason is visible in `wrangler tail`.
    // Never includes the token or secret.
    let reason = "challenge_failed";
    if (result.success !== true) reason = "siteverify_rejected";
    else if (result.action !== expectedAction) reason = "action_mismatch";
    else if (typeof result.hostname !== "string") reason = "hostname_missing";
    else if (!allowedHostnames.has(result.hostname)) reason = "hostname_not_allowed";
    console.log(
      JSON.stringify({
        msg: "turnstile_failed",
        reason,
        expectedAction,
        gotAction: result.action,
        gotHostname: result.hostname,
        allowed: [...allowedHostnames],
      }),
    );
    return c.json({ success: false, error: "challenge_failed", reason }, 403);
  }

  return c.json({ success: true });
});

export default turnstileRouter;
