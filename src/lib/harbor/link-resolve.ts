// Harbor Web — vault account resolution (Feature: zero-config account linking)
// Resolves an opaque linkId to a live access token, auto-refreshing Trakt
// tokens when they're near expiry. Tokens never leave the server boundary —
// callers use them to talk to the provider API directly.
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/harbor/vault";
import { TRAKT_OAUTH, envTraktClientId, envTraktClientSecret } from "@/lib/harbor/trakt-server";
import { SIMKL_API } from "@/lib/harbor/simkl-server";

export type ResolvedAccount = {
  linkId: string;
  provider: "trakt" | "simkl";
  accessToken: string;
  username: string | null;
  avatar: string | null;
};

export async function resolveLinkedAccount(linkId: string): Promise<ResolvedAccount | null> {
  if (!linkId || linkId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(linkId)) return null;
  const row = await db.linkedAccount.findUnique({ where: { id: linkId } }).catch(() => null);
  if (!row) return null;
  const accessToken = decryptToken(row.accessTokenEnc);
  if (!accessToken) return null;
  const provider = row.provider === "simkl" ? "simkl" : "trakt";

  // Trakt tokens expire — refresh when inside the last 5 minutes
  if (provider === "trakt" && row.expiresAt && row.refreshTokenEnc) {
    const expiresSoon = row.expiresAt.getTime() - Date.now() < 5 * 60_000;
    if (expiresSoon) {
      const refreshed = await refreshTrakt(row.id, row.refreshTokenEnc);
      if (refreshed) return refreshed;
      // fall through with the still-valid token if it hasn't fully expired
      if (row.expiresAt.getTime() < Date.now()) return null;
    }
  }

  return { linkId: row.id, provider, accessToken, username: row.username, avatar: row.avatar };
}

async function refreshTrakt(rowId: string, refreshEnc: string): Promise<ResolvedAccount | null> {
  const refreshToken = decryptToken(refreshEnc);
  const clientId = envTraktClientId();
  const clientSecret = envTraktClientSecret();
  if (!refreshToken || !clientId) return null;
  try {
    // PKCE apps: no client_secret; refresh tokens are single-use upstream
    const body: Record<string, string> = {
      refresh_token: refreshToken,
      client_id: clientId,
      grant_type: "refresh_token",
    };
    if (clientSecret) body.client_secret = clientSecret;
    const res = await fetch(`${TRAKT_OAUTH}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "trakt-api-version": "2", "trakt-api-key": clientId },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    const { encryptToken } = await import("@/lib/harbor/vault");
    const row = await db.linkedAccount.update({
      where: { id: rowId },
      data: {
        accessTokenEnc: encryptToken(data.access_token),
        refreshTokenEnc: data.refresh_token ? encryptToken(data.refresh_token) : undefined,
        expiresAt: new Date(Date.now() + (data.expires_in ?? 90 * 24 * 3600) * 1000),
      },
    });
    return { linkId: row.id, provider: "trakt", accessToken: data.access_token, username: row.username, avatar: row.avatar };
  } catch {
    return null;
  }
}

/** Best-effort Trakt token revoke (server-side) — used by unlink. */
export async function revokeTraktToken(accessToken: string): Promise<void> {
  const clientId = envTraktClientId();
  const clientSecret = envTraktClientSecret();
  if (!clientId) return;
  try {
    const body: Record<string, string> = { token: accessToken, client_id: clientId };
    if (clientSecret) body.client_secret = clientSecret;
    await fetch(`${TRAKT_OAUTH}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "trakt-api-version": "2", "trakt-api-key": clientId },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    /* revoke is best-effort — the row is deleted regardless */
  }
}

// ---------- per-request credential resolution (vault mode OR legacy BYO) ----------

export type RequestCreds = { clientId: string; accessToken: string };

/**
 * Resolve Trakt credentials for a sync route: either an opaque linkId
 * (vault mode — env creds + stored token, auto-refreshed) or the legacy
 * client-supplied clientId/accessToken pair. Returns null when neither is
 * usable.
 */
export async function traktCredsFromBody(body: {
  linkId?: unknown;
  clientId?: unknown;
  accessToken?: unknown;
}): Promise<RequestCreds | null> {
  if (typeof body.linkId === "string" && body.linkId) {
    const account = await resolveLinkedAccount(body.linkId).catch(() => null);
    if (account?.provider === "trakt") {
      const clientId = process.env.TRAKT_CLIENT_ID?.trim();
      if (clientId) return { clientId, accessToken: account.accessToken };
    }
    return null;
  }
  if (
    typeof body.clientId === "string" &&
    typeof body.accessToken === "string" &&
    body.clientId.length >= 16 &&
    body.accessToken.length >= 16
  ) {
    return { clientId: body.clientId.trim(), accessToken: body.accessToken.trim() };
  }
  return null;
}

/** Simkl variant (client ids are short alphanumeric strings). */
export async function simklCredsFromBody(body: {
  linkId?: unknown;
  clientId?: unknown;
  accessToken?: unknown;
}): Promise<RequestCreds | null> {
  if (typeof body.linkId === "string" && body.linkId) {
    const account = await resolveLinkedAccount(body.linkId).catch(() => null);
    if (account?.provider === "simkl") {
      const clientId = process.env.SIMKL_CLIENT_ID?.trim();
      if (clientId) return { clientId, accessToken: account.accessToken };
    }
    return null;
  }
  if (
    typeof body.clientId === "string" &&
    typeof body.accessToken === "string" &&
    body.clientId.length >= 8 &&
    body.accessToken.length >= 16
  ) {
    return { clientId: body.clientId.trim(), accessToken: body.accessToken.trim() };
  }
  return null;
}
