import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import '../player/video_player_page.dart';

/// Detail screen replicating the web experience in the Horse design
/// language: immersive layout with a floating back button, responsive hero
/// (contained card on phones / full-bleed band on tablets), single-line
/// metadata row with IMDb chip, action row, per-season episode list with
/// progress, and a tiered stream picker with debrid unlock.
class MediaDetailPage extends StatefulWidget {
  const MediaDetailPage({
    super.key,
    required this.item,
    this.resumeVideoId,
    this.resumePositionMs,
  });
  final MediaItem item;
  final String? resumeVideoId;
  final int? resumePositionMs;

  @override
  State<MediaDetailPage> createState() => _MediaDetailPageState();
}

class _MediaDetailPageState extends State<MediaDetailPage> {
  late Future<MediaItem?> _detail;
  Future<Map<String, dynamic>?>? _enrichment;
  Map<String, dynamic>? _selectedVideo;
  bool _resolving = false;
  String? _resolveStatus;
  int _season = -1;
  bool _gridView = false;

  @override
  void initState() {
    super.initState();
    final app = context.read<AppState>();
    _detail = app.catalogs.detail(widget.item.type, widget.item.id, app.addons);
    if (widget.item.id.startsWith('tt')) {
      _enrichment =
          app.providers.tmdbEnrich(widget.item.type, widget.item.id);
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────

  List<Map<String, dynamic>> get _episodes {
    final videos = widget.item.videos
        .where((v) => ((v['season'] as num?)?.toInt() ?? 0) > 0)
        .toList()
      ..sort((a, b) {
        final bySeason = ((a['season'] as num?) ?? 0)
            .compareTo((b['season'] as num?) ?? 0);
        if (bySeason != 0) return bySeason;
        return ((a['episode'] as num?) ?? 0)
            .compareTo((b['episode'] as num?) ?? 0);
      });
    return videos;
  }

  Map<String, WatchHistoryEntry> get _progressByVideo {
    final app = context.read<AppState>();
    final map = <String, WatchHistoryEntry>{};
    for (final entry in app.history) {
      final videoId = entry.videoId;
      if (videoId == null || videoId.isEmpty) continue;
      final existing = map[videoId];
      if (existing == null || entry.watchedAt > existing.watchedAt) {
        map[videoId] = entry;
      }
    }
    return map;
  }

  WatchHistoryEntry? get _resumeEntry {
    final app = context.read<AppState>();
    if (widget.resumeVideoId != null) {
      for (final entry in app.history) {
        if (entry.videoId == widget.resumeVideoId) return entry;
      }
    }
    for (final entry in app.history) {
      if (entry.item.id != widget.item.id) continue;
      final progress =
          entry.durationMs > 0 ? entry.positionMs / entry.durationMs : 0.0;
      if (progress > 0.02 && progress < 0.92) return entry;
    }
    return null;
  }

  Map<String, dynamic>? _defaultVideo() {
    final resume = _resumeEntry;
    if (resume?.videoId != null) {
      for (final video in _episodes) {
        if (video['id'] == resume!.videoId) return video;
      }
    }
    for (final video in _episodes) {
      final progress = _progressByVideo[video['id']];
      final ratio = progress != null && progress.durationMs > 0
          ? progress.positionMs / progress.durationMs
          : 0.0;
      if (ratio < 0.85) return video;
    }
    return _episodes.isNotEmpty ? _episodes.first : null;
  }

  List<int> get _seasonNumbers => _episodes
      .map((v) => (v['season'] as num?)?.toInt() ?? 0)
      .toSet()
      .toList()
    ..sort();

  // ── Playback ────────────────────────────────────────────────────────────

  String? _streamQuality(Map<String, dynamic> stream) {
    final title =
        '${stream['name'] ?? ''} ${stream['title'] ?? ''} ${stream['description'] ?? ''}';
    if (RegExp(r'2160|4k', caseSensitive: false).hasMatch(title)) return '4K';
    if (RegExp(r'1080').hasMatch(title)) return '1080p';
    if (RegExp(r'720').hasMatch(title)) return '720p';
    if (RegExp(r'480|sd', caseSensitive: false).hasMatch(title)) return 'SD';
    return null;
  }

  bool _streamIsDirect(Map<String, dynamic> stream) =>
      stream['url'] is String && (stream['url'] as String).startsWith('http');

  int _rankStream(Map<String, dynamic> stream) {
    final quality = _streamQuality(stream) ?? '';
    final qualityScore = switch (quality) {
      '4K' => 4,
      '1080p' => 3,
      '720p' => 2,
      'SD' => 1,
      _ => 2,
    };
    final cached =
        stream['behaviorHints'] is Map && RegExp(r'cached', caseSensitive: false)
            .hasMatch(stream['behaviorHints']['cachedFiles'].toString());
    final direct = _streamIsDirect(stream);
    return qualityScore * 10 + (cached ? 4 : 0) + (direct ? 2 : 0);
  }

  Future<void> _play(MediaItem item, {Map<String, dynamic>? manualStream}) async {
    final app = context.read<AppState>();
    final english = app.english;
    final episode = _selectedVideo;
    final id = (episode?['id'] as String?) ?? item.id;
    setState(() {
      _resolving = true;
      _resolveStatus = english
          ? 'Finding the best stream…'
          : 'البحث عن أفضل مصدر…';
    });
    try {
      List<Map<String, dynamic>> streams;
      if (manualStream != null) {
        streams = [manualStream];
      } else {
        _setResolveStatus(
          english ? 'Querying add-ons…' : 'استعلام الإضافات…',
        );
        streams = await app.catalogs.streams(item.type, id, app.addons);
        if (streams.isEmpty) {
          if (!mounted) return;
          setState(() => _resolving = false);
          await _showNoStreams(app.english);
          return;
        }
        streams.sort((a, b) => _rankStream(b).compareTo(_rankStream(a)));
        _setResolveStatus(
          english ? 'Unlocking with debrid…' : 'الفتح عبر Debrid…',
        );
      }
      final stream = streams.first;
      final String url;
      if (_streamIsDirect(stream)) {
        url = stream['url'].toString();
      } else if (stream['infoHash'] is String) {
        _setResolveStatus(
          english ? 'Unlocking with debrid…' : 'الفتح عبر Debrid…',
        );
        url = await app.providers.resolveDebridTorrent(stream);
      } else {
        throw const FormatException(
          'هذا المصدر يتطلب محرك تورنت غير متاح على الجهاز — اربط خدمة Debrid أو اختر مصدرًا مباشرًا.',
        );
      }
      if (!mounted) return;
      final videoId = id;
      final entry = _progressByVideo[videoId];
      final resumeMs = widget.resumeVideoId == videoId
          ? (widget.resumePositionMs ?? entry?.positionMs ?? 0)
          : (entry?.positionMs ?? 0);
      setState(() {
        _resolving = false;
        _resolveStatus = null;
      });
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => VideoPlayerPage(
            item: item,
            url: url,
            streamName: (stream['title'] ?? stream['addonName'] ?? 'Horse')
                .toString()
                .split('\n')
                .first,
            videoId: videoId,
            season: (episode?['season'] as num?)?.toInt(),
            episode: (episode?['episode'] as num?)?.toInt(),
            initialPositionMs: resumeMs,
            streams: streams,
            onSwitchStream: (next) async {
              final nav = Navigator.of(context);
              final nextUrl = _streamIsDirect(next)
                  ? next['url'].toString()
                  : await app.providers.resolveDebridTorrent(next);
              await nav.pushReplacement(
                MaterialPageRoute<void>(
                  builder: (_) => VideoPlayerPage(
                    item: item,
                    url: nextUrl,
                    streamName: (next['title'] ?? 'Horse')
                        .toString()
                        .split('\n')
                        .first,
                    videoId: videoId,
                    season: (episode?['season'] as num?)?.toInt(),
                    episode: (episode?['episode'] as num?)?.toInt(),
                    streams: streams,
                  ),
                  fullscreenDialog: true,
                ),
              );
            },
          ),
          fullscreenDialog: true,
        ),
      );
    } catch (error) {
      if (mounted) {
        setState(() {
          _resolving = false;
          _resolveStatus = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendly(error))),
        );
      }
    }
  }

  void _setResolveStatus(String status) {
    if (mounted) setState(() => _resolveStatus = status);
  }

  Future<void> _showNoStreams(bool english) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(english ? 'No streams found' : 'لم يتم العثور على مصادر'),
        content: Text(
          english
              ? 'Install a stream add-on from Settings, or connect a debrid service to unlock torrents.'
              : 'ثبّت إضافة بث من الإعدادات، أو اربط خدمة Debrid لفتح التورنتات.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(english ? 'Close' : 'إغلاق'),
          ),
        ],
      ),
    );
  }

  Future<void> _openPicker(MediaItem item) async {
    final app = context.read<AppState>();
    final english = app.english;
    final episode = _selectedVideo;
    final id = (episode?['id'] as String?) ?? item.id;
    setState(() => _resolving = true);
    List<Map<String, dynamic>> streams;
    try {
      streams = await app.catalogs.streams(item.type, id, app.addons);
    } catch (_) {
      streams = [];
    }
    if (!mounted) return;
    setState(() => _resolving = false);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: HorseTheme.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => _StreamPicker(
        streams: streams,
        english: english,
        hasDebrid: app.providers.debridApiKey != null,
        onPick: (stream) {
          Navigator.pop(context);
          unawaitedPlay(item, stream);
        },
      ),
    );
  }

  void unawaitedPlay(MediaItem item, Map<String, dynamic> stream) {
    // The stream is already resolved inside _play when passed manually.
    unawaited(_play(item, manualStream: stream));
  }

  // ── Build ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 600;
    return Scaffold(
      backgroundColor: HorseTheme.canvas,
      body: Stack(
        children: [
          FutureBuilder<MediaItem?>(
            future: _detail,
            builder: (context, snapshot) {
              final item = snapshot.data ?? widget.item;
              if (_selectedVideo == null && _episodes.isNotEmpty) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && _selectedVideo == null) {
                    setState(() => _selectedVideo = _defaultVideo());
                  }
                });
              }
              if (_season == -1 && _seasonNumbers.isNotEmpty) {
                final resume = _resumeEntry;
                int? resumeSeason;
                if (resume?.videoId != null) {
                  for (final v in _episodes) {
                    if (v['id'] == resume!.videoId) {
                      resumeSeason = (v['season'] as num?)?.toInt();
                      break;
                    }
                  }
                }
                _season = resumeSeason ??
                    (_seasonNumbers.contains(1) ? 1 : _seasonNumbers.first);
              }
              return CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: _Hero(
                      item: item,
                      english: english,
                      enrichment: _enrichment,
                      wide: wide,
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: _Content(
                      item: item,
                      english: english,
                      wide: wide,
                      onPlay: () => _play(item),
                      onOpenPicker: () => _openPicker(item),
                      resolving: _resolving,
                      resumeVideo: _resumeEntry,
                      enrichment: _enrichment,
                    ),
                  ),
                  if (item.type == 'series' && _episodes.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _EpisodesSection(
                        item: item,
                        english: english,
                        wide: wide,
                        episodes: _episodes,
                        seasonNumbers: _seasonNumbers,
                        season: _season,
                        onSeason: (value) => setState(() => _season = value),
                        gridView: _gridView,
                        onToggleView: () =>
                            setState(() => _gridView = !_gridView),
                        progressByVideo: _progressByVideo,
                        selectedVideoId: _selectedVideo?['id']?.toString(),
                        onSelectVideo: (video) =>
                            setState(() => _selectedVideo = video),
                        onPlayEpisode: (video) {
                          setState(() => _selectedVideo = video);
                          unawaited(_play(item));
                        },
                      ),
                    ),
                  const SliverToBoxAdapter(child: SizedBox(height: 44)),
                ],
              );
            },
          ),
          // Floating back button — always visible (web spec).
          Positioned.directional(
            textDirection: Directionality.of(context),
            top: MediaQuery.paddingOf(context).top + 10,
            start: 12,
            child: _BackButton(english: english),
          ),
          // Resolving overlay.
          if (_resolving)
            Positioned.fill(
              child: ColoredBox(
                color: Colors.black.withValues(alpha: .78),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: HorseTheme.gold),
                      const SizedBox(height: 14),
                      Text(
                        _resolveStatus ??
                            (english ? 'Preparing…' : 'جارٍ التجهيز…'),
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _friendly(Object error) => error
      .toString()
      .replaceFirst(RegExp(r'^(Exception|FormatException):\s*'), '');
}

// ── Hero ──────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({
    required this.item,
    required this.english,
    required this.enrichment,
    required this.wide,
  });

  final MediaItem item;
  final bool english;
  final Future<Map<String, dynamic>?>? enrichment;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (!wide) {
      // Phone: contained art card with rounded bottom corners.
      final cardWidth = width - 32;
      final height = cardWidth * 11 / 16 + 72;
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(28),
          ),
          child: Container(
            height: height,
            decoration: BoxDecoration(
              color: HorseTheme.raised,
              border: Border.all(color: HorseTheme.line),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black54,
                  blurRadius: 60,
                  offset: Offset(0, 28),
                  spreadRadius: -30,
                ),
              ],
            ),
            child: _HeroArt(item: item, enrichment: enrichment, compact: true),
          ),
        ),
      );
    }
    // Tablet/desktop: full-bleed band melting into the page.
    final height =
        (width * .52).clamp(360.0, MediaQuery.sizeOf(context).height * .68);
    return SizedBox(
      height: height,
      child: _HeroArt(item: item, enrichment: enrichment, compact: false),
    );
  }
}

