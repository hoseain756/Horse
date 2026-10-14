import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// Direct Supabase access (GoTrue auth + PostgREST) — no Horse web server.
///
/// Schema contract (see supabase/mobile-access.sql in the repo root):
///   • Data buckets are the strings `acct:<auth-uid>`; RLS restricts every
///     row to the matching `profileId` / owner column for the caller.
///   • `AppSettings.data` carries the sync snapshot (JSON, shape v1) — the
///     same shape the web produces, so a future bridge can interoperate.
class SupabaseApi {
  SupabaseApi({SharedPreferences? preferences}) : _preferences = preferences;

  static const _sessionKey = 'horse.mobile.supabase.session';

  final FlutterSecureStorage _secure = const FlutterSecureStorage();
  SharedPreferences? _preferences;
  Dio? _dio;

  String? _baseUrl;
  String? _anonKey;
  Map<String, dynamic>? _session;

  String? get baseUrl => _baseUrl;
  bool get isConfigured => _baseUrl != null && _anonKey != null;
  bool get isSignedIn => _session != null;
  String? get accountId => _session?['user'] is Map
      ? ((_session!['user'] as Map)['id'] ?? '').toString()
      : null;
  String? get accountEmail => _session?['user'] is Map
      ? ((_session!['user'] as Map)['email'] ?? '').toString()
      : null;
  String? get accessToken => _session?['access_token']?.toString();
  String? get bucket => accountId == null ? null : 'acct:$accountId';

  Dio get dio {
    final client = _dio;
    if (client == null) {
      throw StateError('SupabaseApi.initialize() must run before use.');
    }
    return client;
  }

