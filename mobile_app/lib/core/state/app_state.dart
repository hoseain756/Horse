import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/providers_api.dart';
import '../api/supabase_api.dart';
import '../data/catalog_repository.dart';
import '../models/addon.dart';
import '../models/media_item.dart';

/// Central app state. Offline-first: local storage is the source of truth,
/// Supabase (when configured + signed in) mirrors the snapshot in the
/// background. Catalogs and streams always come straight from the add-ons.
class AppState extends ChangeNotifier {
  AppState(this.catalogs, this.supabase, this.providers);

  final CatalogRepository catalogs;
  final SupabaseApi supabase;
  final ProvidersApi providers;

  SharedPreferences? _preferences;
  bool initialized = false;
  bool syncing = false;
  bool _syncAgain = false;
  bool english = false;
  Map<String, dynamic>? horseUser;
  Map<String, Map<String, dynamic>> linkedServices = {};
  Map<String, dynamic>? debridUser;
  List<Addon> addons = [];
  List<MediaItem> watchlist = [];
  List<WatchHistoryEntry> history = [];
  final Map<String, Map<String, dynamic>> _continueWatching = {};

  bool get syncEnabled => supabase.isConfigured && supabase.isSignedIn;

  bool contains(MediaItem item) =>
      watchlist.any((entry) => entry.id == item.id);
  int get watchedCount => history.length;
  List<WatchHistoryEntry> get continueWatching => history
      .where(
        (entry) =>
            entry.durationMs > 0 &&
            entry.positionMs > 0 &&
            entry.positionMs < entry.durationMs - 120000,
      )
      .take(12)
      .toList();
  double get watchedHours =>
      history.fold<double>(0, (sum, entry) => sum + entry.positionMs) / 3600000;

  Future<void> initialize() async {
    await providers.initialize();
    await supabase.initialize();
    _preferences = await SharedPreferences.getInstance();
    english = _preferences!.getBool('horse.mobile.english') ?? false;
    linkedServices = _decodeMap(
      _preferences!.getString('horse.mobile.linked-services'),
    );
    final savedDebridUser = _preferences!.getString('horse.mobile.debrid.user');
    if (savedDebridUser != null && providers.debridService != null) {
      try {
        debridUser =
            Map<String, dynamic>.from(jsonDecode(savedDebridUser) as Map);
      } catch (_) {
        debridUser = null;
      }
    }
    if (providers.debridUser != null) debridUser = providers.debridUser;
    addons = _decodeList(
      _preferences!.getString('horse.mobile.addons'),
      Addon.fromJson,
    );
    watchlist = _decodeList(
      _preferences!.getString('horse.mobile.watchlist'),
      MediaItem.fromJson,
    );
    history = _decodeList(
      _preferences!.getString('horse.mobile.history'),
      WatchHistoryEntry.fromJson,
    );
    _continueWatching.addAll(
      _decodeMap(_preferences!.getString('horse.mobile.cw')),
    );
    initialized = true;
    notifyListeners();

    if (syncEnabled) {
      horseUser = {
        'id': supabase.accountId,
        'email': supabase.accountEmail,
      };
      try {
        await _pullSnapshot(merge: true);
      } catch (_) {
        // Local data is the offline fallback.
      }
    }
    await _persist();
    notifyListeners();
  }

  Future<void> setLanguage(bool useEnglish) async {
    english = useEnglish;
    await _preferences?.setBool('horse.mobile.english', useEnglish);
    notifyListeners();
  }

  // ── Account (Supabase) ──────────────────────────────────────────────────

  Future<void> loginHorse(String email, String password) async {
    final user = await supabase.signIn(email, password);
    horseUser = user == null
        ? null
        : {
            'id': supabase.accountId,
            'email': supabase.accountEmail,
            ...user,
          };
    if (syncEnabled) await _pullSnapshot(merge: true);
    notifyListeners();
  }

