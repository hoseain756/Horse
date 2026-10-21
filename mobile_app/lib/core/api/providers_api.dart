import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Direct, device-side clients for the services a user links personally.
///
/// Everything here used to run on the Horse web server (relay endpoints).
/// The mobile app performs the same flows itself — user credentials live in
/// device secure storage and are only ever sent to the provider's own API.
class ProvidersApi {
  ProvidersApi({SharedPreferences? preferences})
      : _preferences = preferences;

  final FlutterSecureStorage _secure = const FlutterSecureStorage();
  SharedPreferences? _preferences;

  static const _traktIdKey = 'horse.mobile.trakt.client_id';
  static const _traktSecretKey = 'horse.mobile.trakt.client_secret';
  static const _traktTokenKey = 'horse.mobile.trakt.token';
  static const _simklIdKey = 'horse.mobile.simkl.client_id';
  static const _simklSecretKey = 'horse.mobile.simkl.client_secret';
  static const _simklTokenKey = 'horse.mobile.simkl.token';
  static const _tmdbKeyKey = 'horse.mobile.tmdb.key';

  // ── Stored credentials ──────────────────────────────────────────────────

  String? traktClientId;
  String? traktClientSecret;
  Map<String, dynamic>? traktToken;
  String? simklClientId;
  String? simklClientSecret;
  Map<String, dynamic>? simklToken;
  String? tmdbKey;
  String? debridService;
  String? debridApiKey;

  Future<void> initialize() async {
    _preferences ??= await SharedPreferences.getInstance();
    traktClientId = await _secure.read(key: _traktIdKey);
    traktClientSecret = await _secure.read(key: _traktSecretKey);
    traktToken = await _readJson(_traktTokenKey);
    simklClientId = await _secure.read(key: _simklIdKey);
    simklClientSecret = await _secure.read(key: _simklSecretKey);
    simklToken = await _readJson(_simklTokenKey);
    tmdbKey = await _secure.read(key: _tmdbKeyKey);
    debridService = _preferences!.getString('horse.mobile.debrid.service');
    if (debridService != null) {
      debridApiKey = await _secure.read(
        key: 'horse.mobile.debrid.$debridService',
      );
      if (debridApiKey == null) debridService = null;
    }
  }

  // ── Trakt (device-code OAuth, BYO application credentials) ──────────────

  static const _traktApi = 'https://api.trakt.tv';
  static const _traktAuth = 'https://auth.trakt.tv';

  Map<String, String> _traktHeaders([String? token]) => {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': traktClientId ?? '',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<void> saveTraktCredentials(String clientId, String clientSecret) async {
    final id = clientId.trim();
    if (id.isEmpty) {
      throw const FormatException('أدخل Trakt Client ID الخاص بتطبيقك.');
    }
    traktClientId = id;
    traktClientSecret = clientSecret.trim().isEmpty
        ? null
        : clientSecret.trim();
    await _secure.write(key: _traktIdKey, value: id);
    if (traktClientSecret != null) {
      await _secure.write(key: _traktSecretKey, value: traktClientSecret!);
    } else {
      await _secure.delete(key: _traktSecretKey);
    }
  }

  Future<Map<String, dynamic>> traktStartDeviceLink() async {
    if (traktClientId == null) {
      throw const FormatException(
        'أدخل بيانات تطبيق Trakt (Client ID) أولًا.',
      );
    }
    final response = await _call(
      () => Dio().post<Map<String, dynamic>>(
            '$_traktApi/oauth/device/code',
            options: Options(headers: _traktHeaders()),
            data: {'client_id': traktClientId},
          ),
    );
    return Map<String, dynamic>.from(response);
  }

  /// Polls Trakt once. Returns 'authorized' | 'pending' | 'slow_down' |
  /// 'expired' | 'denied' and stores the token on success.
  Future<(String, Map<String, dynamic>?)> traktPollDeviceLink(
    Map<String, dynamic> flow,
  ) async {
    final response = await Dio().post<Map<String, dynamic>>(
      '$_traktApi/oauth/device/token',
      options: Options(
        headers: _traktHeaders(),
        validateStatus: (code) => code != null && code < 500,
      ),
      data: {
        'code': flow['device_code'],
        'client_id': traktClientId,
        'client_secret': traktClientSecret,
      },
    );
    final code = response.statusCode ?? 0;
    if (code == 200 && response.data?['access_token'] != null) {
      final token = Map<String, dynamic>.from(response.data!);
      traktToken = token;
      await _writeJson(_traktTokenKey, token);
      final account = await traktMe();
      return ('authorized', account);
    }
    if (code == 400) return ('pending', null);
    if (code == 409) return ('slow_down', null);
    if (code == 410) return ('expired', null);
    if (code == 418) return ('denied', null);
    throw const FormatException('تعذر التحقق من ربط Trakt.');
  }

