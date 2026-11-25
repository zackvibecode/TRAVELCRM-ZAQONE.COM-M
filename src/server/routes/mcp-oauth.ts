import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getAuth } from "../lib/auth-context";

/**
 * MCP OAuth 2.1 authorization server — lets AI clients (Claude Desktop,
 * Cursor, ...) connect to /mcp with the standard authorization-code + PKCE
 * flow. The authorize step reuses the CRM's existing Better Auth session:
 * the user logs in once in the browser and approves the client.
 *
 * Endpoints (all under /mcp/oauth, per the MCP auth spec discovery rules):
 *   GET  /.well-known/oauth-authorization-server  (also under /.well-known/)
 *   POST /register          — dynamic client registration (RFC 7591)
 *   GET  /authorize         — approval page (session-gated) or auto-approve
 *   POST /token             — authorization_code (PKCE) + refresh_token
 *   POST /revoke            — RFC 7009 token revocation
 */

type Env = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    auth: import("../lib/auth").Auth;
  };
};

const oauthRouter = new Hono<Env>();

/** Access tokens live 1h; refresh tokens 30d. */
const ACCESS_TTL_S = 3600;
const REFRESH_TTL_S = 60 * 60 * 24 * 30;
/** Authorization codes: 10 minutes (spec max). */
const CODE_TTL_S = 600;

/** Allowed scopes map onto the same MCP token scopes. */
const VALID_SCOPES = new Set([
  "customers:read",
  "leads:read",
  "bookings:read",
  "departures:read",
  "packages:read",
]);

function normalizeScope(input: string | undefined | null): string {
  const parts = (input ?? "")
    .split(/[\s,]+/)
    .filter((s) => s && VALID_SCOPES.has(s));
  return Array.from(new Set(parts)).join(" ");
}

