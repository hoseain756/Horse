// E2E helper: seal a debrid payload into a pinned pairing row exactly like
// the claim route does after upstream validation (vault AAD pairing:<code>).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const [code, service, apiKey] = process.argv.slice(2);
if (!code || !service || !apiKey) { console.error("usage: e2e-seal <code> <service> <apiKey>"); process.exit(1); }
const { encryptSecret } = await import("../src/lib/harbor/vault.ts");
const payload = { service, apiKey, username: "tvuser", premium: true, expiresAt: null, planName: "Pro" };
const sealed = encryptSecret(JSON.stringify(payload), `pairing:${code}`);
const r = await db.pairingCode.updateMany({
  where: { code, payloadEnc: null, expiresAt: { gt: new Date() } },
  data: { payloadEnc: sealed, claimedAt: new Date() },
});
console.log("sealed rows:", r.count);
await db.$disconnect();