class _HeroArt extends StatelessWidget {
  const _HeroArt({
    required this.item,
    required this.enrichment,
    required this.compact,
  });

  final MediaItem item;
  final Future<Map<String, dynamic>?>? enrichment;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final image = item.background ?? item.poster;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (image != null)
          Image.network(
            image,
            fit: BoxFit.cover,
            alignment: const Alignment(0, .3),
            errorBuilder: (_, __, ___) => const ColoredBox(
              color: HorseTheme.raised,
              child: Icon(Icons.movie_outlined,
                  size: 44, color: HorseTheme.gold),
            ),
          )
        else
          const ColoredBox(
            color: HorseTheme.raised,
            child: Icon(Icons.movie_outlined, size: 44, color: HorseTheme.gold),
          ),
        // Scrims (web spec order).
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: 120,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: .35),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        if (compact)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: MediaQuery.sizeOf(context).width * .6,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withValues(alpha: .92),
                    Colors.black.withValues(alpha: .45),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          )
        else ...[
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: AlignmentDirectional.centerStart,
                  end: AlignmentDirectional.centerEnd,
                  colors: [
                    HorseTheme.canvas.withValues(alpha: .92),
                    HorseTheme.canvas.withValues(alpha: .42),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: MediaQuery.sizeOf(context).height * .45,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    HorseTheme.canvas,
                    HorseTheme.canvas.withValues(alpha: .55),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
        ],
        // Official logo (TMDB) embedded in the scrim on phones.
        if (compact)
          Positioned(
            left: 20,
            right: 20,
            bottom: 16,
            child: FutureBuilder<Map<String, dynamic>?>(
              future: enrichment,
              builder: (context, snapshot) {
                final logo = snapshot.data?['logoUrl'] as String?;
                if (logo != null) {
                  return Center(
                    child: Image.network(
                      logo,
                      height: 54,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => _TitleFallback(item: item),
                    ),
                  );
                }
                return _TitleFallback(item: item);
              },
            ),
          ),
      ],
    );
  }
}

