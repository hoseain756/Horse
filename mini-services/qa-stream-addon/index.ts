// QA-only mini service — dynamic Stremio stream addon used by the agent-browser
// E2E tests (NOT shipped to users as content: it serves whatever infoHash the
// test seeded in /tmp/qa-infohash.json as {infoHash, filename?, title?}).
// Port 3033. Run: bun run dev (bun --hot index.ts)
import type Bun from "bun";

const PORT = 3033;
const INFOHASH_FILE = "/tmp/qa-infohash.json";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const manifest = {
  id: "qa-browser-engine",
  name: "QA Browser Engine",
  version: "1.0.0",
  description: "Local QA addon that serves the seeded test torrent (agent-browser E2E only)",
  types: ["movie", "series"],
  resources: ["stream"],
  catalogs: [],
  idPrefixes: ["tt"],
};

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0", // reachable via the sandbox's non-private IP (21.0.18.63) — the app's SSRF-safe proxy refuses loopback targets
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (p === "/manifest.json") {
      return Response.json(manifest, { headers: cors });
    }

    if (p === "/sample.mp4") {
      const f = Bun.file(new URL("./sample.mp4", import.meta.url).pathname);
      return new Response(f, {
        headers: { ...cors, "Content-Type": "video/mp4", "Content-Length": String(f.size) },
      });
    }

    // Catch-all stream route: /stream/movie/ttXXXX.json / /stream/series/ttX:1:1.json
    const m = /^\/stream\/(movie|series)\/([^/]+)\.json$/.exec(p);
    if (m) {
      let seeded: { infoHash?: string; filename?: string; title?: string } = {};
      try {
        seeded = await Bun.file(INFOHASH_FILE).json();
      } catch {
        seeded = {};
      }
      const infoHash = typeof seeded.infoHash === "string" ? seeded.infoHash : null;
      if (!infoHash) {
        return Response.json({ streams: [] }, { headers: cors });
      }
      return Response.json(
        {
          streams: [
            {
              infoHash,
              title: seeded.title ?? "QA · debrid test torrent (H.264/AAC mp4)",
              behaviorHints: {
                filename: seeded.filename ?? "qa-sample.mp4",
                notWebReady: false,
              },
            },
          ],
        },
        { headers: cors },
      );
    }

    return new Response("not found", { status: 404, headers: cors });
  },
});

console.log(`[qa-stream-addon] listening on http://127.0.0.1:${PORT}`);
