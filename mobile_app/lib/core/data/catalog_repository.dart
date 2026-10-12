import 'dart:async';

import '../api/horse_api.dart';
import '../models/addon.dart';
import '../models/media_item.dart';

class CatalogRepository {
  CatalogRepository(this.api);

  final HorseApi api;
  static const _cinemeta = 'https://v3-cinemeta.strem.io';

  Future<List<MediaItem>> catalog(
    String type,
    String id, {
    Map<String, dynamic> extras = const {},
    Addon? addon,
  }) async {
    final base = addon?.baseUrl ?? _cinemeta;
    final url = _resourceUrl(base, 'catalog', type, id, extras);
    final data = await api.proxyGet(url);
    final rows = (data['metas'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => MediaItem.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.id.isNotEmpty)
        .toList();
    return _unique(rows);
  }

  Future<MediaItem?> detail(String type, String id, List<Addon> addons) async {
    for (final addon in addons.where(
      (a) => a.enabled && a.supports('meta', type, id),
    )) {
      try {
        final url = _resourceUrl(addon.baseUrl, 'meta', type, id, const {});
        final data = await api.proxyGet(url);
        final value = data['meta'];
        if (value is Map)
          return MediaItem.fromJson(Map<String, dynamic>.from(value));
      } catch (_) {
        // Try the next metadata provider before falling back to Cinemeta.
      }
    }
    try {
      final data = await api.proxyGet(
        _resourceUrl(_cinemeta, 'meta', type, id, const {}),
      );
      final value = data['meta'];
      return value is Map
          ? MediaItem.fromJson(Map<String, dynamic>.from(value))
          : null;
    } catch (_) {
      return null;
    }
  }

  Future<List<MediaItem>> homeTopTen() async {
    final values = await Future.wait([
      catalog('movie', 'trailer'),
      catalog('series', 'trailer'),
    ]);
    final merged = <MediaItem>[];
    final seen = <String>{};
    for (var i = 0; i < 40 && merged.length < 10; i++) {
      for (final rows in values) {
        if (i >= rows.length) continue;
        final item = rows[i];
        if (seen.add(item.id)) merged.add(item);
        if (merged.length == 10) break;
      }
    }
    return merged;
  }

  Future<List<MediaItem>> anime(List<Addon> addons) async {
    final jobs = <Future<List<MediaItem>>>[catalog('series', 'anime-trending')];
    for (final addon in addons.where((a) => a.enabled)) {
      for (final definition in addon.catalogs.where(
        (c) =>
            (c.type == 'anime' || c.type == 'series') &&
            '${c.name} ${c.id}'.toLowerCase().contains('anime'),
      )) {
        jobs.add(
          catalog(
            definition.type == 'anime' ? 'series' : definition.type,
            definition.id,
            addon: addon,
          ),
        );
      }
    }
    return _merge(await Future.wait(jobs.map(_softList)));
  }

  Future<List<MediaItem>> kids({bool series = false}) async {
    final values = await Future.wait(
      [
        catalog(
          series ? 'series' : 'movie',
          'top',
          extras: {'genre': 'Family'},
        ),
        catalog(series ? 'series' : 'movie', 'top', extras: {'genre': 'Kids'}),
      ].map(_softList),
    );
    return _merge(values).where((item) {
      final genres = item.genres.map((e) => e.toLowerCase()).toSet();
      if (genres.contains('adult') || genres.contains('horror')) return false;
      return genres.isEmpty ||
          genres.any(
            (g) =>
                g.contains('family') ||
                g.contains('animation') ||
                g.contains('children') ||
                g.contains('kids'),
          );
    }).toList();
  }

  Future<List<MediaItem>> addonCatalogs(List<Addon> addons) async {
    final jobs = <Future<List<MediaItem>>>[];
    for (final addon in addons.where((a) => a.enabled)) {
      for (final definition in addon.catalogs
          .where((c) => c.type == 'movie' || c.type == 'series')
          .take(2)) {
        jobs.add(catalog(definition.type, definition.id, addon: addon));
      }
      if (jobs.length >= 8) break;
    }
    return _merge(await Future.wait(jobs.map(_softList)));
  }

  Future<List<Map<String, dynamic>>> streams(
    String type,
    String id,
    List<Addon> addons,
  ) async {
    final supported = addons
        .where((a) => a.enabled && a.supports('stream', type, id))
        .toList();
    final results = await Future.wait(
      supported.map((addon) async {
        try {
          final data = await api.proxyGet(
            _resourceUrl(addon.baseUrl, 'stream', type, id, const {}),
          );
          return (data['streams'] as List? ?? const [])
              .whereType<Map>()
              .map(
                (e) => <String, dynamic>{
                  ...Map<String, dynamic>.from(e),
                  'addonName': addon.name,
                },
              )
              .toList();
        } catch (_) {
          return <Map<String, dynamic>>[];
        }
      }),
    );
    final merged = results.expand((e) => e).toList();
    final keys = <String>{};
    return merged.where((stream) {
      final key = (stream['url'] ?? stream['infoHash'] ?? stream['title'] ?? '')
          .toString();
      return key.isNotEmpty && keys.add(key);
    }).toList();
  }

  Future<Map<String, dynamic>> manifest(String rawUrl) async {
    var url = rawUrl.trim().replaceFirst(
          RegExp(r'^stremio://', caseSensitive: false),
          'https://',
        );
    url = url
        .replaceFirst(RegExp(r'/configure/?$'), '')
        .replaceFirst(RegExp(r'/+$'), '');
    if (!url.endsWith('manifest.json')) url = '$url/manifest.json';
    final data = await api.proxyGet(url);
    if (data['id'] is! String || data['name'] is! String) {
      throw const FormatException('رابط الإضافة لا يحتوي على manifest صالح.');
    }
    return data;
  }

  Future<List<MediaItem>> _softList(Future<List<MediaItem>> job) async {
    try {
      return await job;
    } catch (_) {
      return [];
    }
  }

  List<MediaItem> _merge(List<List<MediaItem>> groups) =>
      _unique(groups.expand((e) => e).toList());

  List<MediaItem> _unique(List<MediaItem> items) {
    final seen = <String>{};
    return items.where((e) => e.id.isNotEmpty && seen.add(e.id)).toList();
  }

  String _resourceUrl(
    String base,
    String resource,
    String type,
    String id,
    Map<String, dynamic> extras,
  ) {
    var path = '$base/$resource/$type/${Uri.encodeComponent(id)}';
    if (extras.isNotEmpty) {
      final encoded = extras.entries
          .where(
            (entry) => entry.value != null && entry.value.toString().isNotEmpty,
          )
          .map(
            (entry) =>
                '${entry.key}=${Uri.encodeComponent(entry.value.toString())}',
          )
          .join('&');
      if (encoded.isNotEmpty) path += '/$encoded';
    }
    return '$path.json';
  }
}
