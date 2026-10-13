/// Build-time + runtime configuration for the Horse mobile app.
///
/// The app never talks to a Horse web server. Its only cloud touchpoints are:
///   • Supabase (Auth + PostgREST) — account, cross-device sync.
///   • The Stremio add-on protocol — catalogs / meta / streams (direct HTTP).
///   • Provider APIs the user connects personally (Trakt / Simkl / TMDB /
///     debrid services) using keys stored in device secure storage.
///
/// Supabase coordinates can be supplied at build time:
///   flutter build apk \
///     --dart-define=HORSE_SUPABASE_URL=https://PROJECT_REF.supabase.co
///     --dart-define=HORSE_SUPABASE_ANON_KEY=ANON_PUBLIC_KEY
/// or at runtime from Settings → Account (stored in shared preferences).
library;

class AppConfig {
  const AppConfig._();

  static const buildUrl = String.fromEnvironment(
    'HORSE_SUPABASE_URL',
    defaultValue: '',
  );
  static const buildAnonKey = String.fromEnvironment(
    'HORSE_SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static const prefsUrlKey = 'horse.mobile.supabase.url';
  static const prefsAnonKeyKey = 'horse.mobile.supabase.anon';

  /// Normalized Supabase project base URL, or null when not configured.
  static String? normalizeUrl(String raw) {
    final value = raw.trim().replaceFirst(RegExp(r'/+$'), '');
    if (value.isEmpty) return null;
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        !{'https', 'http'}.contains(uri.scheme)) {
      return null;
    }
    return value;
  }
}