  Future<void> initialize() async {
    _preferences ??= await SharedPreferences.getInstance();
    _baseUrl = AppConfig.normalizeUrl(
      _preferences!.getString(AppConfig.prefsUrlKey) ?? AppConfig.buildUrl,
    );
    _anonKey = _preferences!.getString(AppConfig.prefsAnonKeyKey) ??
        (AppConfig.buildAnonKey.isEmpty ? null : AppConfig.buildAnonKey);
    _rebuildDio();
    final raw = await _secure.read(key: _sessionKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final session = Map<String, dynamic>.from(jsonDecode(raw) as Map);
        if (await _refreshSession(session)) {
          await _persistSession(session);
        }
        _session = session;
      } catch (_) {
        await _secure.delete(key: _sessionKey);
        _session = null;
      }
    }
  }

  /// Stores new coordinates and re-opens the client. Throws on invalid input.
  Future<void> configure(String url, String anonKey) async {
    final normalized = AppConfig.normalizeUrl(url);
    if (normalized == null) {
      throw const FormatException(
        'أدخل عنوان Supabase صحيحًا يبدأ بـ https://',
      );
    }
    final key = anonKey.trim();
    if (key.isEmpty) {
      throw const FormatException('مفتاح Supabase العام مطلوب.');
    }
    _baseUrl = normalized;
    _anonKey = key;
    await _preferences?.setString(AppConfig.prefsUrlKey, normalized);
    await _preferences?.setString(AppConfig.prefsAnonKeyKey, key);
    _rebuildDio();
  }

  Future<Map<String, dynamic>?> signIn(String email, String password) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/v1/token',
      queryParameters: {'grant_type': 'password'},
      data: {'email': email.trim().toLowerCase(), 'password': password},
    );
    final session = Map<String, dynamic>.from(response.data ?? const {});
    _session = session;
    await _persistSession(session);
    return Map<String, dynamic>.from(session['user'] as Map? ?? const {});
  }

  Future<Map<String, dynamic>?> signUp(
    String email,
    String password,
    String displayName,
  ) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/v1/signup',
      data: {
        'email': email.trim().toLowerCase(),
        'password': password,
        'data': {'display_name': displayName.trim()},
      },
    );
    final session = Map<String, dynamic>.from(response.data ?? const {});
    if (session['access_token'] != null) {
      _session = session;
      await _persistSession(session);
    }
    return session['user'] is Map
        ? Map<String, dynamic>.from(session['user'] as Map)
        : null;
  }

  Future<void> signOut() async {
    if (_session?['access_token'] != null) {
      try {
        await dio.post('/auth/v1/logout', data: const {});
      } catch (_) {
        // Local sign-out must always succeed.
      }
    }
    _session = null;
    await _secure.delete(key: _sessionKey);
  }

  /// PostgREST SELECT. Returns decoded rows.
  Future<List<Map<String, dynamic>>> from(
    String table, {
    String? select,
    Map<String, dynamic> filters = const {},
    int? limit,
  }) async {
    final token = await _validToken();
    final response = await dio.get<List<dynamic>>(
      '/rest/v1/$table',
      queryParameters: {
        if (select != null) 'select': select,
        ...filters,
        if (limit != null) 'limit': limit,
      },
      options: Options(headers: _restHeaders(token)),
    );
    return (response.data ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// PostgREST UPSERT on the primary key (or any unique columns given).
  Future<void> upsert(
    String table,
    List<Map<String, dynamic>> rows, {
    String onConflict = 'id',
  }) async {
    if (rows.isEmpty) return;
    final token = await _validToken();
    await dio.post<void>(
      '/rest/v1/$table',
      queryParameters: {'on_conflict': onConflict},
      options: Options(
        headers: {
          ..._restHeaders(token),
          'Prefer': 'resolution=merge-duplicates,return=minimal',
          'Content-Type': 'application/json',
        },
      ),
      data: rows,
    );
  }

  /// PostgREST DELETE with filters (uses `eq.` operators in [filters]).
  Future<void> delete(String table, Map<String, dynamic> filters) async {
    final token = await _validToken();
    await dio.delete<void>(
      '/rest/v1/$table',
      queryParameters: filters,
      options: Options(headers: _restHeaders(token)),
    );
  }

  Future<void> pushSnapshot(Map<String, dynamic> snapshot) async {
    final id = accountId;
    if (id == null) return;
    await upsert(
      'AppSettings',
      [
        {
          'profileId': 'acct:$id',
          'data': jsonEncode(snapshot),
          'updatedAt': DateTime.now().toUtc().toIso8601String(),
        }
      ],
      onConflict: 'profileId',
    );
  }

  Future<Map<String, dynamic>?> pullSnapshot() async {
    final id = accountId;
    if (id == null) return null;
    final rows = await from(
      'AppSettings',
      select: 'data,updatedAt',
      filters: {'profileId': 'eq.acct:$id'},
      limit: 1,
    );
    if (rows.isEmpty) return null;
    final raw = rows.first['data'];
    if (raw is! String || raw.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _restHeaders(String token) => {
        'apikey': _anonKey ?? '',
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      };

  void _rebuildDio() {
    if (_baseUrl == null) {
      _dio = null;
      return;
    }
    final client = Dio(
      BaseOptions(
        baseUrl: _baseUrl!,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'apikey': _anonKey ?? '',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: (code) => code != null && code < 500,
      ),
    );
    _dio = client;
  }

  Future<void> _persistSession(Map<String, dynamic> session) =>
      _secure.write(key: _sessionKey, value: jsonEncode(session));

  /// Ensures the access token is fresh; mutates + persists [session] on
  /// refresh. Returns false when the refresh is rejected.
  Future<bool> _refreshSession(Map<String, dynamic> session) async {
    final refreshToken = session['refresh_token']?.toString();
    if (refreshToken == null || refreshToken.isEmpty) return false;
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/v1/token',
      queryParameters: {'grant_type': 'refresh_token'},
      data: {'refresh_token': refreshToken},
    );
    if (response.data?['access_token'] == null) return false;
    session
      ..clear()
      ..addAll(Map<String, dynamic>.from(response.data ?? const {}));
    return true;
  }

  Future<String> _validToken() async {
    final session = _session;
    if (session == null) {
      throw const FormatException('سجّل الدخول أولًا للمزامنة.');
    }
    final expiresAt = (session['expires_at'] as num?)?.toInt();
    final expiring =
        expiresAt == null || expiresAt * 1000 < DateTime.now().millisecondsSinceEpoch + 60000;
    if (expiring && await _refreshSession(session)) {
      _session = session;
      await _persistSession(session);
    }
    return session['access_token']?.toString() ??
        (throw const FormatException('انتهت صلاحية الجلسة، سجّل الدخول مجددًا.'));
  }
}