  Future<Map<String, dynamic>> traktMe() async {
    final token = await _validTraktToken();
    final response = await _call(
      () => Dio().get<Map<String, dynamic>>(
            '$_traktApi/users/me',
            options: Options(headers: _traktHeaders(token)),
          ),
    );
    return {
      'username': response['username'] ?? '',
      'name': response['name'] ?? '',
      'avatar':
          ((response['images']?['avatar'] as Map?)?['full'] ?? '').toString(),
    };
  }

  Future<List<Map<String, dynamic>>> traktWatchlist() async {
    final token = await _validTraktToken();
    final lists = await Future.wait([
      _traktList('movies', 'movie', token),
      _traktList('shows', 'series', token),
    ]);
    return [...lists[0], ...lists[1]];
  }

  Future<List<Map<String, dynamic>>> _traktList(
    String path,
    String type,
    String token,
  ) async {
    final response = await _call(
      () => Dio().get<List<dynamic>>(
            '$_traktApi/users/me/watchlist/$path',
            options: Options(headers: _traktHeaders(token)),
          ),
    );
    return response.whereType<Map>().map((raw) {
      final entry = Map<String, dynamic>.from(raw);
      final media = Map<String, dynamic>.from(entry[type] as Map? ?? const {});
      final ids = Map<String, dynamic>.from(media['ids'] as Map? ?? const {});
      final id = (ids['imdb'] ?? ids['slug'] ?? '').toString();
      return <String, dynamic>{
        'id': id,
        'type': type,
        'name': media['title']?.toString() ?? '',
        if (media['year'] != null) 'year': media['year'],
        't': DateTime.now().millisecondsSinceEpoch,
      };
    }).where((e) => (e['id'] as String).isNotEmpty).toList();
  }

  Future<List<Map<String, dynamic>>> traktHistory() async {
    final token = await _validTraktToken();
    final response = await _call(
      () => Dio().get<List<dynamic>>(
            '$_traktApi/users/me/history',
            queryParameters: {'limit': 250, 'extended': 'full'},
            options: Options(headers: _traktHeaders(token)),
          ),
    );
    return response.whereType<Map>().map((raw) {
      final entry = Map<String, dynamic>.from(raw);
      final episode = Map<String, dynamic>.from(entry['episode'] as Map? ?? const {});
      final show = Map<String, dynamic>.from(entry['show'] as Map? ?? const {});
      final movie = Map<String, dynamic>.from(entry['movie'] as Map? ?? const {});
      final isEpisode = episode.isNotEmpty;
      final ids = Map<String, dynamic>.from(
        (isEpisode ? show : movie)['ids'] as Map? ?? const {},
      );
      final id = (ids['imdb'] ?? ids['slug'] ?? '').toString();
      final episodeIds =
          Map<String, dynamic>.from(episode['ids'] as Map? ?? const {});
      return <String, dynamic>{
        'id': id,
        'type': isEpisode ? 'series' : 'movie',
        'name': (isEpisode ? show['title'] : movie['title'])?.toString() ?? '',
        if (isEpisode) 'videoId': episodeIds['imdb']?.toString(),
        if (isEpisode) 'season': (episode['season'] as num?)?.toInt(),
        if (isEpisode) 'episode': (episode['number'] as num?)?.toInt(),
        if (isEpisode) 'episodeName': episode['title']?.toString(),
        'watchedAt':
            DateTime.tryParse(entry['watched_at']?.toString() ?? '')
                    ?.millisecondsSinceEpoch ??
                DateTime.now().millisecondsSinceEpoch,
      };
    }).where((e) => (e['id'] as String).isNotEmpty).toList();
  }

