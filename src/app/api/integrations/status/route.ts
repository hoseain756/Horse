// Harbor Web — Integrations status probe (Home "Connect services" strip)
// GET → which server-side credentials are configured. Reports ONLY booleans —
// never echoes any secret value. No auth needed: the response leaks nothing
// beyond "a key exists or not".
import { NextResponse } from "next/server";
import { resolveTraktClientId } from "@/lib/harbor/trakt-server";
import { resolveSimklClientId } from "@/lib/harbor/simkl-server";

export const dynamic = "force-dynamic";

function has(...names: string[]): boolean {
  return names.some((n) => typeof process.env[n] === "string" && process.env[n]!.trim().length > 0);
}

export async function GET() {
  // Trakt/Simkl: env var OR the DB-backed ServerConfig row (survives .env resets)
  const [traktId, simklId] = await Promise.all([resolveTraktClientId(), resolveSimklClientId()]);
  return NextResponse.json(
    {
      tmdb: has("TMDB_ACCESS_TOKEN", "TMDB_API_KEY"),
      // PKCE-era Trakt apps have NO client secret — the ID alone is enough
      trakt: !!traktId,
      // Simkl needs only the client id to mint PINs (a confidential app's
      // secret is only consulted at token-exchange time)
      simkl: !!simklId,
      omdb: has("OMDB_API_KEY"),
      mdblist: has("MDBLIST_API_KEY"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
