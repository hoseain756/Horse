<!-- BEGIN:nextjs-agent-rules -->

## Next.js

Before coding, read the relevant guide under `node_modules/next/dist/docs/` and follow its current APIs and deprecation notices.

`next dev` regenerates this block; its source is `node_modules/next/dist/server/lib/generate-agent-files.js`.

<!-- END:nextjs-agent-rules -->

## Flutter mobile app (`mobile_app/`)

- Keep mobile work inside `mobile_app/`; organize code by feature, with shared services, models, and design tokens under `lib/core` and reusable widgets under `lib/shared`.
- Build responsive layouts for phones and tablets, support Arabic RTL, and preserve the fixed Horse design system and existing navigation behavior.
- Keep screens connected to the existing Horse APIs; preserve add-on, account sync, library, and playback flows when changing UI or state.
- Before shipping, run `flutter analyze lib --no-pub` and build the Android release APK with `flutter build apk --release` (or the repository's documented Gradle fallback).
- Do not commit credentials, signing keys, generated build output, or local environment files. Store provider secrets only in platform secure storage.