  Future<void> traktScrobble({
    required String action,
    required double progress,
    required String imdbId,
    required String type,
    int? season,
    int? episode,
  }) async {
    final token = traktToken?['access_token']?.toString();
    if (token == null) return;
    final body = <String, dynamic>{
      'progress': progress.clamp(0.0, 100.0),
      if (type == 'movie')
        'movie': {
          'ids': {'imdb': imdbId},
        }
      else ...{
        'show': {
          'ids': {'imdb': imdbId},
        },
        'episode': {
          'season': season ?? 1,
          'number': episode ?? 1,
        },
      },
    };
    try {
      await Dio().post<void>(
        '$_traktApi/scrobble/$action',
        options: Options(headers: _traktHeaders(token)),
        data: body,
      );
    } catch (_) {
      // Provider outages must never interrupt playback.
    }
  }

  Future<void> traktUnlink() async {
    if (traktToken?['access_token'] != null && traktClientId != null) {
      try {
        await Dio().post<void>(
          '$_traktAuth/oauth/revoke',
          options: Options(headers: _traktHeaders()),
          data: {
            'token': traktToken!['access_token'],
            'client_id': traktClientId,
            'client_secret': traktClientSecret,
          },
        );
      } catch (_) {
        // Local unlink must always succeed.
      }
    }
    traktToken = null;
    await _secure.delete(key: _traktTokenKey);
  }

  Future<String> _validTraktToken() async {
    final token = traktToken;
    if (token?['access_token'] == null) {
      throw const FormatException('اربط حساب Trakt أولًا.');
    }
    final expiresAt = (token!['created_at'] as num?)?.toInt();
    final expiresIn = (token['expires_in'] as num?)?.toInt() ?? 0;
    if (expiresAt != null &&
        (expiresAt + expiresIn - 120) * 1000 <
            DateTime.now().millisecondsSinceEpoch &&
        traktClientSecret != null) {
      final response = await Dio().post<Map<String, dynamic>>(
        '$_traktAuth/oauth/token',
        options: Options(headers: _traktHeaders()),
        data: {
          'refresh_token': token['refresh_token'],
          'client_id': traktClientId,
          'client_secret': traktClientSecret,
          'grant_type': 'refresh_token',
        },
      );
      if (response.data?['access_token'] != null) {
        final fresh = Map<String, dynamic>.from(response.data!);
        traktToken = fresh;
        await _writeJson(_traktTokenKey, fresh);
        return fresh['access_token'].toString();
      }
    }
    return token['access_token'].toString();
  }

  // ── Simkl (PIN / OAuth-device, BYO application credentials) ─────────────

  static const _simklApi = 'https://api.simkl.com';

