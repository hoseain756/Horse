# Horse for Flutter

Native Flutter client for Horse on Android phones, iPhones, and tablets.

## Included features

- Home, Anime, Kids, and My Library as the only primary destinations.
- Bottom navigation on phones and a tablet navigation rail on wider screens.
- Cinemeta and installed Stremio add-on catalogs, metadata, and stream discovery.
- Add-on install, enable/disable, removal, Stremio collection sync, and Horse account sync.
- A native video player for supported HTTP and HLS sources, with seek, playback controls, and orientation handling.
- Watchlist, watch history, playback progress, and viewing statistics.
- Arabic RTL as the default language, English as an option, and the fixed Horse dark-bronze theme.

## Project layout

`lib/core` contains the API client, models, catalog repository, app state, and design tokens. `lib/features` groups each app feature by its screen and related UI. `lib/shared` contains reusable widgets.

## Server

The default server is `https://horse-silk.vercel.app`. Change it from Settings if you host Horse elsewhere. For a build-time override:

```sh
flutter build apk --dart-define=HORSE_API_BASE_URL=https://your-horse.example
```

Content catalogs work without signing in. A Horse account syncs add-ons, watchlist, history, and playback progress across devices. A Stremio account syncs the add-on collection.

## Run and build

```sh
cd mobile_app
flutter pub get
flutter run
flutter build apk --release
flutter build appbundle --release
```

Build the iOS app on macOS with Xcode installed:

```sh
flutter build ios --release
```

Direct HTTP and HLS streams are played by the platform media player. Magnet/torrent sources need a separate reachable torrent engine and are reported as unavailable when no HTTP stream URL is supplied.