  Future<void> registerHorse(String email, String password, String name) async {
    final user = await supabase.signUp(email, password, name);
    horseUser = user == null
        ? null
        : {
            'id': supabase.accountId,
            'email': supabase.accountEmail,
            ...user,
          };
    if (syncEnabled) {
      await _pushSnapshot();
      await _pullSnapshot(merge: true);
    }
    notifyListeners();
  }

  Future<void> logoutHorse() async {
    await supabase.signOut();
    horseUser = null;
    notifyListeners();
  }

  Future<void> configureSupabase(String url, String anonKey) async {
    await supabase.configure(url, anonKey);
    notifyListeners();
  }

  // ── Linked services (direct provider flows) ────────────────────────────

  Future<void> saveLinkedService(
    String service,
    Map<String, dynamic> account,
  ) async {
    linkedServices = {
      ...linkedServices,
      service: Map<String, dynamic>.from(account),
    };
    await _preferences?.setString(
      'horse.mobile.linked-services',
      _encode(linkedServices),
    );
    notifyListeners();
  }

  Future<void> unlinkService(String service) async {
    try {
      if (service == 'trakt') {
        await providers.traktUnlink();
      } else if (service == 'simkl') {
        await providers.simklUnlink();
      }
    } catch (_) {
      // Local unlink must always succeed.
    }
    linkedServices = {...linkedServices}..remove(service);
    await _preferences?.setString(
      'horse.mobile.linked-services',
      _encode(linkedServices),
    );
    notifyListeners();
  }

  Future<(int, int)> syncLinkedService(String service) async {
    final List<Map<String, dynamic>> watchlistItems;
    final List<Map<String, dynamic>> historyItems;
    if (service == 'trakt') {
      watchlistItems = await providers.traktWatchlist();
      historyItems = await providers.traktHistory();
    } else if (service == 'simkl') {
      watchlistItems = await providers.simklWatchlist();
      historyItems = await providers.simklHistory();
    } else {
      return (0, 0);
    }
    final importedWatchlist = watchlistItems
        .map(
          (entry) => MediaItem.fromJson({
            'id': entry['id'],
            'type': entry['type'],
            'name': entry['name'],
            if (entry['year'] != null) 'releaseInfo': entry['year'].toString(),
          }),
        )
        .where((item) => item.id.isNotEmpty)
        .toList();
    final importedHistory = historyItems
        .map((entry) {
          final item = MediaItem.fromJson({
            'id': entry['id'],
            'type': entry['type'],
            'name': entry['name'],
          });
          return WatchHistoryEntry(
            item: item,
            watchedAt: (entry['watchedAt'] as num?)?.toInt() ??
                (entry['t'] as num?)?.toInt() ??
                DateTime.now().millisecondsSinceEpoch,
            videoId: entry['videoId'] as String?,
            season: (entry['season'] as num?)?.toInt(),
            episode: (entry['episode'] as num?)?.toInt(),
          );
        })
        .where((entry) => entry.item.id.isNotEmpty)
        .toList();
    final oldWatchlistLength = watchlist.length;
    final oldHistoryLength = history.length;
    watchlist = _mergeBy(watchlist, importedWatchlist, (item) => item.id);
    history = _mergeBy(
      history,
      importedHistory,
      (entry) => entry.item.id,
    ).take(200).toList();
    await _persistAndSync();
    return (
      watchlist.length - oldWatchlistLength,
      history.length - oldHistoryLength,
    );
  }

  // ── Debrid (direct) ─────────────────────────────────────────────────────

  Future<void> configureDebrid(String service, String apiKey) async {
    await providers.saveDebridKey(service, apiKey.trim());
    debridUser = providers.debridUser;
    await _preferences?.setString(
      'horse.mobile.debrid.user',
      _encode(debridUser),
    );
    notifyListeners();
  }

  Future<void> disconnectDebrid() async {
    await providers.clearDebridKey();
    debridUser = null;
    await _preferences?.remove('horse.mobile.debrid.user');
    notifyListeners();
  }

