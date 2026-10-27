// Harbor Web — torrent-service shared config
// First-run wizard state lives in engine.config.json (gitignored, per machine).
// Precedence for the running engine: env vars > config file > built-in defaults,
// so Docker/PaaS deployments (ENGINE_PORT / ENGINE_HOST) keep working unchanged.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ENGINE_DIR = __dirname;
export const CONFIG_FILE = path.join(ENGINE_DIR, "engine.config.json");
export const PID_FILE = path.join(ENGINE_DIR, "engine.pid");
export const CACHE_DIR = path.join(os.tmpdir(), "harbor-web-torrent-cache");

export const DEFAULTS = Object.freeze({
  port: 3031,
  host: "0.0.0.0", // wizard default: phones on the same Wi-Fi can reach the engine
  startShortcut: "horse-start",
  stopShortcut: "horse-stop",
});

export function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    const cfg = {
      port: clampPort(raw.port ?? DEFAULTS.port),
      host: sanitizeHost(raw.host ?? DEFAULTS.host),
      startShortcut: sanitizeName(raw.startShortcut, DEFAULTS.startShortcut),
      stopShortcut: sanitizeName(raw.stopShortcut, DEFAULTS.stopShortcut),
      installedAt: typeof raw.installedAt === "string" ? raw.installedAt : new Date().toISOString(),
    };
    return cfg;
  } catch {
    return null; // no config yet → wizard (or silent defaults)
  }
}

export function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {}
}

// ---- resolution used by the engine at boot ----
export function resolveEngineSettings(cfg) {
  const envPort = Number.parseInt(process.env.ENGINE_PORT ?? process.env.PORT ?? "", 10);
  const port = Number.isFinite(envPort) && envPort > 0 ? envPort : cfg.port;
  const envHost = (process.env.ENGINE_HOST ?? "").trim();
  const host = envHost || cfg.host || DEFAULTS.host;
  return { port, host };
}

// ---- helpers ----
function clampPort(p) {
  const n = Number.parseInt(p, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return DEFAULTS.port;
  return n;
}

function sanitizeHost(h) {
  const s = String(h ?? "").trim();
  return /^[a-zA-Z0-9.:_-]+$/.test(s) ? s : DEFAULTS.host;
}

function sanitizeName(name, fallback) {
  const s = String(name ?? "").trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/.test(s) ? s : fallback;
}

// IPv4 LAN addresses (for the iPhone/Android banner lines)
export function lanIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) out.push(net.address);
    }
  }
  return [...new Set(out)];
}
