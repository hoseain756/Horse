import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HorseApi {
  HorseApi({SharedPreferences? preferences}) : _preferences = preferences;

  static const defaultServer = String.fromEnvironment(
    'HORSE_API_BASE_URL',
    defaultValue: 'https://horse-silk.vercel.app',
  );
  static const _serverKey = 'horse.mobile.server';
  static const _stremioKey = 'horse.mobile.stremio.auth';

  final FlutterSecureStorage _secure = const FlutterSecureStorage();
  SharedPreferences? _preferences;
  late Dio _dio;
  String _baseUrl = defaultServer;
  String? stremioAuthKey;

  String get baseUrl => _baseUrl;
  Dio get dio => _dio;

  Future<void> initialize() async {
    _preferences ??= await SharedPreferences.getInstance();
    _baseUrl = _normalizeServer(
      _preferences!.getString(_serverKey) ?? defaultServer,
    );
    stremioAuthKey = await _secure.read(key: _stremioKey);
    _dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 25),
        sendTimeout: const Duration(seconds: 20),
        headers: {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final cookie = await _secure.read(key: _sessionStorageKey);
          if (cookie != null && cookie.isNotEmpty)
            options.headers['Cookie'] = cookie;
          handler.next(options);
        },
        onResponse: (response, handler) async {
          final cookies =
              response.headers.map['set-cookie'] ?? const <String>[];
          for (final cookie in cookies) {
            if (!cookie.startsWith('horse_session=')) continue;
            final pair = cookie.split(';').first;
            if (cookie.toLowerCase().contains('max-age=0')) {
              await _secure.delete(key: _sessionStorageKey);
            } else {
              await _secure.write(key: _sessionStorageKey, value: pair);
            }
          }
          handler.next(response);
        },
      ),
    );
  }

  String get _sessionStorageKey =>
      'horse.mobile.session.${Uri.parse(_baseUrl).host}';

  Future<void> setServerUrl(String raw) async {
    final normalized = _normalizeServer(raw);
    await _preferences?.setString(_serverKey, normalized);
    _baseUrl = normalized;
    _dio.options.baseUrl = normalized;
  }

  String _normalizeServer(String raw) {
    final value = raw.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        !{'https', 'http'}.contains(uri.scheme)) {
      throw const FormatException('أدخل عنوان خادم صحيحًا يبدأ بـ https://');
    }
    return value;
  }

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _dio.get<dynamic>(path, queryParameters: query);
    if (response.data is Map)
      return Map<String, dynamic>.from(response.data as Map);
    throw const FormatException('استجابة غير صالحة من الخادم');
  }

  Future<Map<String, dynamic>> postJson(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _dio.post<dynamic>(path, data: body);
    if (response.data is Map)
      return Map<String, dynamic>.from(response.data as Map);
    throw const FormatException('استجابة غير صالحة من الخادم');
  }

  Future<Map<String, dynamic>> proxyGet(String url) =>
      getJson('/api/proxy', query: {'url': url});

  Future<Map<String, dynamic>> loginHorse(String email, String password) =>
      postJson('/api/auth/login', {
        'email': email,
        'password': password,
        'remember': true,
      });

  Future<Map<String, dynamic>> registerHorse(
    String email,
    String password,
    String displayName,
  ) => postJson('/api/auth/register', {
    'email': email,
    'password': password,
    'displayName': displayName,
    'lang': 'ar',
  });

  Future<Map<String, dynamic>> horseMe() => getJson('/api/auth/me');

  Future<void> logoutHorse() async {
    await postJson('/api/auth/logout', const {});
    await _secure.delete(key: _sessionStorageKey);
  }

  Future<Map<String, dynamic>> loginStremio(
    String email,
    String password,
  ) async {
    final result = await postJson('/api/stremio/login', {
      'email': email,
      'password': password,
    });
    final key = result['authKey'];
    if (key is! String || key.isEmpty)
      throw const FormatException('لم يرجع Stremio مفتاح الدخول');
    stremioAuthKey = key;
    await _secure.write(key: _stremioKey, value: key);
    return Map<String, dynamic>.from(result['user'] as Map? ?? const {});
  }

  Future<void> logoutStremio() async {
    stremioAuthKey = null;
    await _secure.delete(key: _stremioKey);
  }

  Future<List<dynamic>> loadStremioAddons() async {
    final key = stremioAuthKey;
    if (key == null) return [];
    final data = await postJson('/api/stremio/addons', {
      'authKey': key,
      'action': 'get',
    });
    return data['addons'] as List? ?? [];
  }

  Future<void> saveStremioAddons(List<Map<String, dynamic>> addons) async {
    final key = stremioAuthKey;
    if (key == null) return;
    await postJson('/api/stremio/addons', {
      'authKey': key,
      'action': 'set',
      'addons': addons,
    });
  }

  Future<Map<String, dynamic>> loadSnapshot(String deviceId) =>
      getJson('/api/sync', query: {'device': deviceId});

  Future<void> saveSnapshot(
    String deviceId,
    Map<String, dynamic> snapshot,
  ) async {
    await postJson('/api/sync', {'device': deviceId, 'snapshot': snapshot});
  }

  Future<String> signMediaUrl(
    String url, {
    Map<String, dynamic>? proxyHeaders,
    String? filename,
  }) async {
    final data = await postJson('/api/media/sign', {
      'url': url,
      if (proxyHeaders != null) 'proxyHeaders': proxyHeaders,
      if (filename != null) 'filename': filename,
    });
    final signed = data['proxiedUrl'] as String?;
    if (signed == null || signed.isEmpty)
      throw const FormatException('تعذر تجهيز رابط التشغيل');
    return Uri.parse(_baseUrl).resolve(signed).toString();
  }

  Future<String> prepareTorrent(Map<String, dynamic> stream) async {
    final infoHash = (stream['infoHash'] ?? '').toString().toLowerCase();
    if (!RegExp(r'^[a-f0-9]{40}$').hasMatch(infoHash)) {
      throw const FormatException('رابط التورنت لا يحتوي على بصمة صالحة.');
    }
    final capabilities = await getJson('/api/media/capabilities');
    final mode = capabilities['torrent']?.toString() ?? 'none';
    if (mode == 'none') {
      throw const FormatException(
        'لا يوجد محرك تورنت مربوط بالخادم. أضف إضافة توفّر رابط بث مباشر أو اربط محركًا بالخادم.',
      );
    }
    final hints =
        (stream['behaviorHints'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final filename = (hints['filename'] ?? stream['title'] ?? '').toString();
    final fileIdx = (stream['fileIdx'] as num?)?.toInt();
    final prepared = await postJson('/api/engine/prepare', {
      'infoHash': infoHash,
      if (fileIdx != null) 'fileIdx': fileIdx,
      if (filename.isNotEmpty) 'filename': filename,
    });
    var status = prepared;
    final started = DateTime.now();
    while (status['pending'] == true &&
        DateTime.now().difference(started) < const Duration(seconds: 100)) {
      await Future<void>.delayed(const Duration(milliseconds: 2500));
      status = await getJson('/api/engine/status/$infoHash');
      if (status['error'] is String && status['error'] != 'not ready') {
        throw FormatException(status['error'] as String);
      }
      if (status['ready'] == true) break;
    }
    if (status['pending'] == true && status['ready'] != true) {
      throw const FormatException('لم يتم العثور على أقران لهذا التورنت.');
    }
    final index = (prepared['fileIdx'] as num?)?.toInt() ?? fileIdx ?? 0;
    final ext = filename.split('.').last.toLowerCase();
    final useRemux = const {
      'mkv',
      'avi',
      'ts',
      'wmv',
      'flv',
      'mpg',
      'mpeg',
    }.contains(ext);
    final path = useRemux
        ? 'remux/$infoHash/$index'
        : 'stream/$infoHash/$index';
    if (mode == 'external') {
      final engine = capabilities['enginePublicUrl'] as String?;
      if (engine == null || engine.isEmpty)
        throw const FormatException('خادم التورنت غير متاح.');
      final tokenResponse = await getJson('/api/engine/token');
      final token = tokenResponse['available'] == true
          ? tokenResponse['token']?.toString()
          : null;
      final uri = Uri.parse(
        '$engine/$path',
      ).replace(queryParameters: {if (token != null) 'k': token});
      return uri.toString();
    }
    if (mode == 'builtin') {
      return Uri.parse(
        _baseUrl,
      ).resolve('/$path?XTransformPort=3031').toString();
    }
    throw const FormatException('محرك التورنت غير متاح.');
  }
}

String compactJson(Object? value) => jsonEncode(value);