class _TitleFallback extends StatelessWidget {
  const _TitleFallback({required this.item});
  final MediaItem item;

  @override
  Widget build(BuildContext context) => Text(
        item.name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w800,
          height: 1.15,
        ),
      );
}

// ── Content column ────────────────────────────────────────────────────────

class _Content extends StatelessWidget {
  const _Content({
    required this.item,
    required this.english,
    required this.wide,
    required this.onPlay,
    required this.onOpenPicker,
    required this.resolving,
    required this.resumeVideo,
    required this.enrichment,
  });

  final MediaItem item;
  final bool english;
  final bool wide;
  final VoidCallback onPlay;
  final VoidCallback onOpenPicker;
  final bool resolving;
  final WatchHistoryEntry? resumeVideo;
  final Future<Map<String, dynamic>?>? enrichment;

  @override
  Widget build(BuildContext context) {
    final overlap = wide ? (MediaQuery.sizeOf(context).height * .14).clamp(96.0, 160.0) : 18.0;
    final alignment =
        wide ? CrossAxisAlignment.start : CrossAxisAlignment.center;
    return Transform.translate(
      offset: Offset(0, -overlap),
      child: Padding(
        padding: EdgeInsets.fromLTRB(wide ? 34 : 20, 0, wide ? 34 : 20, 0),
        child: Column(
          crossAxisAlignment: alignment,
          children: [
            if (!wide) ...[
              _TitleBlock(item: item, english: english, compact: true),
              const SizedBox(height: 14),
            ],
            _MetaRow(item: item, english: english, enrichment: enrichment),
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: wide ? 620 : 560),
              child: _RatingsChips(item: item, english: english),
            ),
            const SizedBox(height: 14),
            if (wide) _TitleBlock(item: item, english: english, compact: false),
            if (item.description != null && item.description!.isNotEmpty)
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 620),
                child: Text(
                  item.description!,
                  maxLines: wide ? 3 : 4,
                  overflow: TextOverflow.ellipsis,
                  textAlign: wide ? TextAlign.start : TextAlign.center,
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    height: 1.7,
                  ),
                ),
              ),
            const SizedBox(height: 20),
            _ActionRow(
              item: item,
              english: english,
              wide: wide,
              onPlay: onPlay,
              onOpenPicker: onOpenPicker,
              resolving: resolving,
              resume: resumeVideo,
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }
}