  Map<String, String> _simklHeaders([String? token]) => {
        'Content-Type': 'application/json',
        'simkl-api-key': simklClientId ?? '',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<void> saveSimklCredentials(String clientId, String clientSecret) async {
    final id = clientId.trim();
    if (id.isEmpty) {
      throw const FormatException('أدخل Simkl Client ID الخاص بتطبيقك.');
    }
    simklClientId = id;
    simklClientSecret = clientSecret.trim().isEmpty
        ? null
        : clientSecret.trim();
    await _secure.write(key: _simklIdKey, value: id);
    if (simklClientSecret != null) {
      await _secure.write(key: _simklSecretKey, value: simklClientSecret!);
    } else {
      await _secure.delete(key: _simklSecretKey);
    }
  }

  Future<Map<String, dynamic>> simklStartPinLink() async {
    if (simklClientId == null) {
      throw const FormatException('أدخل بيانات تطبيق Simkl أولًا.');
    }
    final response = await _call(
      () => Dio().post<Map<String, dynamic>>(
            '$_simklApi/oauth/pin',
            options: Options(headers: _simklHeaders()),
            data: {'client_id': simklClientId, 'redirect': ''},
          ),
    );
    return Map<String, dynamic>.from(response);
  }

  Future<(String, Map<String, dynamic>?)> simklPollPinLink(
    Map<String, dynamic> flow,
  ) async {
    final deviceCode = flow['device_code']?.toString() ?? '';
    if (deviceCode.isEmpty) return ('expired', null);
    final response = await Dio().post<Map<String, dynamic>>(
      '$_simklApi/oauth/pin/$deviceCode',
      options: Options(
        headers: _simklHeaders(),
        validateStatus: (code) => code != null && code < 500,
      ),
      queryParameters: {
        'client_id': simklClientId,
        if (simklClientSecret != null) 'client_secret': simklClientSecret,
      },
    );
    final code = response.statusCode ?? 0;
    if (code == 200 && response.data?['access_token'] != null) {
      final token = Map<String, dynamic>.from(response.data!);
      simklToken = token;
      await _writeJson(_simklTokenKey, token);
      final account = await simklMe();
      return ('authorized', account);
    }
    if (code == 401) return ('pending', null);
    throw const FormatException('تعذر التحقق من ربط Simkl.');
  }

  Future<Map<String, dynamic>> simklMe() async {
    final token = await _validSimklToken();
    final response = await _call(
      () => Dio().get<Map<String, dynamic>>(
            '$_simklApi/users/settings',
            options: Options(headers: _simklHeaders(token)),
          ),
    );
    final user = Map<String, dynamic>.from(response['user'] as Map? ?? const {});
    return {
      'username': user['name'] ?? '',
      'avatar': ((user['avatar'] ?? '')).toString(),
    };
  }

  Future<List<Map<String, dynamic>>> simklWatchlist() =>
      _simklSync('/sync/watchlist');

  Future<List<Map<String, dynamic>>> simklHistory() =>
      _simklSync('/sync/history');

  Future<List<Map<String, dynamic>>> _simklSync(String path) async {
    final token = await _validSimklToken();
    final response = await _call(
      () => Dio().get<Map<String, dynamic>>(
            '$_simklApi$path',
            options: Options(headers: _simklHeaders(token)),
          ),
    );
    final entries = (response[path.split('/').last] as List? ?? const [])
        .whereType<Map>()
        .map((raw) {
      final entry = Map<String, dynamic>.from(raw);
      final type = entry['type']?.toString() ?? 'movie';
      final media = Map<String, dynamic>.from(
        entry[type] as Map? ?? entry['movie'] as Map? ?? const {},
      );
      final ids = Map<String, dynamic>.from(media['ids'] as Map? ?? const {});
      final imdb = ids['imdb']?.toString();
      final id = (imdb == null || imdb.isEmpty ? 'simkl:${ids['simkl']}' : imdb);
      final episode = entry['episode'] is Map
          ? Map<String, dynamic>.from(entry['episode'] as Map)
          : const <String, dynamic>{};
      return <String, dynamic>{
        'id': id.toString(),
        'type': type == 'show' || type == 'series' ? 'series' : 'movie',
        'name': media['title']?.toString() ?? '',
        if (episode.isNotEmpty) 'videoId': null,
        if (episode.isNotEmpty) 'season': (episode['season'] as num?)?.toInt(),
        if (episode.isNotEmpty)
          'episode': (episode['episode'] as num?)?.toInt(),
        't': DateTime.now().millisecondsSinceEpoch,
      };
    }).where((e) => (e['id'] as String).isNotEmpty).toList();
    return entries;
  }

  Future<void> simklScrobble({
    required double progress,
    required String imdbId,
    required String type,
    int? season,
    int? episode,
  }) async {
    final token = simklToken?['access_token']?.toString();
    if (token == null) return;
    try {
      await Dio().post<void>(
        '$_simklApi/scrobble',
        options: Options(headers: _simklHeaders(token)),
        data: {
          'progress': progress.clamp(0.0, 100.0).toInt(),
          'type': type == 'series' ? 'episode' : 'movie',
          if (type == 'series') ...{
            'show': {
              'ids': {'imdb': imdbId},
            },
            'episode': {
              'season': season ?? 1,
              'number': episode ?? 1,
            },
          } else
            'movie': {
              'ids': {'imdb': imdbId},
            },
        },
      );
    } catch (_) {
      // Provider outages must never interrupt playback.
    }
  }

  Future<void> simklUnlink() async {
    simklToken = null;
    await _secure.delete(key: _simklTokenKey);
  }

  Future<String> _validSimklToken() async {
    final token = simklToken?['access_token']?.toString();
    if (token == null) {
      throw const FormatException('اربط حساب Simkl أولًا.');
    }
    return token;
  }

  // ── TMDB (user key) ──────────────────────────────────────────────────────

  Future<void> saveTmdbKey(String key) async {
    final value = key.trim();
    if (value.isEmpty) {
      throw const FormatException('أدخل مفتاح TMDB.');
    }
    await validateTmdbKey(value);
    tmdbKey = value;
    await _secure.write(key: _tmdbKeyKey, value: value);
  }

  Future<void> clearTmdbKey() async {
    tmdbKey = null;
    await _secure.delete(key: _tmdbKeyKey);
  }

  /// Proves the key works — v4 read-access tokens go in a Bearer header,
  /// v3 keys as the api_key query parameter.
  Future<Map<String, dynamic>> validateTmdbKey(String key) async {
    final isV4 = key.length > 60;
    final response = await Dio().get<Map<String, dynamic>>(
      'https://api.themoviedb.org/3/configuration',
      options: Options(
        headers: isV4 ? {'Authorization': 'Bearer $key'} : null,
        validateStatus: (code) => code != null && code < 500,
      ),
      queryParameters: isV4 ? null : {'api_key': key},
    );
    if (response.statusCode != 200 || response.data?['images'] is! Map) {
      throw const FormatException('رفضت TMDB هذا المفتاح.');
    }
    return Map<String, dynamic>.from(response.data!);
  }

  /// TMDB enrichment for the detail hero: logo, backdrop, certification.
  Future<Map<String, dynamic>?> tmdbEnrich(
    String type,
    String imdbId,
  ) async {
    final key = tmdbKey;
    if (key == null) return null;
    try {
      final isV4 = key.length > 60;
      final find = await Dio().get<Map<String, dynamic>>(
        'https://api.themoviedb.org/3/find/${Uri.encodeComponent(imdbId)}',
        options: Options(
          headers: isV4 ? {'Authorization': 'Bearer $key'} : null,
        ),
        queryParameters: {
          'external_source': 'imdb_id',
          if (!isV4) 'api_key': key,
        },
      );
      final rawBucket = type == 'series'
          ? (find.data?['tv_results'] as List?)
          : (find.data?['movie_results'] as List?);
      final bucket = rawBucket?.whereType<Map>().toList();
      if (bucket == null || bucket.isEmpty) return null;
      final result = Map<String, dynamic>.from(bucket.first);
      final images = await Dio().get<Map<String, dynamic>>(
        'https://api.themoviedb.org/3/${type == 'series' ? 'tv' : 'movie'}/${result['id']}/images',
        options: Options(
          headers: isV4 ? {'Authorization': 'Bearer $key'} : null,
        ),
        queryParameters: {
          'include_image_language': 'en,null,ar',
          if (!isV4) 'api_key': key,
        },
      );
      final logos =
          (images.data?['logos'] as List? ?? const []).whereType<Map>().toList();
      String? logo;
      if (logos.isNotEmpty) {
        logos.sort(
          (a, b) => ((b['vote_average'] as num?) ?? 0)
              .compareTo((a['vote_average'] as num?) ?? 0),
        );
        const base = 'https://image.tmdb.org/t/p/';
        logo = '${base}w500${logos.first['file_path']}';
      }
      return {
        'backdropPath': result['backdrop_path']?.toString(),
        'logoUrl': logo,
        'voteAverage': (result['vote_average'] as num?)?.toDouble(),
      };
    } catch (_) {
      return null;
    }
  }

  // ── Debrid (BYO API key, direct provider calls) ─────────────────────────

  Future<void> saveDebridKey(String service, String apiKey) async {
    final key = apiKey.trim();
    if (key.isEmpty) {
      throw const FormatException('أدخل مفتاح الخدمة.');
    }
    final user = await verifyDebridKey(service, key);
    final previous = debridService;
    if (previous != null && previous != service) {
      await _secure.delete(key: 'horse.mobile.debrid.$previous');
    }
    await _secure.write(key: 'horse.mobile.debrid.$service', value: key);
    await _preferences?.setString('horse.mobile.debrid.service', service);
    debridService = service;
    debridApiKey = key;
    debridUser = Map<String, dynamic>.from(user);
  }

  Map<String, dynamic>? debridUser;

  Future<void> clearDebridKey() async {
    final service = debridService;
    if (service != null) {
      await _secure.delete(key: 'horse.mobile.debrid.$service');
    }
    await _preferences?.remove('horse.mobile.debrid.service');
    debridService = null;
    debridApiKey = null;
    debridUser = null;
  }

  Future<Map<String, dynamic>> verifyDebridKey(
    String service,
    String apiKey,
  ) async {
    switch (service) {
      case 'realdebrid':
        final response = await _call(
          () => Dio().get<Map<String, dynamic>>(
                'https://api.real-debrid.com/rest/1.0/user',
                options: Options(
                  headers: {'Authorization': 'Bearer ${apiKey.trim()}'},
                ),
              ),
        );
        return {
          'username': response['username']?.toString() ?? '',
          'premium': response['premium'] == true,
          'expiresAt': response['expiration']?.toString(),
          'planName': response['type']?.toString(),
        };
      case 'alldebrid':
        final response = await _call(
          () => Dio().get<Map<String, dynamic>>(
                'https://api.alldebrid.com/v4/user',
                queryParameters: {
                  'agent': 'horseweb',
                  'apikey': apiKey.trim(),
                },
              ),
        );
        final data = Map<String, dynamic>.from(response['data'] as Map? ?? const {});
        final user = Map<String, dynamic>.from(data['user'] as Map? ?? const {});
        return {
          'username': user['username']?.toString() ?? '',
          'premium': user['isPremium'] == true,
          'expiresAt': user['premiumUntil']?.toString(),
          'planName': 'AllDebrid',
        };
      case 'torbox':
        final response = await _call(
          () => Dio().get<Map<String, dynamic>>(
                'https://api.torbox.app/v1/api/user/me',
                options: Options(
                  headers: {'Authorization': 'Bearer ${apiKey.trim()}'},
                ),
              ),
        );
        final data = Map<String, dynamic>.from(response['data'] as Map? ?? const {});
        final plan = (data['plan'] as num?)?.toInt() ?? 0;
        return {
          'username': data['email']?.toString() ?? '',
          'premium': plan > 0,
          'expiresAt': data['premium_expires_at']?.toString(),
          'planName': switch (plan) {
            1 => 'Essential',
            2 => 'Pro',
            3 => 'Standard',
            _ => 'Free',
          },
        };
      default:
        throw const FormatException('خدمة Debrid غير مدعومة.');
    }
  }

  /// Resolves a torrent info-hash into a direct HTTPS download URL using the
  /// connected debrid service. Ports the web server's per-service flows.
  Future<String> resolveDebridTorrent(Map<String, dynamic> stream) async {
    final service = debridService;
    final apiKey = debridApiKey;
    if (service == null || apiKey == null) {
      throw const FormatException('اربط خدمة Debrid من الإعدادات أولًا.');
    }
    final infoHash = (stream['infoHash'] ?? '').toString().toLowerCase();
    if (!RegExp(r'^[a-f0-9]{40}$').hasMatch(infoHash)) {
      throw const FormatException('رابط التورنت لا يحتوي على بصمة صالحة.');
    }
    final hints =
        (stream['behaviorHints'] as Map?)?.cast<String, dynamic>() ?? const {};
    final filename = (hints['filename'] ?? stream['title'] ?? '').toString();
    final deadline = DateTime.now().add(const Duration(seconds: 45));
    switch (service) {
      case 'realdebrid':
        return _resolveRealDebrid(apiKey, infoHash, filename, deadline);
      case 'alldebrid':
        return _resolveAllDebrid(apiKey, infoHash, filename, deadline);
      case 'torbox':
        return _resolveTorbox(apiKey, infoHash, filename, deadline);
      default:
        throw const FormatException('خدمة Debrid غير مدعومة.');
    }
  }

  Future<String> _resolveRealDebrid(
    String apiKey,
    String infoHash,
    String filename,
    DateTime deadline,
  ) async {
    final dio = Dio(
      BaseOptions(
        headers: {'Authorization': 'Bearer $apiKey'},
        connectTimeout: const Duration(seconds: 15),
      ),
    );
    final magnet = _magnet(infoHash, filename);
    final added = await _call(() => dio.post<Map<String, dynamic>>(
          'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
          data: 'magnet=${Uri.encodeComponent(magnet)}',
          options: Options(headers: {'Content-Type': 'application/x-www-form-urlencoded'}),
        ));
    final torrentId = added['id']?.toString();
    if (torrentId == null) {
      throw const FormatException('رفضت Real-Debrid هذا التورنت.');
    }
    try {
      await dio.post<void>(
        'https://api.real-debrid.com/rest/1.0/torrents/selectFiles/$torrentId',
        data: 'files=all',
        options: Options(headers: {'Content-Type': 'application/x-www-form-urlencoded'}),
      );
      Map<String, dynamic> info = const {};
      while (DateTime.now().isBefore(deadline)) {
        final response = await _call(
          () => dio.get<Map<String, dynamic>>(
                'https://api.real-debrid.com/rest/1.0/torrents/info/$torrentId',
              ),
        );
        info = response;
        final status = info['status']?.toString();
        if (status == 'downloaded') break;
        if (status == 'error' || status == 'dead' || status == 'virus') {
          throw const FormatException('فشل Real-Debrid في تجهيز هذا التورنت.');
        }
        await Future<void>.delayed(const Duration(milliseconds: 2000));
      }
      final files = (info['files'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((f) => _isVideo((f['path'] ?? '').toString()))
          .toList();
      if (files.isEmpty) {
        throw const FormatException('لا يوجد ملف فيديو في هذا التورنت.');
      }
      files.sort(
        (a, b) => ((b['bytes'] as num?) ?? 0).compareTo((a['bytes'] as num?) ?? 0),
      );
      final best = files.first;
      final links = (info['links'] as List? ?? const []).whereType<String>().toList();
      final linkIndex = (best['id'] as num?)?.toInt() ?? 0;
      final link = linkIndex >= 0 && linkIndex < links.length
          ? links[linkIndex]
          : (links.isNotEmpty ? links.last : null);
      if (link == null) {
        throw const FormatException('لم تُرجع Real-Debrid رابط تشغيل.');
      }
      final unrestricted = await _call(
        () => dio.post<Map<String, dynamic>>(
              'https://api.real-debrid.com/rest/1.0/torrents/unrestrict/link',
              data: 'link=${Uri.encodeComponent(link)}',
              options: Options(
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
              ),
            ),
      );
      final url = unrestricted['download']?.toString();
      if (url == null || url.isEmpty) {
        throw const FormatException('لم تُرجع Real-Debrid رابط تشغيل.');
      }
      return url;
    } finally {
      try {
        await dio.delete<void>(
          'https://api.real-debrid.com/rest/1.0/torrents/delete/$torrentId',
        );
      } catch (_) {
        // Cleanup is best-effort.
      }
    }
  }

  Future<String> _resolveAllDebrid(
    String apiKey,
    String infoHash,
    String filename,
    DateTime deadline,
  ) async {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        queryParameters: {'agent': 'horseweb', 'apikey': apiKey},
      ),
    );
    final magnet = _magnet(infoHash, filename);
    final uploaded = await _call(
      () => dio.post<Map<String, dynamic>>(
            'https://api.alldebrid.com/v4/magnet/upload',
            data: {'magnets': [magnet]},
          ),
    );
    final magnets = (uploaded['data']?['magnets'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    if (magnets.isEmpty) {
      throw const FormatException('رفضت AllDebrid هذا التورنت.');
    }
    final magnetId = magnets.first['id']?.toString();
    Map<String, dynamic> status = const {};
    while (DateTime.now().isBefore(deadline)) {
      final response = await _call(
        () => dio.get<Map<String, dynamic>>(
              'https://api.alldebrid.com/v4/magnet/status',
              queryParameters: {'id': magnetId},
            ),
      );
      final entry = Map<String, dynamic>.from(
        ((response['data']?['magnets'] as List? ?? const [])
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList())
            .firstWhere((e) => e['id']?.toString() == magnetId,
                orElse: () => const {}),
      );
      status = entry;
      if ((entry['statusCode'] as num?)?.toInt() == 4) break;
      await Future<void>.delayed(const Duration(milliseconds: 2500));
    }
    final files = (status['files'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => e['n']?.toString() ?? '')
        .where(_isVideo)
        .toList();
    final link = status['link']?.toString();
    if (files.isEmpty || link == null || link.isEmpty) {
      throw const FormatException('لم تُجهّز AllDebrid رابط تشغيل.');
    }
    final unlocked = await _call(
      () => dio.get<Map<String, dynamic>>(
            'https://api.alldebrid.com/v4/link/unlock',
            queryParameters: {'link': link},
          ),
    );
    final url = unlocked['data']?['link']?.toString();
    if (url == null || url.isEmpty) {
      throw const FormatException('لم تُجهّز AllDebrid رابط تشغيل.');
    }
    return url;
  }

  Future<String> _resolveTorbox(
    String apiKey,
    String infoHash,
    String filename,
    DateTime deadline,
  ) async {
    final dio = Dio(
      BaseOptions(
        headers: {'Authorization': 'Bearer $apiKey'},
        connectTimeout: const Duration(seconds: 15),
      ),
    );
    final magnet = _magnet(infoHash, filename);
    Map<String, dynamic>? existing;
    Map<String, dynamic>? torrent;
    while (DateTime.now().isBefore(deadline)) {
      final list = await _call(
        () => dio.get<Map<String, dynamic>>(
              'https://api.torbox.app/v1/api/torrents/mylist',
              queryParameters: {'bypass_cache': 'true'},
            ),
      );
      final rows = (list['data'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      existing = rows
          .cast<Map<String, dynamic>?>()
          .firstWhere(
            (row) =>
                (row!['hash']?.toString().toLowerCase() ?? '') == infoHash,
            orElse: () => null,
          );
      if (existing != null) {
        torrent = existing;
        final state = torrent['download_state']?.toString();
        if (state == 'cached' || state == 'completed') break;
      } else {
        await dio.post<void>(
          'https://api.torbox.app/v1/api/torrents/createtorrent',
          data: FormData.fromMap({
            'magnet': magnet,
            'seed': 3,
            'allow_zip': false,
          }),
        );
      }
      await Future<void>.delayed(const Duration(milliseconds: 2500));
    }
    if (torrent == null) {
      throw const FormatException('لم تُجهّز TorBox هذا التورنت في الوقت المتاح.');
    }
    final torrentId = torrent['id'];
    final files = (torrent['files'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((f) => _isVideo((f['name'] ?? f['short_name'] ?? '').toString()))
        .toList();
    if (files.isEmpty) {
      throw const FormatException('لا يوجد ملف فيديو في هذا التورنت.');
    }
    files.sort(
      (a, b) => ((b['size'] as num?) ?? 0).compareTo((a['size'] as num?) ?? 0),
    );
    final fileId = files.first['id'];
    final dl = await _call(
      () => dio.get<Map<String, dynamic>>(
            'https://api.torbox.app/v1/api/torrents/requestdl',
            queryParameters: {
              'torrent_id': torrentId,
              'file_id': fileId,
              'token': apiKey,
            },
          ),
    );
    final url = dl['data']?.toString();
    if (url == null || url.isEmpty) {
      throw const FormatException('لم تُرجع TorBox رابط تشغيل.');
    }
    return url;
  }

  static String _magnet(String infoHash, String filename) =>
      'magnet:?xt=urn:btih:$infoHash'
      '${filename.isNotEmpty ? '&dn=${Uri.encodeComponent(filename)}' : ''}';

  static bool _isVideo(String name) {
    final ext = name.split('.').last.toLowerCase();
    return const [
      'mp4', 'mkv', 'avi', 'webm', 'mov', 'flv', 'ts', 'm2ts', 'wmv', 'mpg',
    ].contains(ext);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>?> _readJson(String key) async {
    final raw = await _secure.read(key: key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeJson(String key, Map<String, dynamic> value) =>
      _secure.write(key: key, value: jsonEncode(value));

  Future<T> _call<T extends Object>(Future<Response<T>> Function() job) async {
    try {
      final response = await job();
      final data = response.data;
      if (data == null) {
        throw const FormatException('استجابة غير صالحة من الخدمة.');
      }
      return data;
    } on DioException catch (error) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) {
        throw FormatException(data['error'] as String);
      }
      if (data is Map && data['status'] == 'error') {
        final detail = data['data'];
        if (detail is Map && detail['error_message'] is String) {
          throw FormatException(detail['error_message'] as String);
        }
      }
      rethrow;
    }
  }
}
