import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import '../player/video_player_page.dart';

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
  Map<String, dynamic>? _selectedVideo;
  bool _loadingStreams = false;

  @override
  void initState() {
    super.initState();
    final app = context.read<AppState>();
    _detail = app.catalogs.detail(widget.item.type, widget.item.id, app.addons);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    return Scaffold(
      body: FutureBuilder<MediaItem?>(
        future: _detail,
        builder: (context, snapshot) {
          final item = snapshot.data ?? widget.item;
          final videos = item.videos;
          final resumeMatches = videos.where(
            (video) => video['id'] == widget.resumeVideoId,
          );
          _selectedVideo ??= resumeMatches.isNotEmpty
              ? resumeMatches.first
              : _defaultVideo(videos);
          final wide = MediaQuery.sizeOf(context).width >= 700;
          return CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                backgroundColor: HorseTheme.canvas,
                title: Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                actions: [
                  IconButton(
                    tooltip: english ? 'My list' : 'قائمتي',
                    onPressed: () => app.toggleWatchlist(item),
                    icon: Icon(
                      app.contains(item)
                          ? Icons.bookmark_rounded
                          : Icons.bookmark_border_rounded,
                      color: app.contains(item) ? HorseTheme.gold : null,
                    ),
                  ),
                ],
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    wide ? 34 : 20,
                    8,
                    wide ? 34 : 20,
                    30,
                  ),
                  child: wide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _Poster(item: item, width: 250),
                            const SizedBox(width: 30),
                            Expanded(
                              child: _Description(
                                item: item,
                                videos: videos,
                                selectedVideo: _selectedVideo,
                                onSelectVideo: (v) =>
                                    setState(() => _selectedVideo = v),
                                loading: _loadingStreams,
                                onPlay: () => _play(item),
                              ),
                            ),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _Poster(item: item, width: 128),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: _CompactInfo(
                                    item: item,
                                    english: english,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            _Description(
                              item: item,
                              videos: videos,
                              selectedVideo: _selectedVideo,
                              onSelectVideo: (v) =>
                                  setState(() => _selectedVideo = v),
                              loading: _loadingStreams,
                              onPlay: () => _play(item),
                              compact: true,
                            ),
                          ],
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Map<String, dynamic>? _defaultVideo(List<Map<String, dynamic>> videos) {
    if (videos.isEmpty) return null;
    for (final video in videos) {
      final season = (video['season'] as num?)?.toInt() ?? 0;
      if (season > 0) return video;
    }
    return videos.first;
  }

  Future<void> _play(MediaItem item) async {
    final app = context.read<AppState>();
    final episode = _selectedVideo;
    final id = (episode?['id'] as String?) ?? item.id;
    setState(() => _loadingStreams = true);
    List<Map<String, dynamic>> streams;
    try {
      streams = await app.catalogs.streams(item.type, id, app.addons);
    } catch (_) {
      streams = [];
    }
    if (!mounted) return;
    setState(() => _loadingStreams = false);
    if (streams.isEmpty) {
      final english = app.english;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(english ? 'No streams found' : 'لم يتم العثور على مصادر'),
          content: Text(
            english
                ? 'Install a stream add-on from Settings, then try again.'
                : 'ثبّت إضافة بث من الإعدادات ثم أعد المحاولة.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(english ? 'Close' : 'إغلاق'),
            ),
          ],
        ),
      );
      return;
    }
    final english = app.english;
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: HorseTheme.surface,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                english ? 'Choose a source' : 'اختر مصدر التشغيل',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * .58,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: streams.length,
                  separatorBuilder: (_, __) =>
                      const Divider(color: HorseTheme.line),
                  itemBuilder: (context, index) {
                    final stream = streams[index];
                    final url = stream['url'] as String?;
                    final direct = url != null && url.startsWith('http');
                    final torrent = !direct && stream['infoHash'] is String;
                    final playable = direct || torrent;
                    final title = (stream['title'] ??
                            stream['name'] ??
                            stream['description'] ??
                            (playable ? 'HTTP stream' : 'Torrent stream'))
                        .toString()
                        .split('\n')
                        .first;
                    return ListTile(
                      enabled: playable,
                      leading: Icon(
                        playable
                            ? Icons.play_circle_outline_rounded
                            : Icons.cloud_off_rounded,
                        color: playable ? HorseTheme.gold : HorseTheme.muted,
                      ),
                      title: Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        '${stream['addonName'] ?? (english ? 'Add-on' : 'إضافة')}${torrent ? (english ? ' · Torrent source' : ' · مصدر تورنت') : (playable ? '' : (english ? ' · Unsupported source' : ' · مصدر غير مدعوم'))}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: playable
                          ? () => Navigator.pop(context, stream)
                          : null,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (selected == null || !mounted) return;
    setState(() => _loadingStreams = true);
    try {
      final rawUrl = selected['url'] as String?;
      final String url;
      if (rawUrl != null && rawUrl.startsWith('http')) {
        final hints =
            (selected['behaviorHints'] as Map?)?.cast<String, dynamic>() ??
                const <String, dynamic>{};
        final proxyHeaders =
            (hints['proxyHeaders'] as Map?)?.cast<String, dynamic>();
        final filename = (hints['filename'] ?? selected['title']) as String?;
        url = await app.api.signMediaUrl(
          rawUrl,
          proxyHeaders: proxyHeaders,
          filename: filename,
        );
      } else {
        url = app.api.debridService != null
            ? await app.api.resolveDebridTorrent(selected)
            : await app.api.prepareTorrent(selected);
      }
      if (!mounted) return;
      setState(() => _loadingStreams = false);
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => VideoPlayerPage(
            item: item,
            url: url,
            streamName: (selected['title'] ?? selected['addonName'] ?? 'Horse')
                .toString(),
            videoId: id,
            season: (episode?['season'] as num?)?.toInt(),
            episode: (episode?['episode'] as num?)?.toInt(),
            initialPositionMs: widget.resumeVideoId == episode?['id']
                ? widget.resumePositionMs
                : null,
          ),
          fullscreenDialog: true,
        ),
      );
    } catch (error) {
      if (mounted) setState(() => _loadingStreams = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }
}

class _Description extends StatelessWidget {
  const _Description({
    required this.item,
    required this.videos,
    required this.selectedVideo,
    required this.onSelectVideo,
    required this.loading,
    required this.onPlay,
    this.compact = false,
  });
  final MediaItem item;
  final List<Map<String, dynamic>> videos;
  final Map<String, dynamic>? selectedVideo;
  final ValueChanged<Map<String, dynamic>> onSelectVideo;
  final bool loading;
  final VoidCallback onPlay;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!compact) ...[
          _CompactInfo(item: item, english: english),
          const SizedBox(height: 18),
        ],
        if (item.description != null && item.description!.isNotEmpty)
          Text(
            item.description!,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: Colors.white70, height: 1.6),
          ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 7,
          runSpacing: 7,
          children: [
            for (final genre in item.genres.take(6))
              Chip(
                label: Text(genre),
                visualDensity: VisualDensity.compact,
                side: const BorderSide(color: HorseTheme.line),
                backgroundColor: HorseTheme.surface,
              ),
          ],
        ),
        if (videos.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text(
            english ? 'Episodes' : 'الحلقات',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 9),
          for (final video in videos.take(60))
            _EpisodeRow(
              video: video,
              selected: video['id'] == selectedVideo?['id'],
              onTap: () => onSelectVideo(video),
            ),
        ],
        const SizedBox(height: 22),
        SizedBox(
          width: compact ? double.infinity : 260,
          child: FilledButton.icon(
            onPressed: loading ? null : onPlay,
            icon: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.play_arrow_rounded),
            label: Text(
              loading
                  ? (english ? 'Finding streams…' : 'جارٍ البحث عن مصادر…')
                  : (english ? 'Find a stream' : 'ابحث عن مصدر تشغيل'),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          english
              ? 'Playback uses your selected add-on source.'
              : 'يعتمد التشغيل على مصدر الإضافة التي تختارها.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _EpisodeRow extends StatelessWidget {
  const _EpisodeRow({
    required this.video,
    required this.selected,
    required this.onTap,
  });
  final Map<String, dynamic> video;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final season = (video['season'] as num?)?.toInt();
    final episode = (video['episode'] as num?)?.toInt();
    final prefix = season != null && episode != null
        ? 'S${season.toString().padLeft(2, '0')} · E${episode.toString().padLeft(2, '0')}   '
        : '';
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: Icon(
        selected ? Icons.radio_button_checked : Icons.play_circle_outline,
        color: selected ? HorseTheme.gold : HorseTheme.muted,
      ),
      title: Text(
        '$prefix${video['name'] ?? video['title'] ?? 'Episode'}',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: selected ? HorseTheme.gold : HorseTheme.ink),
      ),
      subtitle: video['released'] is String
          ? Text(
              video['released'] as String,
              style: Theme.of(context).textTheme.bodySmall,
            )
          : null,
    );
  }
}