class _TitleBlock extends StatelessWidget {
  const _TitleBlock({
    required this.item,
    required this.english,
    required this.compact,
  });

  final MediaItem item;
  final bool english;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final logoFuture = context.findAncestorStateOfType<_MediaDetailPageState>();
    assert(logoFuture != null, 'detail state ancestor expected');
    return FutureBuilder<Map<String, dynamic>?>(
      future: logoFuture?._enrichment,
      builder: (context, snapshot) {
        final logo = compact ? null : snapshot.data?['logoUrl'] as String?;
        if (logo != null) {
          return ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 64),
            child: Image.network(
              logo,
              fit: BoxFit.contain,
              alignment: AlignmentDirectional.centerStart,
              errorBuilder: (_, __, ___) => Text(
                item.name,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
          );
        }
        return Text(
          item.name,
          textAlign: compact ? TextAlign.center : TextAlign.start,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.headlineSmall,
        );
      },
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.item,
    required this.english,
    required this.enrichment,
  });

  final MediaItem item;
  final bool english;
  final Future<Map<String, dynamic>?>? enrichment;

  @override
  Widget build(BuildContext context) {
    Widget divider() => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Text(
            '•',
            style: TextStyle(
              color: Colors.white.withValues(alpha: .32),
              fontSize: 11,
            ),
          ),
        );
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          if (item.rating != null && item.rating!.isNotEmpty) ...[
            _ImdbBadge(rating: item.rating!),
            divider(),
          ],
          if (item.releaseInfo != null)
            Text(
              item.releaseInfo!,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          if (item.releaseInfo != null) divider(),
          Text(
            item.type == 'series'
                ? (english ? 'Series' : 'مسلسل')
                : (english ? 'Movie' : 'فيلم'),
            style: const TextStyle(color: Colors.white60, fontSize: 13),
          ),
          if (item.genres.isNotEmpty) ...[
            divider(),
            _GenreChip(label: item.genres.first),
          ],
          if (item.genres.length > 1) ...[
            divider(),
            Text(
              '+${item.genres.length - 1}',
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _ImdbBadge extends StatelessWidget {
  const _ImdbBadge({required this.rating});
  final String rating;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0x1AFCD34D),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0x40FCD34D)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.star_rounded,
                size: 14, color: Color(0xFFFCD34D)),
            const SizedBox(width: 4),
            Text(
              rating,
              style: const TextStyle(
                color: Color(0xFFFCD34D),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
}

class _GenreChip extends StatelessWidget {
  const _GenreChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: HorseTheme.raised.withValues(alpha: .7),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: HorseTheme.line),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.white60,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      );
}