  Future<void> scrobble({
    required String action,
    required double progress,
    required String imdbId,
    required String type,
    int? season,
    int? episode,
  }) async {
    if (!RegExp(r'^tt\d+$').hasMatch(imdbId)) return;
    unawaited(
      providers.traktScrobble(
        action: action,
        progress: progress,
        imdbId: imdbId,
        type: type,
        season: season,
        episode: episode,
      ),
    );
    unawaited(
      providers.simklScrobble(
        progress: progress,
        imdbId: imdbId,
        type: type,
        season: season,
        episode: episode,
      ),
    );
  }

  // ── Add-ons ─────────────────────────────────────────────────────────────

  Future<void> installAddon(String url) async {
    final manifest = await catalogs.manifest(url);
    final normalizedUrl = _normalizeManifestUrl(url);
    final next = addons.where((addon) => addon.id != manifest['id']).toList()
      ..add(
        Addon(
          id: manifest['id'].toString(),
          name: manifest['name'].toString(),
          transportUrl: normalizedUrl,
          manifest: manifest,
          order: addons.length,
        ),
      );
    addons = next;
    await _saveAddons();
  }

  Future<void> removeAddon(String id) async {
    addons = addons.where((addon) => addon.id != id).toList();
    await _saveAddons();
  }

  Future<void> setAddonEnabled(String id, bool enabled) async {
    addons = addons
        .map(
          (addon) => addon.id == id ? addon.copyWith(enabled: enabled) : addon,
        )
        .toList();
    await _saveAddons();
  }

  Future<void> moveAddon(String id, int delta) async {
    final index = addons.indexWhere((addon) => addon.id == id);
    final target = index + delta;
    if (index < 0 || target < 0 || target >= addons.length) return;
    final reordered = [...addons];
    final item = reordered.removeAt(index);
    reordered.insert(target, item);
    addons = [
      for (var i = 0; i < reordered.length; i++)
        reordered[i].copyWith(order: i),
    ];
    await _saveAddons();
  }

  // ── Watchlist / history ─────────────────────────────────────────────────

  Future<void> toggleWatchlist(MediaItem item) async {
    watchlist = contains(item)
        ? watchlist.where((entry) => entry.id != item.id).toList()
        : [item, ...watchlist];
    await _persistAndSync();
  }

  Future<void> recordPlayback(
    MediaItem item, {
    required int positionMs,
    required int durationMs,
    String? videoId,
    int? season,
    int? episode,
  }) async {
    final entry = WatchHistoryEntry(
      item: item,
      watchedAt: DateTime.now().millisecondsSinceEpoch,
      positionMs: positionMs,
      durationMs: durationMs,
      videoId: videoId,
      season: season,
      episode: episode,
    );
    history = [
      entry,
      ...history.where((h) => h.item.id != item.id),
    ].take(200).toList();
    if (durationMs > 0 && positionMs < durationMs - 120000) {
      _continueWatching[item.id] = {
        'id': item.id,
        'type': item.type,
        'name': item.name,
        if (item.poster != null) 'poster': item.poster,
        if (item.background != null) 'background': item.background,
        'positionMs': positionMs,
        'durationMs': durationMs,
        't': entry.watchedAt,
        if (videoId != null) 'videoId': videoId,
        if (season != null) 'season': season,
        if (episode != null) 'episode': episode,
      };
    } else {
      _continueWatching.remove(item.id);
    }
    await _persistAndSync();
  }

  Future<void> clearHistory() async {
    history = [];
    _continueWatching.clear();
    await _persistAndSync();
  }

  // ── Persistence + Supabase mirror ───────────────────────────────────────

  Future<void> _saveAddons() async {
    await _persist();
    await _pushSnapshot();
    notifyListeners();
  }

  Future<void> _persistAndSync() async {
    await _persist();
    await _pushSnapshot();
    notifyListeners();
  }

