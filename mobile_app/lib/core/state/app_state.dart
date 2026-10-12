import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/horse_api.dart';
import '../data/catalog_repository.dart';
import '../models/addon.dart';
import '../models/media_item.dart';

class AppState extends ChangeNotifier {
  AppState(this.api, this.catalogs);

  final HorseApi api;
  final CatalogRepository catalogs;
  SharedPreferences? _preferences;
  bool initialized = false;
  bool syncing = false;
  bool _syncAgain = false;
  bool english = false;
  Map<String, dynamic>? horseUser;
  Map<String, dynamic>? stremioUser;
  Map<String, Map<String, dynamic>> linkedServices = {};
  Map<String, dynamic>? debridUser;
  List<Addon> addons = [];
  List<MediaItem> watchlist = [];
  List<WatchHistoryEntry> history = [];
  final Map<String, Map<String, dynamic>> _continueWatching = {};

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
    await api.initialize();
    _preferences = await SharedPreferences.getInstance();
    english = _preferences!.getBool('horse.mobile.english') ?? false;
    linkedServices = _decodeMap(
      _preferences!.getString('horse.mobile.linked-services'),
    );
    final savedDebridUser = _preferences!.getString('horse.mobile.debrid.user');
    if (savedDebridUser != null && api.debridService != null) {
      try {
        debridUser =
            Map<String, dynamic>.from(jsonDecode(savedDebridUser) as Map);
      } catch (_) {
        debridUser = null;
      }
    }
    final device = _deviceId();
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
    if (api.stremioAuthKey != null) {
      stremioUser = {
        'email':
            _preferences!.getString('horse.mobile.stremio.email') ?? 'Stremio',
      };
    }

    try {
      final me = await api.horseMe();
      if (me['authenticated'] == true && me['user'] is Map) {
        horseUser = Map<String, dynamic>.from(me['user'] as Map);
      }
    } catch (_) {
      // Public browsing stays available if the account endpoint is offline.
    }