class _RatingsChips extends StatelessWidget {
  const _RatingsChips({required this.item, required this.english});
  final MediaItem item;
  final bool english;

  @override
  Widget build(BuildContext context) {
    if (item.rating == null || item.rating!.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: [
        _RatingChip(
          provider: 'IMDb',
          score: item.rating!,
          color: const Color(0xFFF5C518),
          onColor: Colors.black,
        ),
        FutureBuilder<Map<String, dynamic>?>(
          future: context.findAncestorStateOfType<_MediaDetailPageState>()
              ?._enrichment,
          builder: (context, snapshot) {
            final vote = snapshot.data?['voteAverage'] as double?;
            if (vote == null || vote <= 0) return const SizedBox.shrink();
            return _RatingChip(
              provider: 'TMDB',
              score: vote.toStringAsFixed(1),
              color: const Color(0xFF0EA5E9),
              onColor: Colors.white,
            );
          },
        ),
      ],
    );
  }
}

class _RatingChip extends StatelessWidget {
  const _RatingChip({
    required this.provider,
    required this.score,
    required this.color,
    required this.onColor,
  });

  final String provider;
  final String score;
  final Color color;
  final Color onColor;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: .3),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: HorseTheme.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                provider,
                style: TextStyle(
                  color: onColor,
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  letterSpacing: .5,
                ),
              ),
            ),
            const SizedBox(width: 7),
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 7),
              child: Text(
                score,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      );
}

