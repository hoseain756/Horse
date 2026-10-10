-- Per-service debrid QR linking: PairingCode gains an optional pinned service.
-- When set, the pairing code only accepts claims for that exact debrid service
-- (the QR shown for TorBox cannot be satisfied with an AllDebrid key, etc.).
-- Nullable → legacy codes and generic pairing keep working unchanged.
ALTER TABLE "PairingCode" ADD COLUMN "pinnedService" TEXT;