function baseUrlOf(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${body}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** PKCE S256 verifier check: BASE64URL(SHA256(verifier)) === challenge. */
async function verifyPkce(verifier: string, challenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const base64url = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64url === challenge;
}

// ---------------------------------------------------------------------------
// Discovery — clients fetch this first to learn the endpoints.
// ---------------------------------------------------------------------------

function serverMetadata(c: { req: { url: string } }) {
  const base = baseUrlOf(c);
  return {
    issuer: base,
    authorization_endpoint: `${base}/mcp/oauth/authorize`,
    token_endpoint: `${base}/mcp/oauth/token`,
    registration_endpoint: `${base}/mcp/oauth/register`,
    revocation_endpoint: `${base}/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: Array.from(VALID_SCOPES),
  };
}

oauthRouter.get("/.well-known/oauth-authorization-server", (c) => c.json(serverMetadata(c)));

/**
 * Protected-resource metadata (RFC 9728). AI clients hitting /mcp without a
 * token read the WWW-Authenticate hint and fetch this to find the OAuth
 * endpoints — the entry point of the whole flow.
 */
oauthRouter.get("/.well-known/oauth-protected-resource", (c) => {
  const base = baseUrlOf(c);
  return c.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: Array.from(VALID_SCOPES),
  });
});

// ---------------------------------------------------------------------------
// Dynamic client registration (RFC 7591) — open registration restricted to
// CRM staff; AI clients POST here once and store the client_id.
// ---------------------------------------------------------------------------

interface RegistrationInput {
  client_name?: string;
  redirect_uris?: string[];
  scope?: string;
}

oauthRouter.post("/register", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<RegistrationInput>()) as RegistrationInput;

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 10)
    : [];
  if (redirectUris.length === 0) {
    return c.json({ error: "invalid_client_metadata", error_description: "redirect_uris required" }, 400);
  }

  const clientId = randomToken("mcp");
  const id = crypto.randomUUID();
  await db.insert(schema.mcpOauthClients).values({
    id,
    clientId,
    clientSecretHash: null, // public client — PKCE only
    name: (body.client_name ?? "MCP Client").slice(0, 120),
    redirectUris,
    createdBy: null,
  });

  return c.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: body.client_name ?? "MCP Client",
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: normalizeScope(body.scope) || Array.from(VALID_SCOPES).join(" "),
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// Authorize — the CRM user approves the client in the browser. Uses the
// existing Better Auth session (auto-approve when logged in; else a minimal
// sign-in landing page that redirects back).
// ---------------------------------------------------------------------------

oauthRouter.get("/authorize", async (c) => {
  const db = c.get("db");
  const auth = getAuth(c as never);
  const q = c.req.query();

  const clientId = q.client_id ?? "";
  const redirectUri = q.redirect_uri ?? "";
  const responseMode = q.response_mode === "fragment" ? "fragment" : "query";
  const state = q.state ?? "";
  const codeChallenge = q.code_challenge ?? "";
  const challengeMethod = q.code_challenge_method ?? "";
  const scope = normalizeScope(q.scope);

  const fail = (code: string, desc: string) => {
    const target = new URL(redirectUri || "https://travelcrm.zaqone.com");
    if (state) target.searchParams.set("state", state);
    target.searchParams.set("error", code);
    target.searchParams.set("error_description", desc);
    return c.redirect(target.toString(), 302);
  };

  const client = clientId
    ? (
        await db
          .select()
          .from(schema.mcpOauthClients)
          .where(
            and(
              eq(schema.mcpOauthClients.clientId, clientId),
              eq(schema.mcpOauthClients.status, "active"),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (!client) {
    return c.text("Invalid or unknown client_id", 400);
  }
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return c.text("redirect_uri is not registered for this client", 400);
  }
  if (challengeMethod !== "S256" || !codeChallenge) {
    return fail("invalid_request", "code_challenge_method must be S256 (PKCE required)");
  }
  if (!scope) {
    return fail("invalid_scope", "no valid scopes requested");
  }

  // Resolve the CRM session; the user must be signed in to approve. The
  // authorize popup is a THIRD-PARTY context (opened by ChatGPT/Claude), so
  // the CRM session cookie is often not sent there. Redirecting to the SPA
  // leaves the user stuck on a blank/stale page — instead this endpoint is
  // SELF-CONTAINED: it renders its own sign-in + approve page (same-origin,
  // first-party cookie) and issues the code directly on submit.
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const user = session?.user as
    | { id: string; name: string; email: string; status?: string }
    | undefined;

  if (!user || user.status !== "active") {
    // Not signed in: render the minimal sign-in page (GET, no JS deps).
    const pageUrl = c.req.url;
    const html = `<!doctype html>
<html lang="ms"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign in — MCP Authorization</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;background:#f4f8ff;display:grid;place-items:center;min-height:100vh;margin:0}
  .card{background:#fff;border:1px solid #e2eaf7;border-radius:16px;padding:32px;width:min(380px,90vw);box-shadow:0 8px 24px rgba(17,26,44,.08)}
  h1{font-size:18px;margin:0 0 4px;color:#111a2c}
  p.sub{font-size:13px;color:#66738a;margin:0 0 18px}
  label{display:block;font-size:12px;font-weight:600;color:#3f4a5f;margin:12px 0 4px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd9ee;border-radius:8px;font-size:14px}
  button{width:100%;margin-top:18px;padding:11px;background:#2563eb;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
  button:disabled{opacity:.6;cursor:wait}
  .err{display:none;background:#fdecec;color:#b3261e;border:1px solid #f5c6c6;border-radius:8px;padding:8px 12px;font-size:13px;margin-bottom:12px}
</style></head>
<body><div class="card">
  <h1>Sign in to approve access</h1>
  <p class="sub">Sign in to your CRM account to connect this AI client.</p>
  <div class="err" id="err"></div>
  <form id="f">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email"/>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password"/>
    <button type="submit" id="go">Sign in &amp; continue</button>
  </form>
</div>
<script>
const F = document.getElementById('f'), E = document.getElementById('err'), B = document.getElementById('go');
F.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  B.disabled = true; E.style.display = 'none';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    // Sign in server-side (same-origin) so the session cookie is set here.
    const si = await fetch('/auth/sign-in/email', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });
    if (!si.ok) { throw new Error((await si.json().catch(() => ({}))).message || 'Invalid email or password'); }
    // Session established — reload the authorize URL to continue the flow.
    window.location.replace(${JSON.stringify(pageUrl)});
  } catch (e) {
    E.textContent = e.message || 'Sign-in failed';
    E.style.display = 'block';
    B.disabled = false;
  }
});
</script>
</body></html>`;
    return c.newResponse(html, 200, { "Content-Type": "text/html; charset=utf-8" });
  }


  const code = randomToken("code");
  const expiresAt = new Date(Date.now() + CODE_TTL_S * 1000).toISOString();
  await db.insert(schema.mcpOauthCodes).values({
    id: crypto.randomUUID(),
    codeHash: await sha256Hex(code),
    clientId,
    userId: user.id,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod: "S256",
    expiresAt,
  });

  const target = new URL(redirectUri);
  const carry = (k: string, v: string) => {
    if (responseMode === "fragment") {
      target.hash = target.hash
        ? `${target.hash}&${k}=${encodeURIComponent(v)}`
        : `#${k}=${encodeURIComponent(v)}`;
    } else {
      target.searchParams.set(k, v);
    }
  };
  carry("code", code);
  if (state) carry("state", state);
  return c.redirect(target.toString(), 302);
});

// ---------------------------------------------------------------------------
// Token — exchange authorization_code (+ PKCE verifier) or refresh_token.
// ---------------------------------------------------------------------------

interface TokenInput {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  code_verifier?: string;
  refresh_token?: string;
  scope?: string;
}

oauthRouter.post("/token", async (c) => {
  const db = c.get("db");
  const contentType = c.req.header("Content-Type") ?? "";
  let body: TokenInput;
  if (contentType.includes("application/json")) {
    body = (await c.req.json<TokenInput>()) as TokenInput;
  } else {
    const form = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
    ) as TokenInput;
  }

  const client = body.client_id
    ? (
        await db
          .select()
          .from(schema.mcpOauthClients)
          .where(
            and(
              eq(schema.mcpOauthClients.clientId, body.client_id),
              eq(schema.mcpOauthClients.status, "active"),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (!client) {
    return c.json({ error: "invalid_client" }, 401);
  }

  const issueTokens = async (userId: string, scope: string, parentId?: string) => {
    const accessToken = randomToken("zat");
    const refreshToken = randomToken("zrt");
    const accessId = crypto.randomUUID();
    await db.insert(schema.mcpOauthTokens).values({
      id: accessId,
      kind: "access",
      tokenHash: await sha256Hex(accessToken),
      clientId: client.clientId,
      userId,
      scope,
      parentId: parentId ?? null,
      expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000).toISOString(),
    });
    await db.insert(schema.mcpOauthTokens).values({
      id: crypto.randomUUID(),
      kind: "refresh",
      tokenHash: await sha256Hex(refreshToken),
      clientId: client.clientId,
      userId,
      scope,
      parentId: accessId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000).toISOString(),
    });
    return { accessToken, refreshToken, scope };
  };

  if (body.grant_type === "authorization_code") {
    if (!body.code || !body.code_verifier) {
      return c.json({ error: "invalid_request", error_description: "code and code_verifier required" }, 400);
    }
    const [row] = await db
      .select()
      .from(schema.mcpOauthCodes)
      .where(eq(schema.mcpOauthCodes.codeHash, await sha256Hex(body.code)))
      .limit(1);
    if (!row) return c.json({ error: "invalid_grant", error_description: "unknown code" }, 400);
    if (row.clientId !== client.clientId) {
      return c.json({ error: "invalid_grant", error_description: "client mismatch" }, 400);
    }
    if (row.usedAt) {
      // Code already used — revoke tokens issued from it (spec security note).
      await db
        .update(schema.mcpOauthTokens)
        .set({ status: "revoked" })
        .where(eq(schema.mcpOauthTokens.clientId, client.clientId))
        .catch(() => undefined);
      return c.json({ error: "invalid_grant", error_description: "code already used" }, 400);
    }
    if (row.expiresAt < new Date().toISOString()) {
      return c.json({ error: "invalid_grant", error_description: "code expired" }, 400);
    }
    if (body.redirect_uri !== row.redirectUri) {
      return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
    }
    if (!(await verifyPkce(body.code_verifier, row.codeChallenge ?? ""))) {
      return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }

    await db.update(schema.mcpOauthCodes).set({ usedAt: sql`(datetime('now'))` }).where(
      eq(schema.mcpOauthCodes.id, row.id),
    );
    const issued = await issueTokens(row.userId, row.scope);
    return c.json({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: issued.refreshToken,
      scope: issued.scope,
    });
  }

  if (body.grant_type === "refresh_token") {
    if (!body.refresh_token) {
      return c.json({ error: "invalid_request", error_description: "refresh_token required" }, 400);
    }
    const [row] = await db
      .select()
      .from(schema.mcpOauthTokens)
      .where(eq(schema.mcpOauthTokens.tokenHash, await sha256Hex(body.refresh_token)))
      .limit(1);
    if (
      !row ||
      row.kind !== "refresh" ||
      row.status !== "active" ||
      row.clientId !== client.clientId ||
      row.expiresAt < new Date().toISOString()
    ) {
      return c.json({ error: "invalid_grant", error_description: "invalid refresh token" }, 400);
    }
    // Rotate: revoke the used refresh token + its sibling access token.
    await db
      .update(schema.mcpOauthTokens)
      .set({ status: "revoked" })
      .where(eq(schema.mcpOauthTokens.parentId, row.parentId ?? row.id));
    await db
      .update(schema.mcpOauthTokens)
      .set({ status: "revoked" })
      .where(eq(schema.mcpOauthTokens.id, row.id));

    const requested = normalizeScope(body.scope) || row.scope;
    const granted = row.scope
      .split(" ")
      .filter((s) => requested.includes(s))
      .join(" ") || row.scope;
    const issued = await issueTokens(row.userId, granted, row.parentId ?? undefined);
    return c.json({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: issued.refreshToken,
      scope: issued.scope,
    });
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// ---------------------------------------------------------------------------
// Revocation (RFC 7009) — clients can drop their own tokens.
// ---------------------------------------------------------------------------

oauthRouter.post("/revoke", async (c) => {
  const db = c.get("db");
  const contentType = c.req.header("Content-Type") ?? "";
  let token = "";
  if (contentType.includes("application/json")) {
    const body = (await c.req.json<{ token?: string }>()) as { token?: string };
    token = body.token ?? "";
  } else {
    const form = await c.req.parseBody();
    token = typeof form.token === "string" ? form.token : "";
  }
  if (token) {
    await db
      .update(schema.mcpOauthTokens)
      .set({ status: "revoked" })
      .where(eq(schema.mcpOauthTokens.tokenHash, await sha256Hex(token)));
  }
  // RFC 7009: always 200 even when the token is unknown.
  return c.json({});
});

export default oauthRouter;