// ── Action row ────────────────────────────────────────────────────────────

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.item,
    required this.english,
    required this.wide,
    required this.onPlay,
    required this.onOpenPicker,
    required this.resolving,
    required this.resume,
  });

  final MediaItem item;
  final bool english;
  final bool wide;
  final VoidCallback onPlay;
  final VoidCallback onOpenPicker;
  final bool resolving;
  final WatchHistoryEntry? resume;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final inList = app.contains(item);
    final resumeLabel = resume != null && resume!.videoId != null;
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      alignment: wide ? WrapAlignment.start : WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Primary CTA — 52dp gold pill.
        SizedBox(
          height: 52,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: HorseTheme.gold,
              foregroundColor: const Color(0xFF1A1209),
              padding: const EdgeInsets.symmetric(horizontal: 26),
              shape: const StadiumBorder(),
              textStyle: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            onPressed: resolving ? null : onPlay,
            icon: const Icon(Icons.play_arrow_rounded, size: 22),
            label: Text(
              resumeLabel
                  ? (english
                      ? 'Resume S${resume!.season}:E${resume!.episode}'
                      : 'متابعة S${resume!.season}:E${resume!.episode}')
                  : (english ? 'Watch now' : 'مشاهدة'),
            ),
          ),
        ),
        // Circular menu: watchlist + streams.
        _CircleButton(
          icon: inList
              ? Icons.check_rounded
              : Icons.add_rounded,
          tint: inList,
          tooltip: english ? 'Watchlist' : 'قائمة المشاهدة',
          onTap: () => app.toggleWatchlist(item),
        ),
        _CircleButton(
          icon: Icons.layers_rounded,
          tooltip: english ? 'Available streams' : 'المصادر المتاحة',
          onTap: onOpenPicker,
        ),
      ],
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.tint = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final bool tint;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: tooltip,
        child: Material(
          color: tint
              ? HorseTheme.gold.withValues(alpha: .16)
              : HorseTheme.raised.withValues(alpha: .8),
          shape: CircleBorder(
            side: BorderSide(
              color: tint ? HorseTheme.gold : HorseTheme.line,
            ),
          ),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 52,
              height: 52,
              child: Icon(
                icon,
                size: 22,
                color: tint ? HorseTheme.gold : Colors.white,
              ),
            ),
          ),
        ),
      );
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.english});
  final bool english;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.black.withValues(alpha: .55),
        shape: const StadiumBorder(
          side: BorderSide(color: Colors.white24),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: () => Navigator.of(context).maybePop(),
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(12, 9, 18, 9),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Localizations.localeOf(context).languageCode == 'ar'
                      ? Icons.arrow_forward_rounded
                      : Icons.arrow_back_rounded,
                  color: Colors.white,
                  size: 18,
                ),
                const SizedBox(width: 7),
                Text(
                  english ? 'Back' : 'رجوع',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

// ── Episodes section ──────────────────────────────────────────────────────

class _EpisodesSection extends StatelessWidget {
  const _EpisodesSection({
    required this.item,
    required this.english,
    required this.wide,
    required this.episodes,
    required this.seasonNumbers,
    required this.season,
    required this.onSeason,
    required this.gridView,
    required this.onToggleView,
    required this.progressByVideo,
    required this.selectedVideoId,
    required this.onSelectVideo,
    required this.onPlayEpisode,
  });

  final MediaItem item;
  final bool english;
  final bool wide;
  final List<Map<String, dynamic>> episodes;
  final List<int> seasonNumbers;
  final int season;
  final ValueChanged<int> onSeason;
  final bool gridView;
  final VoidCallback onToggleView;
  final Map<String, WatchHistoryEntry> progressByVideo;
  final String? selectedVideoId;
  final ValueChanged<Map<String, dynamic>> onSelectVideo;
  final ValueChanged<Map<String, dynamic>> onPlayEpisode;

  @override
  Widget build(BuildContext context) {
    final seasonEpisodes =
        episodes.where((v) => ((v['season'] as num?)?.toInt() ?? 0) == season).toList();
    final watchedCount = seasonEpisodes
        .where((v) {
          final entry = progressByVideo[v['id']];
          if (entry == null || entry.durationMs == 0) return false;
          return entry.positionMs / entry.durationMs >= 0.85;
        })
        .length;
    return Padding(
      padding: EdgeInsets.fromLTRB(wide ? 34 : 20, 34, wide ? 34 : 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                english ? 'Episodes' : 'الحلقات',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                decoration: BoxDecoration(
                  color: HorseTheme.raised,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: HorseTheme.line),
                ),
                child: Text(
                  '$watchedCount/${seasonEpisodes.length}',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Spacer(),
              // List / grid segmented toggle.
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: HorseTheme.raised,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: HorseTheme.line),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ViewToggle(
                      icon: Icons.view_list_rounded,
                      selected: !gridView,
                      onTap: onToggleView,
                    ),
                    _ViewToggle(
                      icon: Icons.grid_view_rounded,
                      selected: gridView,
                      onTap: onToggleView,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (seasonNumbers.length > 1)
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: seasonNumbers.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final value = seasonNumbers[index];
                  final selected = value == season;
                  return _SeasonPill(
                    label: value == 0
                        ? (english ? 'Specials' : 'حلقات خاصة')
                        : (english ? 'Season $value' : 'الموسم $value'),
                    selected: selected,
                    onTap: () => onSeason(value),
                  );
                },
              ),
            ),
          const SizedBox(height: 12),
          gridView
              ? LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = (constraints.maxWidth / 240)
                        .floor()
                        .clamp(2, 4);
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: .82,
                      ),
                      itemCount: seasonEpisodes.length,
                      itemBuilder: (context, index) => _EpisodeCard(
                        video: seasonEpisodes[index],
                        english: english,
                        progress: progressByVideo[seasonEpisodes[index]['id']],
                        selected: selectedVideoId ==
                            seasonEpisodes[index]['id']?.toString(),
                        onTap: () => onPlayEpisode(seasonEpisodes[index]),
                        onLongPress: () =>
                            onSelectVideo(seasonEpisodes[index]),
                      ),
                    );
                  },
                )
              : Column(
                  children: [
                    for (final video in seasonEpisodes)
                      _EpisodeRow(
                        video: video,
                        english: english,
                        progress: progressByVideo[video['id']],
                        selected:
                            selectedVideoId == video['id']?.toString(),
                        onTap: () => onPlayEpisode(video),
                      ),
                  ],
                ),
        ],
      ),
    );
  }
}

class _ViewToggle extends StatelessWidget {
  const _ViewToggle({
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            icon,
            size: 19,
            color: selected ? HorseTheme.gold : Colors.white38,
          ),
        ),
      );
}

