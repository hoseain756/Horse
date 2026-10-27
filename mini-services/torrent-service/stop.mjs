// Harbor Web — torrent-service stop & clean (bound to `horse-stop` by setup)
// 1) stops a running engine (PID file first, port scan as fallback)
// 2) wipes the download cache (os.tmpdir()/harbor-web-torrent-cache)
// 3) removes stale pid file
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PID_FILE, CACHE_DIR, readConfig } from "./config.mjs";

const C = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const ok = (s) => console.log(` ${C.green("✔")} ${s}`);
const warn = (s) => console.log(` ${C.yellow("⚠")} ${s}`);
const dim = (s) => console.log(` ${C.dim(s)}`);

function pidAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = existence probe
    return true;
  } catch (e) {
    return e?.code === "EPERM"; // EPERM → exists but owned by someone else
  }
}

function looksLikeEngine(pid) {
  // Guard against recycled PIDs: verify the process cmdline mentions our engine.
  try {
    if (process.platform === "win32") {
      const out = execFileSync("wmic", ["process", "where", `ProcessId=${pid}`, "get", "CommandLine"], { encoding: "utf8" });
      return /torrent-service|index\.mjs/i.test(out);
    }
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return /torrent-service|index\.mjs/i.test(cmd);
  } catch {
    return false; // can't verify → treat as not-ours
  }
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      return;
    }
    process.kill(pid, "SIGTERM");
    for (let i = 0; i < 20 && pidAlive(pid); i++) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); // sleep 100ms
    }
    if (pidAlive(pid)) process.kill(pid, "SIGKILL");
  } catch {}
}

function pidsOnPort(port) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
      for (const line of out.split("\n")) {
        const cols = line.trim().split(/\s+/);
        if (cols.length >= 5 && cols[1]?.endsWith(`:${port}`) && /^\d+$/.test(cols[4])) pids.add(Number(cols[4]));
      }
    } else {
      try {
        const out = execFileSync("lsof", ["-t", "-i", `tcp:${port}`, "-s", "tcp:listen"], { encoding: "utf8" });
        for (const p of out.split(/\s+/).filter(Boolean)) pids.add(Number(p));
      } catch {
        // lsof missing → fuser fallback
        const out = execFileSync("fuser", [`${port}/tcp`], { encoding: "utf8" }).trim();
        for (const p of out.split(/\s+/).filter(Boolean)) pids.add(Number(p));
      }
    }
  } catch {}
  return [...pids];
}

function wipeCache() {
  let bytes = 0;
  try {
    bytes = dirSize(CACHE_DIR);
  } catch {}
  try {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    return bytes;
  } catch {
    return -1;
  }
}

function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let stat;
    try {
      stat = fs.statSync(cur);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(cur)) stack.push(path.join(cur, entry));
    } else {
      total += stat.size;
    }
  }
  return total;
}

function fmtBytes(n) {
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function stopAndClean() {
  const cfg = readConfig() ?? { port: 3031 };
  let killed = 0;

  // 1) PID file (primary — written by the engine at boot)
  try {
    const pid = Number.parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      if (pidAlive(pid) && looksLikeEngine(pid)) {
        killPid(pid);
        killed++;
        ok(`تم إيقاف المحرك (PID ${pid})`);
      } else {
        dim(`PID ${pid} في الملف قديم — تجاهله`);
      }
    }
    fs.rmSync(PID_FILE, { force: true });
  } catch {
    /* no pid file — fine */
  }

  // 2) port scan (fallback — engine started without our pid file, e.g. old install)
  for (const pid of pidsOnPort(cfg.port)) {
    if (pid === process.pid) continue;
    if (looksLikeEngine(pid)) {
      killPid(pid);
      killed++;
      ok(`تم إيقاف محرك على البورت ${cfg.port} (PID ${pid})`);
    }
  }

  if (!killed) ok("لا يوجد محرك يعمل حالياً");

  // 3) cache wipe
  const freed = wipeCache();
  if (freed >= 0) ok(`تم تنظيف الذاكرة المؤقتة (تحرير ${fmtBytes(freed)})`);
  else warn("تعذّر حذف مجلد الكاش — قد يكون مستخدماً بعملية أخرى");

  console.log(`\n ${C.bold("🐴 Horse — تم الإغلاق والتنظيف")} 🧹\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  stopAndClean().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
