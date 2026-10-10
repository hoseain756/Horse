# Task 72-c — Frontend for QR login + addon transfer codes (full-stack-developer)

## What was built (all additive; backend from 72-b consumed as-is)

### 1. QR sign-in (`chrome/qr-login.tsx`)
- **Big screen**: `QrLoginPanel` = third pill tab ("Sign in with phone" / "الدخول عبر الجوال") in HorseAccountCard's signed-out tablist. Auto-creates a code on tab open (`POST /api/auth/qr/create`), shows white QR plate of `#qrlogin=CODE` (240px, dark `#0b0b0d`), big `XXX-XXX` in `<Bdi>` mono `tracking-[0.22em]` + copy pill + toast, mm:ss countdown (red <60s), 3-step hint row (1-col → `min-[840px]` 3-col), polls `/api/auth/qr/status` every 2.5s (pollToken in a ref only). Regenerate best-effort `deny`s the old code.
- **Approved path**: 1.2s success beat → `useHorseAccount.getState().load()` (cookie was minted by the server ON the poll response) → `onApproved()` prop → HorseAccountCard runs the **SAME** merge-strategy handoff as password login (see below).
- **Denied/expired**: error-container box + Try again. Create failure → toast + retry.
- **Phone side**: `QrApproveDialog` mounted once in app-shell; `openQrApprove(code?)` + `QR_APPROVE_EVENT`; `#qrlogin=` deep link auto-opens with the code and auto-peeks once. Need-login → "Go to sign in" → settings `#settings/account` deep link. Logged-in → deviceHint in a single `<Bdi>` (per-run isolation would flip "Chrome · Windows" in RTL) → Approve (48dp primary) / Deny (ghost-destructive) → success 1.2s → close + toast.
- Manual entry: signed-in account card has a 4th management row "Approve a sign-in code" (`openQrApprove()` empty → input mode).

### 2. Addon transfer (`chrome/addon-transfer.tsx`)
- `AddonTransferDialogs` mounted once in app-shell; `openTransferSender()` / `openTransferReceiver(code?)` / `TRANSFER_RECEIVE_EVENT`.
- **Sender**: gathers `useAddons` state (strips `probe`), `senderHint = UA.slice(0,120)` → `/api/transfer/create` → QR of `#transfer=CODE` + `XXX-XXX-XXX` + copy + 6:00 countdown + cancel (`POST /api/transfer/cancel`). Close-during-create cancels the code once it lands. No polling (single-use is explained in the subtitle).
- **Receiver**: `CodeInput` (3 groups) prefilled from deep link, auto-claims once; `mergeTransferredAddons()` = non-destructive union by `manifest.id` (existing local wins), uses the store's own `persistAddons()` (key `harbor-web.installed-addons`), `clearAddonRemoval()` per addition (tombstones cleared → additions survive sync merges), `useAddons.load()`, toasts `transferSuccess`/`transferPartial`, close. `already`→`transferAlready`, `missing`→`transferInvalid`.
- **Entry**: two outline buttons after the addons install bar (heights exactly `md:!h-14 md:px-8 !h-12`); "Transfer addons" disabled at 0 addons.

### 3. Merge-strategy handoff — REUSED, not duplicated
`handleQrApproved()` gates on the same `hasLocalData()` as password login: no local data → silent `"merge"`; local data present → the EXISTING `mergeOpen`/`mergeChoice` dialog markup re-used via a `qrMergePending` flag (confirm + local-wins AlertDialog branch on it). `runQrMerge(strategy)` replicates login()'s post-cookie sequence exactly: `local` → `pushNow(true)`; else `mergeAccountSnapshotIntoLocal(strategy)` → `pushNow(true)` → same toasts. `horse-account.ts` untouched.

### 4. Shared primitives (`chrome/code-input.tsx`)
`formatCodeGroups(raw, 2|3)`, `<CodeInput>` (dir=ltr mono auto-format), `<CodeCountdown>` (PairCountdown clone, text-xs, red <60s).

## Files
- NEW: `src/components/harbor/chrome/{code-input,qr-login,addon-transfer}.tsx`
- MODIFIED: `chrome/app-shell.tsx` (+`#qrlogin=`/`#transfer=` hash consumers, +2 dialog mounts; `#pair=` untouched), `views/settings-view.tsx` (QR tab, qrMergePending handoff, approve row), `views/addons-view.tsx` (2 buttons), `lib/harbor/i18n.ts` (+45 keys), `lib/harbor/store.ts` (`export persistAddons` only)
- UNTOUCHED: all API routes, prisma schema, middleware, device-pairing.tsx, globals.css

## i18n (45 keys, {en,ar})
qrTabTitle, qrLoginHint, qrLoginStep1-3, qrCodeLabel, qrWaiting, qrApproved, qrDenied, qrExpired, qrTryAgain, qrNewCode, qrCreateFailed, qrCodeCopied, qrApproveTitle, qrApproveEnterCode, qrApproveDesc, qrApproveConfirm, qrApproveDeny, qrApproveNeedLogin, qrApproveNeedLoginDesc, qrApproveGoLogin, qrApproveCheck, qrApproveChecking, qrApproveSuccess, qrApproveInvalid, qrApproveUsed, qrApproveFailed, qrApproveOpenRow, transferAction, transferSendTitle, transferSendDesc, transferSendCount, transferReceiverTitle, transferReceiverDesc, transferEnterCode, transferWaiting, transferClaimBtn, transferClaiming, transferSuccess, transferPartial, transferInvalid, transferAlready, transferCopied, transferCancel, transferCreateFailed, transferFailed, transferEmpty. All counts via `tr.num()`; reused `pairStarting` for generating states; `qrOpenOnPhone` skipped per brief.

## Gotchas for the next agent
- eslint (Next 16 react-hooks) ERRORS on synchronous setState inside effects — deferred pattern `const id = setTimeout(() => void action(), 0)` is used in the three auto-run effects (GuestSyncPrompt precedent).
- `harbor:settings-section` detail "account" is NOT in shell.tsx LEGACY_MAP → the event silently drops it; navigate with `window.location.hash = "#settings/account"` instead.
- Sender "creating" phase relies on mount-on-open (`{sendOpen && <TransferSenderDialog open …/>}`) for fresh state — do not convert to persistent mount without restoring the sync resets.
- Deep-link regexes are strict: `#qrlogin=` 6 alnum, `#transfer=` 9 alnum (codes are raw, dashes are display-only).

## Gates (all green)
- `bunx tsc --noEmit`: 14 errors, all pre-existing in unrelated files; 0 new.
- `bun run lint`: 0 errors / 157 warnings (pre-existing count unchanged); targeted eslint on touched files → 0 errors.
- `GET /` → 200; live curl E2E: QR create→peek→approve→used + transfer create→claim→already→cancel→missing (throwaway account deleted after).
- Not committed to git (per instruction).