  Future<void> _persist() async {
    await _preferences?.setString(
      'horse.mobile.addons',
      _encode(addons.map((e) => e.toJson()).toList()),
    );
    await _preferences?.setString(
      'horse.mobile.watchlist',
      _encode(watchlist.map((e) => e.toJson()).toList()),
    );
    await _preferences?.setString(
      'horse.mobile.history',
      _encode(history.map((e) => e.toJson()).toList()),
    );
    await _preferences?.setString(
      'horse.mobile.cw',
      _encode(_continueWatching),
    );
  }

  Future<void> _pushSnapshot() async {
    if (!syncEnabled) return;
    if (syncing) {
      _syncAgain = true;
      return;
    }
    syncing = true;
    try {
      do {
        _syncAgain = false;
        final snapshot = {
          'v': 1,
          'settings': {'uiLanguage': english ? 'en' : 'ar'},
          'addons': addons.map((e) => e.toJson()).toList(),
          'removedAddons': <dynamic>[],
          'cw': _continueWatching,
          'watchlist': watchlist
              .map(
                (e) => {
                  ...e.toJson(),
                  't': DateTime.now().millisecondsSinceEpoch,
                },
              )
              .toList(),
          'history': history.map((e) => e.toJson()).toList(),
          'lists': <dynamic>[],
          'updatedAt': DateTime.now().toUtc().toIso8601String(),
        };
        await supabase.pushSnapshot(snapshot);
      } while (_syncAgain);
    } catch (_) {
      // The local copy remains current and the next change retries the sync.
    } finally {
      syncing = false;
    }
  }

  Future<void> _pullSnapshot({required bool merge}) async {
    final snapshot = await supabase.pullSnapshot();
    if (snapshot == null) return;
    final remoteAddons = (snapshot['addons'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Addon.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final remoteWatchlist = (snapshot['watchlist'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => MediaItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final remoteHistory = (snapshot['history'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => WatchHistoryEntry.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    if (merge) {
      addons = _mergeBy(addons, remoteAddons, (e) => e.id);
      watchlist = _mergeBy(watchlist, remoteWatchlist, (e) => e.id);
      history = _mergeBy(history, remoteHistory, (e) => e.item.id);
    } else {
      addons = remoteAddons;
      watchlist = remoteWatchlist;
      history = remoteHistory;
    }
    if (snapshot['cw'] is Map) {
      _continueWatching.addAll(
        Map<String, dynamic>.from(snapshot['cw'] as Map).map(
          (key, value) =>
              MapEntry(key, Map<String, dynamic>.from(value as Map)),
        ),
      );
    }
    await _persist();
    await _pushSnapshot();
  }

  List<T> _mergeBy<T>(List<T> local, List<T> remote, String Function(T) keyOf) {
    final result = <T>[];
    final seen = <String>{};
    for (final item in [...local, ...remote]) {
      if (seen.add(keyOf(item))) result.add(item);
    }
    return result;
  }

  List<T> _decodeList<T>(String? raw, T Function(Map<String, dynamic>) decode) {
    if (raw == null) return [];
    try {
      return (List<dynamic>.from(_decode(raw) as List))
          .whereType<Map>()
          .map((e) => decode(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Map<String, Map<String, dynamic>> _decodeMap(String? raw) {
    if (raw == null) return {};
    try {
      return Map<String, dynamic>.from(_decode(raw) as Map).map(
        (key, value) => MapEntry(key, Map<String, dynamic>.from(value as Map)),
      );
    } catch (_) {
      return {};
    }
  }

  dynamic _decode(String raw) => jsonDecode(raw);

  String _encode(Object? value) => jsonEncode(value);

  String _normalizeManifestUrl(String raw) {
    var url = raw.trim().replaceFirst(
          RegExp(r'^stremio://', caseSensitive: false),
          'https://',
        );
    url = url
        .replaceFirst(RegExp(r'/configure/?$'), '')
        .replaceFirst(RegExp(r'/+$'), '');
    return url.endsWith('manifest.json') ? url : '$url/manifest.json';
  }
}