class _CompactInfo extends StatelessWidget {
  const _CompactInfo({required this.item, required this.english});
  final MediaItem item;
  final bool english;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.name,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 7),
          Wrap(
            spacing: 8,
            runSpacing: 5,
            children: [
              if (item.releaseInfo != null) _MetaBadge(item.releaseInfo!),
              _MetaBadge(
                item.type == 'series'
                    ? (english ? 'Series' : 'مسلسل')
                    : (english ? 'Movie' : 'فيلم'),
              ),
              if (item.rating != null)
                _MetaBadge('★ ${item.rating}', color: HorseTheme.gold),
            ],
          ),
        ],
      );
}

class _MetaBadge extends StatelessWidget {
  const _MetaBadge(this.text, {this.color = HorseTheme.muted});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: HorseTheme.surface,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: HorseTheme.line),
        ),
        child: Text(
          text,
          style: TextStyle(
              fontSize: 11, color: color, fontWeight: FontWeight.w600),
        ),
      );
}

class _Poster extends StatelessWidget {
  const _Poster({required this.item, required this.width});
  final MediaItem item;
  final double width;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          width: width,
          child: AspectRatio(
            aspectRatio: .68,
            child: item.poster == null
                ? const ColoredBox(
                    color: HorseTheme.raised,
                    child: Icon(
                      Icons.movie_outlined,
                      size: 38,
                      color: HorseTheme.gold,
                    ),
                  )
                : Image.network(
                    item.poster!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const ColoredBox(
                      color: HorseTheme.raised,
                      child: Icon(
                        Icons.movie_outlined,
                        size: 38,
                        color: HorseTheme.gold,
                      ),
                    ),
                  ),
          ),
        ),
      );
}