class _SeasonPill extends StatelessWidget {
  const _SeasonPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: selected
            ? HorseTheme.gold.withValues(alpha: .16)
            : HorseTheme.raised,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected ? HorseTheme.gold : HorseTheme.line,
          ),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? HorseTheme.gold : Colors.white70,
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      );
}

String? _episodeName(Map<String, dynamic> video) {
  final name = video['name'] ?? video['title'];
  return name?.toString();
}

class _EpisodeCard extends StatelessWidget {
  const _EpisodeCard({
    required this.video,
    required this.english,
    required this.progress,
    required this.selected,
    required this.onTap,
    required this.onLongPress,
  });

  final Map<String, dynamic> video;
  final bool english;
  final WatchHistoryEntry? progress;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final ratio = progress != null && progress!.durationMs > 0
        ? (progress!.positionMs / progress!.durationMs).clamp(0.0, 1.0)
        : 0.0;
    final watched = ratio >= 0.85;
    final name = _episodeName(video) ?? (english ? 'Episode' : 'حلقة');
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      onLongPress: onLongPress,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: selected ? HorseTheme.gold : HorseTheme.line,
                  width: selected ? 1.4 : 1,
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    const ColoredBox(
                      color: HorseTheme.raised,
                      child: Center(
                        child: Icon(Icons.play_circle_outline_rounded,
                            color: HorseTheme.gold),
                      ),
                    ),
                    Positioned.directional(
                      textDirection: Directionality.of(context),
                      top: 6,
                      end: 6,
                      child: _NumberPill(video: video),
                    ),
                    if (watched)
                      Positioned.directional(
                        textDirection: Directionality.of(context),
                        bottom: 6,
                        start: 6,
                        child: _WatchedPill(english: english),
                      ),
                    if (ratio > 0.02 && !watched)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: LinearProgressIndicator(
                          value: ratio,
                          minHeight: 3,
                          backgroundColor: Colors.black45,
                          color: const Color(0xFFDC2626),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 7),
          Text(
            'E${((video['episode'] as num?) ?? 0).toInt()} · $name',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _EpisodeRow extends StatelessWidget {
  const _EpisodeRow({
    required this.video,
    required this.english,
    required this.progress,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> video;
  final bool english;
  final WatchHistoryEntry? progress;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ratio = progress != null && progress!.durationMs > 0
        ? (progress!.positionMs / progress!.durationMs).clamp(0.0, 1.0)
        : 0.0;
    final watched = ratio >= 0.85;
    final name = _episodeName(video) ?? (english ? 'Episode' : 'حلقة');
    final released = video['released']?.toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: HorseTheme.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected ? HorseTheme.gold : HorseTheme.line,
                width: selected ? 1.4 : 1,
              ),
            ),
            child: Row(
              children: [
                // Thumb column: number pill + progress.
                Container(
                  width: 96,
                  height: 54,
                  decoration: BoxDecoration(
                    color: HorseTheme.raised,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Stack(
                    children: [
                      const Center(
                        child: Icon(
                          Icons.play_circle_outline_rounded,
                          color: HorseTheme.gold,
                          size: 22,
                        ),
                      ),
                      Positioned.directional(
                        textDirection: Directionality.of(context),
                        top: 4,
                        end: 4,
                        child: _NumberPill(video: video),
                      ),
                      if (watched)
                        Positioned.directional(
                          textDirection: Directionality.of(context),
                          bottom: 4,
                          start: 4,
                          child: Icon(
                            Icons.check_circle_rounded,
                            size: 15,
                            color: const Color(0xFF22C55E),
                          ),
                        ),
                      if (ratio > 0.02 && !watched)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                              bottom: Radius.circular(9),
                            ),
                            child: LinearProgressIndicator(
                              value: ratio,
                              minHeight: 3,
                              backgroundColor: Colors.black45,
                              color: const Color(0xFFDC2626),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                        ),
                      ),
                      if (released != null && released.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          released.split('T').first,
                          style: const TextStyle(
                            color: Colors.white38,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.chevron_right_rounded,
                  color: selected ? HorseTheme.gold : Colors.white24,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NumberPill extends StatelessWidget {
  const _NumberPill({required this.video});
  final Map<String, dynamic> video;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: .72),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          'E${((video['episode'] as num?) ?? 0).toInt()}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}

class _WatchedPill extends StatelessWidget {
  const _WatchedPill({required this.english});
  final bool english;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: .72),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_rounded, size: 11, color: Color(0xFF22C55E)),
            const SizedBox(width: 3),
            Text(
              english ? 'Watched' : 'تمت',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
}

// ── Stream picker ─────────────────────────────────────────────────────────

class _StreamPicker extends StatefulWidget {
  const _StreamPicker({
    required this.streams,
    required this.english,
    required this.hasDebrid,
    required this.onPick,
  });

  final List<Map<String, dynamic>> streams;
  final bool english;
  final bool hasDebrid;
  final ValueChanged<Map<String, dynamic>> onPick;

  @override
  State<_StreamPicker> createState() => _StreamPickerState();
}

class _StreamPickerState extends State<_StreamPicker> {
  String _filter = 'all';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.streams.where((stream) {
      final quality = _qualityOf(stream);
      final direct = stream['url'] is String;
      final torrent = stream['infoHash'] is String;
      switch (_filter) {
        case '4k':
          return quality == '4K';
        case '1080p':
          return quality == '1080p';
        case 'cached':
          return torrent && widget.hasDebrid;
        case 'free':
          return direct;
        default:
          return true;
      }
    }).toList();
    final query = _search.text.trim().toLowerCase();
    final rows = query.isEmpty
        ? filtered
        : filtered
            .where(
              (stream) => '${stream['title']} ${stream['description']}'
                  .toLowerCase()
                  .contains(query),
            )
            .toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 14, 0, 0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.english
                          ? 'Choose a stream'
                          : 'اختر مصدر التشغيل',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  Text(
                    '${rows.length}',
                    style: const TextStyle(
                        color: Colors.white38, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                children: [
                  for (final (value, label) in [
                    ('all', widget.english ? 'All' : 'الكل'),
                    ('free', widget.english ? 'Direct' : 'مباشر'),
                    ('cached', widget.english ? 'Torrent' : 'تورنت'),
                    ('4k', '4K'),
                    ('1080p', '1080p'),
                  ])
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: _FilterChip(
                        label: label,
                        selected: _filter == value,
                        onTap: () => setState(() => _filter = value),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  hintText: widget.english ? 'Search streams' : 'بحث في المصادر',
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Flexible(
              child: rows.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(30),
                      child: Text(
                        widget.english
                            ? 'No streams match this filter.'
                            : 'لا مصادر تطابق هذا الفلتر.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white54),
                      ),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final stream = rows[index];
                        final quality = _qualityOf(stream);
                        final direct = stream['url'] is String;
                        final torrent = stream['infoHash'] is String;
                        final title = (stream['title'] ??
                                stream['name'] ??
                                stream['description'] ??
                                'Stream')
                            .toString()
                            .split('\n')
                            .first;
                        return _StreamRow(
                          title: title,
                          addon: stream['addonName']?.toString() ?? '',
                          quality: quality,
                          direct: direct,
                          torrent: torrent,
                          onTap: () => widget.onPick(stream),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  String? _qualityOf(Map<String, dynamic> stream) {
    final title =
        '${stream['name'] ?? ''} ${stream['title'] ?? ''} ${stream['description'] ?? ''}';
    if (RegExp(r'2160|4k', caseSensitive: false).hasMatch(title)) return '4K';
    if (RegExp(r'1080').hasMatch(title)) return '1080p';
    if (RegExp(r'720').hasMatch(title)) return '720p';
    if (RegExp(r'480|sd', caseSensitive: false).hasMatch(title)) return 'SD';
    return null;
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: selected
            ? HorseTheme.gold.withValues(alpha: .18)
            : HorseTheme.raised,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            child: Text(
              label,
              style: TextStyle(
                color: selected ? HorseTheme.gold : Colors.white60,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      );
}

class _StreamRow extends StatelessWidget {
  const _StreamRow({
    required this.title,
    required this.addon,
    required this.quality,
    required this.direct,
    required this.torrent,
    required this.onTap,
  });

  final String title;
  final String addon;
  final String? quality;
  final bool direct;
  final bool torrent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final playable = direct || torrent;
    return Material(
      color: HorseTheme.raised.withValues(alpha: .55),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: playable ? onTap : null,
        child: Container(
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: direct
                  ? const Color(0x5022C55E)
                  : HorseTheme.line,
            ),
          ),
          child: Row(
            children: [
              // Resolution chip.
              Container(
                width: 52,
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: direct
                      ? const Color(0x2F22C55E)
                      : HorseTheme.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    quality ?? '—',
                    style: TextStyle(
                      color: direct
                          ? const Color(0xFF6EE7A0)
                          : Colors.white60,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _Tag(
                          label: direct ? 'HTTP' : 'TORRENT',
                          accent: direct,
                        ),
                        if (addon.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              addon,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white38,
                                fontSize: 10.5,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Icon(
                playable
                    ? Icons.play_circle_outline_rounded
                    : Icons.cloud_off_rounded,
                color: playable ? HorseTheme.gold : Colors.white24,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.accent});
  final String label;
  final bool accent;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
        decoration: BoxDecoration(
          color: accent
              ? const Color(0x1A22C55E)
              : HorseTheme.canvas,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: accent
                ? const Color(0x5022C55E)
                : HorseTheme.line,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: accent ? const Color(0xFF6EE7A0) : Colors.white38,
            fontSize: 8.5,
            fontWeight: FontWeight.w800,
            letterSpacing: .6,
          ),
        ),
      );
}