    try {
      final result = await api.loadSnapshot(device);
      final snapshot = Map<String, dynamic>.from(
        result['snapshot'] as Map? ?? const {},
      );
      final remoteAddons = (snapshot['addons'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => Addon.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      final remoteWatchlist = (snapshot['watchlist'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => MediaItem.fromJson(Map<String, dynamic>.from(e)))
          .where((e) => e.id.isNotEmpty)
          .toList();
      final remoteHistory = (snapshot['history'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => WatchHistoryEntry.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      if (addons.isEmpty) addons = remoteAddons;
      if (watchlist.isEmpty) watchlist = remoteWatchlist;
      if (history.isEmpty) history = remoteHistory;
      if (_continueWatching.isEmpty && snapshot['cw'] is Map) {
        _continueWatching.addAll(
          Map<String, dynamic>.from(snapshot['cw'] as Map).map(
            (key, value) =>
                MapEntry(key, Map<String, dynamic>.from(value as Map)),
          ),
        );
      }
    } catch (_) {
      // Local data is the offline fallback.
    }

    if (api.stremioAuthKey != null) {
      try {
        final remote = await api.loadStremioAddons();
        final parsed = remote
            .whereType<Map>()
            .map((e) => Addon.fromJson(Map<String, dynamic>.from(e)))
            .where((e) => e.id.isNotEmpty)
            .toList();
        if (parsed.isNotEmpty) addons = parsed;
      } catch (_) {
        // Preserve the last local/server snapshot if Stremio is unavailable.
      }
    }
    await _persist();
    notifyListeners();
  }

  String _deviceId() {
    var value = _preferences?.getString('horse.mobile.device');
    if (value == null || value.length < 8) {
      const chars =
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      final random = Random.secure();
      value =
          'horse_${List.generate(22, (_) => chars[random.nextInt(chars.length)]).join()}';
      _preferences?.setString('horse.mobile.device', value);
    }
    return value;
  }

  Future<void> setLanguage(bool useEnglish) async {
    english = useEnglish;
    await _preferences?.setBool('horse.mobile.english', useEnglish);
    notifyListeners();
  }

  Future<void> setServer(String value) async {
    await api.setServerUrl(value);
    try {
      final health = await api.getJson('/api/health');
      if (health['ok'] != true) {
        throw const FormatException('تعذر الاتصال بخادم Horse.');
      }
      final me = await api.horseMe();
      horseUser = me['authenticated'] == true && me['user'] is Map
          ? Map<String, dynamic>.from(me['user'] as Map)
          : null;
      await _pullSnapshot(merge: true);
      notifyListeners();
    } catch (_) {
      rethrow;
    }
  }

  Future<void> loginHorse(String email, String password) async {
    final data = await api.loginHorse(email, password);
    horseUser = Map<String, dynamic>.from(data['user'] as Map? ?? const {});
    await _pullSnapshot(merge: true);
    notifyListeners();
  }

  Future<void> registerHorse(String email, String password, String name) async {
    final data = await api.registerHorse(email, password, name);
    horseUser = Map<String, dynamic>.from(data['user'] as Map? ?? const {});
    await _pullSnapshot(merge: true);
    notifyListeners();
  }

  Future<void> logoutHorse() async {
    await api.logoutHorse();
    horseUser = null;
    notifyListeners();
  }

  Future<void> loginStremio(String email, String password) async {
    stremioUser = await api.loginStremio(email, password);
    await _preferences?.setString('horse.mobile.stremio.email', email.trim());
    final remote = await api.loadStremioAddons();
    final parsed = remote
        .whereType<Map>()
        .map((e) => Addon.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.id.isNotEmpty)
        .toList();
    if (parsed.isNotEmpty) addons = parsed;
    await _persist();
    notifyListeners();
  }

  Future<void> logoutStremio() async {
    await api.logoutStremio();
    await _preferences?.remove('horse.mobile.stremio.email');
    stremioUser = null;
    notifyListeners();
  }

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
    final account = linkedServices[service];
    if (account != null) {
      try {
        await api.unlinkService(service, account['linkId'].toString());
      } catch (_) {
        // Clear the local link even if the server has already removed it.
      }
    }
    linkedServices = {...linkedServices}..remove(service);
    await _preferences?.setString(
      'horse.mobile.linked-services',
      _encode(linkedServices),
    );
    notifyListeners();
  }

  Future<(int, int)> syncLinkedService(String service) async {
    final account = linkedServices[service];
    if (account == null) return (0, 0);
    final (watchlistItems, historyItems) = await api.syncLinkedService(
      service,
      account['linkId'].toString(),
    );
    final importedWatchlist = watchlistItems
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
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
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .map((entry) {
          final item = MediaItem.fromJson({
            'id': entry['id'],
            'type': entry['type'],
            'name': entry['name'],
          });
          return WatchHistoryEntry(
            item: item,
            watchedAt: (entry['watchedAt'] as num?)?.toInt() ?? 0,
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

  Future<void> configureDebrid(String service, String apiKey) async {
    debridUser = await api.saveDebridKey(service, apiKey.trim());
    await _preferences?.setString(
      'horse.mobile.debrid.user',
      _encode(debridUser),
    );
    notifyListeners();
  }

  Future<void> disconnectDebrid() async {
    await api.clearDebridKey();
    debridUser = null;
    await _preferences?.remove('horse.mobile.debrid.user');
    notifyListeners();
  }

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

  Future<void> _saveAddons() async {
    await _persist();
    if (api.stremioAuthKey != null) {
      await api.saveStremioAddons(
        addons.map((addon) => addon.toJson()).toList(),
      );
    }
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
        await api.saveSnapshot(_deviceId(), snapshot);
      } while (_syncAgain);
    } catch (_) {
      // The local copy remains current and the next change retries the sync.
    } finally {
      syncing = false;
    }
  }

  Future<void> _pullSnapshot({required bool merge}) async {
    final result = await api.loadSnapshot(_deviceId());
    final snapshot = Map<String, dynamic>.from(
      result['snapshot'] as Map? ?? const {},
    );
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

  dynamic _decode(String raw) {
    // SharedPreferences JSON is decoded here to keep serialization in one place.
    return jsonDecode(raw);
  }

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
