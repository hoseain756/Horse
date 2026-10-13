import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';

/// Full-screen player replicating the web player's information architecture:
/// always-on top bar (close / title / streams), auto-hiding bottom transport
/// (3.2s), LTR seek bar with buffered + watched layers and a drag time
/// bubble, double-tap skip HUDs, speed & fit settings, Up-Next and Resume
/// cards. Chrome is white-on-black; gold accents mark active states only.
class VideoPlayerPage extends StatefulWidget {
  const VideoPlayerPage({
    super.key,
    required this.item,
    required this.url,
    required this.streamName,
    required this.videoId,
    this.initialPositionMs,
    this.season,
    this.episode,
    this.streams = const [],
    this.streamIndex,
    this.onSwitchStream,
  });

  final MediaItem item;
  final String url;
  final String streamName;
  final String videoId;
  final int? initialPositionMs;
  final int? season;
  final int? episode;
  final List<Map<String, dynamic>> streams;
  final int? streamIndex;
  final Future<void> Function(Map<String, dynamic> stream)? onSwitchStream;

  @override
  State<VideoPlayerPage> createState() => _VideoPlayerPageState();
}

class _VideoPlayerPageState extends State<VideoPlayerPage> {
  VideoPlayerController? _controller;
  Timer? _hideTimer;
  Timer? _progressTimer;
  Timer? _skipHudTimer;
  bool _controlsVisible = true;
  bool _failed = false;
  String? _error;
  bool _stopScrobbled = false;
  bool _initialized = false;
  bool _settingsOpen = false;
  bool _showRemaining = false;
  double _dragPreviewSeconds = -1;
  bool _resuming = false;
  int? _resumePositionMs;
  int _streamIndex = 0;
  bool _upNextDismissed = false;

  @override
  void initState() {
    super.initState();
    _streamIndex = widget.streamIndex ?? 0;
    _resumePositionMs = widget.initialPositionMs;
    _resuming = (_resumePositionMs ?? 0) > 30000;
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
      DeviceOrientation.portraitUp,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _progressTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_saveProgress()),
    );
    _createController();
  }

  void _createController() {
    final controller =
        VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _controller = controller;
    controller.addListener(_onVideoChanged);
    unawaited(_initialize(controller));
  }

  Future<void> _initialize(VideoPlayerController controller) async {
    try {
      await controller.initialize();
      if (!mounted) return;
      setState(() => _initialized = true);
      // Silent-resume path: the chip variant waits for the user's choice.
      if (!_resuming && (_resumePositionMs ?? 0) > 0) {
        final end = controller.value.duration.inMilliseconds;
        await controller.seekTo(
          Duration(
            milliseconds:
                (_resumePositionMs ?? 0).clamp(0, end - 5000).toInt(),
          ),
        );
      }
      await controller.play();
      _scrobble('start');
      _bumpControls();
      if (mounted) setState(() {});
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _failed = true;
        _error = error.toString();
      });
    }
  }

  void _onVideoChanged() {
    if (!mounted) return;
    final controller = _controller;
    if (controller == null) return;
    if (controller.value.hasError && !_failed) {
      setState(() {
        _failed = true;
        _error = controller.value.errorDescription;
      });
      return;
    }
    if (controller.value.isCompleted && !_stopScrobbled) {
      _stopScrobbled = true;
      _scrobble('stop');
      unawaited(_saveProgress());
      final next = _episodeAt(_currentEpisodeIndex() + 1);
      if (next != null && mounted) {
        setState(() {}); // Up-Next card reacts via nearEnd.
      }
    }
    setState(() {});
  }

  // ── Episodes ────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> get _episodes => widget.item.videos
      .where((v) => ((v['season'] as num?)?.toInt() ?? 0) > 0)
      .toList()
    ..sort((a, b) {
      final bySeason = ((a['season'] as num?) ?? 0)
          .compareTo((b['season'] as num?) ?? 0);
      if (bySeason != 0) return bySeason;
      return ((a['episode'] as num?) ?? 0)
          .compareTo((b['episode'] as num?) ?? 0);
    });

  int _currentEpisodeIndex() {
    if (widget.item.type != 'series') return -1;
    final episodes = _episodes;
    for (var i = 0; i < episodes.length; i++) {
      if (episodes[i]['id'] == widget.videoId) return i;
    }
    return episodes.isEmpty ? -1 : 0;
  }

  Map<String, dynamic>? _episodeAt(int index) {
    final episodes = _episodes;
    if (index < 0 || index >= episodes.length) return null;
    return episodes[index];
  }

  // ── Transport ───────────────────────────────────────────────────────────

  void _bumpControls() {
    setState(() => _controlsVisible = true);
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(milliseconds: 3200), () {
      if (mounted && (_controller?.value.isPlaying ?? false)) {
        setState(() {
          _controlsVisible = false;
          _settingsOpen = false;
        });
      }
    });
  }

  void _toggleControls() {
    if (_controlsVisible) {
      _hideTimer?.cancel();
      setState(() {
        _controlsVisible = false;
        _settingsOpen = false;
      });
    } else {
      _bumpControls();
    }
  }

  Future<void> _seekBy(int seconds) async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final duration = controller.value.duration;
    final target = controller.value.position + Duration(seconds: seconds);
    await controller.seekTo(
      Duration(
        milliseconds:
            target.inMilliseconds.clamp(0, duration.inMilliseconds).toInt(),
      ),
    );
    _showSkipHud(seconds);
    _bumpControls();
  }

  void _showSkipHud(int seconds) {
    _skipHudTimer?.cancel();
    setState(() {});
    _skipHudTimer = Timer(const Duration(milliseconds: 650), () {
      if (mounted) setState(() {});
    });
  }

  bool get _skipHudVisible => _skipHudTimer?.isActive ?? false;

  Future<void> _saveProgress() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final value = controller.value;
    await context.read<AppState>().recordPlayback(
          widget.item,
          positionMs: value.position.inMilliseconds,
          durationMs: value.duration.inMilliseconds,
          videoId: widget.videoId,
          season: widget.season,
          episode: widget.episode,
        );
  }

  void _scrobble(String action) {
    final app = context.read<AppState>();
    if (app.linkedServices.isEmpty) return;
    final value = _controller?.value;
    final duration = value?.duration.inMilliseconds ?? 0;
    final progress =
        duration <= 0 ? 0.0 : (value!.position.inMilliseconds / duration) * 100;
    unawaited(
      app.scrobble(
        action: action,
        progress: progress,
        imdbId: widget.item.id,
        type: widget.item.type == 'series' ? 'series' : 'movie',
        season: widget.season,
        episode: widget.episode,
      ),
    );
  }

  Future<void> _close() async {
    _scrobble('stop');
    _stopScrobbled = true;
    await _saveProgress();
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _switchStream(Map<String, dynamic> stream) async {
    final callback = widget.onSwitchStream;
    if (callback == null) return;
    await _saveProgress();
    await callback(stream);
  }

  // ── Build ───────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _hideTimer?.cancel();
    _progressTimer?.cancel();
    _skipHudTimer?.cancel();
    final controller = _controller;
    controller?.removeListener(_onVideoChanged);
    unawaited(_saveProgress());
    unawaited(controller?.dispose());
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(const []);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    final controller = _controller;
    final value = controller?.value;
    final initialized =
        _initialized && value != null && value.isInitialized && controller != null;
    final duration = value?.duration.inMilliseconds ?? 0;
    final position = value?.position.inMilliseconds ?? 0;
    final nearEnd =
        duration > 0 && (duration - position) <= 30000 ||
            (duration > 0 && position / duration >= 0.95);
    final nextEpisode = widget.item.type == 'series'
        ? _episodeAt(_currentEpisodeIndex() + 1)
        : null;
    final episodeIndex = _currentEpisodeIndex();
    final prevEpisode = widget.item.type == 'series'
        ? _episodeAt(episodeIndex - 1)
        : null;
    final speed = value?.playbackSpeed ?? 1.0;

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop && !_stopScrobbled) {
          _scrobble('stop');
          _stopScrobbled = true;
          unawaited(_saveProgress());
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _toggleControls,
          onDoubleTapDown: (details) {
            final width = MediaQuery.sizeOf(context).width;
            if (details.localPosition.dx < width * .34) {
              unawaited(_seekBy(-10));
            } else if (details.localPosition.dx > width * .66) {
              unawaited(_seekBy(10));
            } else {
              _togglePlay();
            }
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (initialized)
                FittedBox(
                  fit: _videoFit,
                  clipBehavior: Clip.hardEdge,
                  child: SizedBox(
                    width: value.size.width,
                    height: value.size.height,
                    child: VideoPlayer(controller),
                  ),
                )
              else if (_failed)
                _PlaybackError(
                  message: _error,
                  english: english,
                  onRetry: () {
                    final old = _controller;
                    old?.removeListener(_onVideoChanged);
                    unawaited(old?.dispose());
                    setState(() {
                      _failed = false;
                      _error = null;
                      _initialized = false;
                    });
                    _createController();
                  },
                )
              else
                const Center(
                  child: CircularProgressIndicator(
                    color: HorseTheme.gold,
                    strokeWidth: 2,
                  ),
                ),
              if (initialized && !_failed && _skipHudVisible)
                _SkipHud(english: english, skipHudVisible: _skipHudVisible),
              if (initialized && !_failed) ...[
                // Top bar — always visible (web spec).
                _TopBar(
                  title: widget.item.name,
                  subtitle: _topBarSubtitle(english),
                  onClose: _close,
                  onStreams: widget.onSwitchStream == null
                      ? null
                      : () => _openStreamSwitcher(context),
                  streamName: widget.streamName,
                  english: english,
                ),
                // Bottom transport — fades with controls.
                AnimatedOpacity(
                  opacity: _controlsVisible ? 1 : 0,
                  duration: const Duration(milliseconds: 300),
                  child: IgnorePointer(
                    ignoring: !_controlsVisible,
                    child: _BottomTransport(
                      controller: controller,
                      duration: duration,
                      position: position,
                      speed: speed,
                      isPlaying: value.isPlaying,
                      english: english,
                      showRemaining: _showRemaining,
                      dragPreviewSeconds: _dragPreviewSeconds,
                      canPrev: prevEpisode != null,
                      canNext: nextEpisode != null,
                      muted: value.volume == 0,
                      volume: value.volume,
                      isFullscreen: true,
                      onPlayPause: _togglePlay,
                      onSkip: (s) => unawaited(_seekBy(s)),
                      onPrev: prevEpisode == null
                          ? null
                          : () => _switchEpisode(prevEpisode),
                      onNext: nextEpisode == null
                          ? null
                          : () => _switchEpisode(nextEpisode),
                      onSeekStart: () {
                        _hideTimer?.cancel();
                        setState(() => _controlsVisible = true);
                      },
                      onDragUpdate: (seconds) =>
                          setState(() => _dragPreviewSeconds = seconds),
                      onDragEnd: () =>
                          setState(() => _dragPreviewSeconds = -1),
                      onToggleRemaining: () =>
                          setState(() => _showRemaining = !_showRemaining),
                      onMuteToggle: () async {
                        final c = _controller;
                        if (c == null) return;
                        final mutedNow = c.value.volume == 0;
                        await c.setVolume(mutedNow ? 1 : 0);
                        _bumpControls();
                      },
                      onVolumeChanged: (volume) async {
                        await _controller?.setVolume(volume);
                      },
                      onSettings: () =>
                          setState(() => _settingsOpen = !_settingsOpen),
                      onFullscreen: () async {
                        // Already immersive; re-assert and surface controls.
                        await SystemChrome.setEnabledSystemUIMode(
                          SystemUiMode.immersiveSticky,
                        );
                        _bumpControls();
                      },
                      settingsOpen: _settingsOpen,
                      onSeekTo: (ms) async {
                        final c = _controller;
                        if (c == null) return;
                        await c.seekTo(
                          Duration(
                            milliseconds: ms.clamp(0, duration).toInt(),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                if (_settingsOpen && _controlsVisible)
                  _SettingsPanel(
                    english: english,
                    speed: speed,
                    fit: _videoFit,
                    durationsMs: duration,
                    onSpeed: (value) async {
                      await _controller?.setPlaybackSpeed(value);
                      _bumpControls();
                    },
                    onFit: (fit) => setState(() {
                      _fit = fit;
                      _bumpControls();
                    }),
                    onClose: () => setState(() => _settingsOpen = false),
                  ),
                // Resume chip (web spec).
                if (_resuming && (_resumePositionMs ?? 0) > 30000)
                  _ResumeCard(
                    english: english,
                    resumeMs: _resumePositionMs ?? 0,
                    onResume: _resumeFromSaved,
                    onStartOver: () async {
                      setState(() {
                        _resuming = false;
                        _resumePositionMs = 0;
                      });
                      await _controller
                          ?.seekTo(Duration.zero);
                      await _controller?.play();
                    },
                    onDismiss: () => setState(() => _resuming = false),
                  ),
                // Up-Next card (web spec).
                if (nextEpisode != null &&
                    nearEnd &&
                    !_upNextDismissed &&
                    !_stopScrobbled &&
                    duration > 0)
                  _UpNextCard(
                    english: english,
                    episode: nextEpisode,
                    countdownSeconds:
                        ((duration - position) / 1000).ceil().clamp(0, 30),
                    onNext: () => _switchEpisode(nextEpisode),
                    onDismiss: () =>
                        setState(() => _upNextDismissed = true),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  BoxFit get _videoFit => _fit;
  BoxFit _fit = BoxFit.contain;

  void _togglePlay() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (controller.value.isPlaying) {
      controller.pause();
      _scrobble('pause');
      _bumpControls();
    } else {
      controller.play();
      _scrobble('start');
      _bumpControls();
    }
  }

  String _topBarSubtitle(bool english) {
    if (widget.season == null || widget.episode == null) return widget.streamName;
    return english
        ? 'S${widget.season}:E${widget.episode} · ${widget.streamName}'
        : 'الموسم ${widget.season} · الحلقة ${widget.episode}';
  }

  Future<void> _openStreamSwitcher(BuildContext context) async {
    final english = context.read<AppState>().english;
    if (widget.streams.isEmpty) return;
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: HorseTheme.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                english ? 'Choose a stream' : 'اختر مصدر التشغيل',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * .58,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: widget.streams.length,
                  separatorBuilder: (_, __) =>
                      const Divider(color: HorseTheme.line),
                  itemBuilder: (context, index) {
                    final stream = widget.streams[index];
                    final title = (stream['title'] ??
                            stream['name'] ??
                            stream['description'] ??
                            'Stream')
                        .toString()
                        .split('\n')
                        .first;
                    return ListTile(
                      selected: index == _streamIndex,
                      leading: Icon(
                        index == _streamIndex
                            ? Icons.radio_button_checked
                            : Icons.play_circle_outline_rounded,
                        color: index == _streamIndex
                            ? HorseTheme.gold
                            : HorseTheme.muted,
                      ),
                      title: Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        stream['addonName']?.toString() ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => Navigator.pop(context, stream),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (selected != null) {
      await _switchStream(selected);
    }
  }

  Future<void> _resumeFromSaved() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final end = controller.value.duration.inMilliseconds;
    await controller.seekTo(
      Duration(
        milliseconds:
            (_resumePositionMs ?? 0).clamp(0, end - 5000).toInt(),
      ),
    );
    await controller.play();
    if (mounted) setState(() => _resuming = false);
    _bumpControls();
  }

  Future<void> _switchEpisode(Map<String, dynamic> episode) async {
    final app = context.read<AppState>();
    final english = app.english;
    final episodeId = (episode['id'] ?? widget.item.id).toString();
    if (episodeId == widget.videoId) return;
    // Resolve streams for the new episode through the app's catalog layer.
    try {
      final streams =
          await app.catalogs.streams(widget.item.type, episodeId, app.addons);
      final playable = streams
          .where((stream) => stream['url'] != null)
          .toList();
      if (playable.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                english
                    ? 'No playable source for the next episode.'
                    : 'لا يوجد مصدر قابل للتشغيل للحلقة التالية.',
              ),
            ),
          );
        }
        return;
      }
      final stream = playable.first;
      final url = stream['url'].toString();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => VideoPlayerPage(
            item: widget.item,
            url: url,
            streamName: (stream['title'] ?? stream['addonName'] ?? 'Horse')
                .toString(),
            videoId: episodeId,
            season: (episode['season'] as num?)?.toInt(),
            episode: (episode['episode'] as num?)?.toInt(),
            streams: playable,
            streamIndex: 0,
          ),
          fullscreenDialog: true,
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }
}

// ── Top bar ───────────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.subtitle,
    required this.onClose,
    required this.onStreams,
    required this.streamName,
    required this.english,
  });

  final String title;
  final String subtitle;
  final VoidCallback onClose;
  final VoidCallback? onStreams;
  final String streamName;
  final bool english;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xCC000000), Colors.transparent],
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 6, 14, 34),
            child: Row(
              children: [
                _CircleIcon(icon: Icons.close_rounded, onTap: onClose),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (subtitle.isNotEmpty)
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onStreams != null) ...[
                  const SizedBox(width: 10),
                  Material(
                    color: Colors.black.withValues(alpha: .5),
                    borderRadius: BorderRadius.circular(999),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: onStreams,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 13,
                          vertical: 7,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.swap_horiz_rounded,
                                size: 15, color: Colors.white),
                            SizedBox(width: 6),
                            Text(
                              'Streams',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CircleIcon extends StatelessWidget {
  const _CircleIcon({required this.icon, required this.onTap, this.size = 20});
  final IconData icon;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white.withValues(alpha: .05),
        shape: const CircleBorder(
          side: BorderSide(color: Colors.white24),
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, color: Colors.white, size: size),
          ),
        ),
      );
}

// ── Bottom transport ──────────────────────────────────────────────────────

class _BottomTransport extends StatelessWidget {
  const _BottomTransport({
    required this.controller,
    required this.duration,
    required this.position,
    required this.speed,
    required this.isPlaying,
    required this.english,
    required this.showRemaining,
    required this.dragPreviewSeconds,
    required this.canPrev,
    required this.canNext,
    required this.muted,
    required this.volume,
    required this.isFullscreen,
    required this.onPlayPause,
    required this.onSkip,
    required this.onPrev,
    required this.onNext,
    required this.onSeekStart,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onToggleRemaining,
    required this.onMuteToggle,
    required this.onVolumeChanged,
    required this.onSettings,
    required this.onFullscreen,
    required this.settingsOpen,
    required this.onSeekTo,
  });

  final VideoPlayerController? controller;
  final int duration;
  final int position;
  final double speed;
  final bool isPlaying;
  final bool english;
  final bool showRemaining;
  final double dragPreviewSeconds;
  final bool canPrev;
  final bool canNext;
  final bool muted;
  final double volume;
  final bool isFullscreen;
  final VoidCallback onPlayPause;
  final ValueChanged<int> onSkip;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final VoidCallback onSeekStart;
  final ValueChanged<double> onDragUpdate;
  final VoidCallback onDragEnd;
  final VoidCallback onToggleRemaining;
  final VoidCallback onMuteToggle;
  final ValueChanged<double> onVolumeChanged;
  final VoidCallback onSettings;
  final VoidCallback onFullscreen;
  final bool settingsOpen;
  final ValueChanged<int> onSeekTo;

  @override
  Widget build(BuildContext context) {
    final bufferedEnd = controller?.value.buffered.isNotEmpty == true
        ? controller!.value.buffered.last.end.inMilliseconds
        : 0;
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              Color(0xE6000000),
              Color(0x80000000),
              Colors.transparent,
            ],
          ),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 44, 16, 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Seek row — bar is always LTR (media convention).
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    children: [
                      _TimeLabel(
                        text: _fmt(
                          Duration(
                            milliseconds:
                                dragPreviewSeconds >= 0
                                    ? (dragPreviewSeconds * 1000).round()
                                    : position,
                          ),
                        ),
                      ),
                      Expanded(
                        child: _SeekBar(
                          duration: duration,
                          position: position,
                          buffered: bufferedEnd,
                          previewSeconds: dragPreviewSeconds,
                          onSeekStart: onSeekStart,
                          onDrag: (seconds) => onDragUpdate(seconds),
                          onDragEnd: (seconds) {
                            onSeekTo((seconds * 1000).round());
                            onDragEnd();
                          },
                        ),
                      ),
                      InkWell(
                        borderRadius: BorderRadius.circular(6),
                        onTap: onToggleRemaining,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          child: Text(
                            showRemaining && duration > 0
                                ? '-${_fmt(Duration(milliseconds: duration - position))}'
                                : _fmt(
                                    Duration(
                                      milliseconds:
                                          dragPreviewSeconds >= 0
                                              ? (dragPreviewSeconds * 1000)
                                                  .round()
                                              : position,
                                    ),
                                  ),
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 12,
                              fontFeatures: [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                // Control row.
                Row(
                  children: [
                    // Play / pause — the only white-filled control.
                    GestureDetector(
                      onTap: onPlayPause,
                      child: Container(
                        width: 58,
                        height: 58,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black26,
                              blurRadius: 14,
                              offset: Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Icon(
                          isPlaying
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          color: Colors.black,
                          size: 30,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    _CircleIcon(
                      icon: Icons.replay_10_rounded,
                      size: 22,
                      onTap: () => onSkip(-10),
                    ),
                    const SizedBox(width: 6),
                    _CircleIcon(
                      icon: Icons.forward_10_rounded,
                      size: 22,
                      onTap: () => onSkip(10),
                    ),
                    if (canPrev || canNext) ...[
                      const SizedBox(width: 6),
                      IconButton(
                        onPressed: canPrev ? onPrev : null,
                        icon: Icon(
                          Icons.skip_previous_rounded,
                          color:
                              canPrev ? Colors.white : Colors.white38,
                          size: 26,
                        ),
                        tooltip: english
                            ? 'Previous episode'
                            : 'الحلقة السابقة',
                      ),
                      IconButton(
                        onPressed: canNext ? onNext : null,
                        icon: Icon(
                          Icons.skip_next_rounded,
                          color:
                              canNext ? Colors.white : Colors.white38,
                          size: 26,
                        ),
                        tooltip: english ? 'Next episode' : 'الحلقة التالية',
                      ),
                    ],
                    const SizedBox(width: 6),
                    _CircleIcon(
                      icon: muted
                          ? Icons.volume_off_rounded
                          : Icons.volume_up_rounded,
                      size: 20,
                      onTap: onMuteToggle,
                    ),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 92),
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 3,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 7,
                          ),
                          overlayShape:
                              const RoundSliderOverlayShape(overlayRadius: 12),
                          inactiveTrackColor: Colors.white24,
                          activeTrackColor: Colors.white,
                          thumbColor: Colors.white,
                        ),
                        child: Slider(
                          value: volume.clamp(0, 1),
                          onChanged: onVolumeChanged,
                        ),
                      ),
                    ),
                    const Spacer(),
                    _CircleIcon(
                      icon: Icons.tune_rounded,
                      size: 20,
                      onTap: onSettings,
                    ),
                    const SizedBox(width: 4),
                    _CircleIcon(
                      icon: isFullscreen
                          ? Icons.fullscreen_exit_rounded
                          : Icons.fullscreen_rounded,
                      size: 20,
                      onTap: onFullscreen,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TimeLabel extends StatelessWidget {
  const _TimeLabel({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white60,
            fontSize: 12,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      );
}

class _SeekBar extends StatefulWidget {
  const _SeekBar({
    required this.duration,
    required this.position,
    required this.buffered,
    required this.previewSeconds,
    required this.onSeekStart,
    required this.onDrag,
    required this.onDragEnd,
  });

  final int duration;
  final int position;
  final int buffered;
  final double previewSeconds;
  final VoidCallback onSeekStart;
  final ValueChanged<double> onDrag;
  final ValueChanged<double> onDragEnd;

  @override
  State<_SeekBar> createState() => _SeekBarState();
}

class _SeekBarState extends State<_SeekBar> {
  bool _dragging = false;
  double _dragValue = 0;

  @override
  Widget build(BuildContext context) {
    final duration = widget.duration;
    final progress = duration > 0
        ? (_dragging ? _dragValue : widget.position) / duration
        : 0.0;
    final buffered = duration > 0
        ? (widget.buffered / duration).clamp(0.0, 1.0)
        : 0.0;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onHorizontalDragStart: duration <= 0
          ? null
          : (details) {
              widget.onSeekStart();
              setState(() {
                _dragging = true;
                _dragValue = _valueFrom(details.localPosition.dx);
              });
              widget.onDrag(_dragValue * duration / 1000);
            },
      onHorizontalDragUpdate: duration <= 0
          ? null
          : (details) {
              setState(
                () => _dragValue =
                    _valueFrom(details.localPosition.dx).clamp(0.0, 1.0),
              );
              widget.onDrag(_dragValue * duration / 1000);
            },
      onHorizontalDragEnd: duration <= 0
          ? null
          : (details) {
              widget.onDragEnd(_dragValue * duration / 1000);
              setState(() => _dragging = false);
            },
      onHorizontalDragCancel: () => setState(() => _dragging = false),
      onTapUp: duration <= 0
          ? null
          : (details) {
              final seconds =
                  _valueFrom(details.localPosition.dx) * duration / 1000;
              widget.onSeekStart();
              widget.onDragEnd(seconds);
            },
      child: SizedBox(
        height: 44,
        child: Stack(
          alignment: Alignment.centerLeft,
          children: [
            // Track
            Container(
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            // Buffered
            FractionallySizedBox(
              widthFactor: buffered,
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white38,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            // Watched
            FractionallySizedBox(
              widthFactor: progress.clamp(0.0, 1.0),
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            // Thumb + drag bubble measured against the real track width.
            LayoutBuilder(builder: (context, constraints) {
              final trackWidth = constraints.maxWidth;
              final clamped = progress.clamp(0.0, 1.0);
              final thumbSize = _dragging ? 18.0 : 14.0;
              final thumbLeft = (clamped * trackWidth - thumbSize / 2)
                  .clamp(0.0, (trackWidth - thumbSize).clamp(0.0, trackWidth));
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: thumbLeft,
                    child: Container(
                      width: thumbSize,
                      height: thumbSize,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black38,
                            blurRadius: 5,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_dragging && widget.duration > 0)
                    Positioned(
                      left: (clamped * trackWidth - 40)
                          .clamp(0.0, (trackWidth - 80).clamp(0.0, trackWidth)),
                      bottom: 30,
                      child: Container(
                        width: 80,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black87,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _fmt(
                            Duration(
                              milliseconds:
                                  (clamped * widget.duration).round(),
                            ),
                          ),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                    ),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  double _valueFrom(double dx) {
    final box = context.findRenderObject() as RenderBox?;
    final width = box?.size.width ?? 1;
    return (dx / (width == 0 ? 1 : width)).clamp(0.0, 1.0);
  }
}

String _fmt(Duration value) {
  final hours = value.inHours;
  final minutes = value.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
  return hours > 0 ? '$hours:$minutes:$seconds' : '${value.inMinutes}:$seconds';
}

// ── HUDs and cards ────────────────────────────────────────────────────────

class _SkipHud extends StatelessWidget {
  const _SkipHud({required this.english, required this.skipHudVisible});
  final bool english;
  final bool skipHudVisible;

  @override
  Widget build(BuildContext context) => Center(
        child: AnimatedOpacity(
          opacity: skipHudVisible ? 1 : 0,
          duration: const Duration(milliseconds: 200),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: .7),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Text(
                english ? '±10 s' : '±10 ث',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      );
}

class _ResumeCard extends StatelessWidget {
  const _ResumeCard({
    required this.english,
    required this.resumeMs,
    required this.onResume,
    required this.onStartOver,
    required this.onDismiss,
  });

  final bool english;
  final int resumeMs;
  final VoidCallback onResume;
  final VoidCallback onStartOver;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) => Positioned.directional(
        textDirection: Directionality.of(context),
        bottom: 112,
        start: 16,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 340),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: HorseTheme.raised.withValues(alpha: .96),
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Colors.black45,
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(Icons.history_rounded,
                      size: 15, color: HorseTheme.gold),
                  const SizedBox(width: 7),
                  Text(
                    english ? 'RESUME' : 'استئناف',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: onDismiss,
                    child: const Icon(Icons.close_rounded,
                        size: 17, color: Colors.white38),
                  ),
                ],
              ),
              const SizedBox(height: 7),
              Text(
                english
                    ? 'Resume from ${_fmt(Duration(milliseconds: resumeMs))}?'
                    : 'استئناف من ${_fmt(Duration(milliseconds: resumeMs))}؟',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 11),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: HorseTheme.gold,
                        foregroundColor: const Color(0xFF1A1209),
                        minimumSize: const Size.fromHeight(36),
                      ),
                      onPressed: onResume,
                      child: Text(english ? 'Resume' : 'استئناف'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(36),
                      ),
                      onPressed: onStartOver,
                      child: Text(english ? 'Start over' : 'من البداية'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
}

class _UpNextCard extends StatelessWidget {
  const _UpNextCard({
    required this.english,
    required this.episode,
    required this.countdownSeconds,
    required this.onNext,
    required this.onDismiss,
  });

  final bool english;
  final Map<String, dynamic> episode;
  final int countdownSeconds;
  final VoidCallback onNext;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) => Positioned.directional(
        textDirection: Directionality.of(context),
        bottom: 112,
        end: 16,
        child: Container(
          width: 288,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: HorseTheme.raised.withValues(alpha: .97),
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Colors.black45,
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(Icons.skip_next_rounded,
                      size: 15, color: HorseTheme.gold),
                  const SizedBox(width: 7),
                  Text(
                    english ? 'UP NEXT' : 'التالي',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: HorseTheme.canvas,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: HorseTheme.line),
                    ),
                    child: Text(
                      countdownSeconds > 0
                          ? '${english ? 'in' : 'بعد'} ${countdownSeconds}s'
                          : (english ? 'now' : 'الآن'),
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 9),
              Text(
                (episode['name'] ?? episode['title'] ?? 'Episode').toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (episode['season'] != null && episode['episode'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(
                    'S${(episode['season'] as num).toInt()}:E${(episode['episode'] as num).toInt()}',
                    style: const TextStyle(
                        color: Colors.white54, fontSize: 12),
                  ),
                ),
              const SizedBox(height: 11),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: HorseTheme.gold,
                        foregroundColor: const Color(0xFF1A1209),
                        minimumSize: const Size.fromHeight(36),
                      ),
                      onPressed: onNext,
                      child: Text(
                        english ? 'Next episode' : 'الحلقة التالية',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(36),
                    ),
                    onPressed: onDismiss,
                    child: Text(english ? 'Cancel' : 'إلغاء'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
}

// ── Settings panel ────────────────────────────────────────────────────────

class _SettingsPanel extends StatelessWidget {
  const _SettingsPanel({
    required this.english,
    required this.speed,
    required this.fit,
    required this.durationsMs,
    required this.onSpeed,
    required this.onFit,
    required this.onClose,
  });

  final bool english;
  final double speed;
  final BoxFit fit;
  final int durationsMs;
  final ValueChanged<double> onSpeed;
  final ValueChanged<BoxFit> onFit;
  final VoidCallback onClose;

  static const _speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  @override
  Widget build(BuildContext context) {
    return Positioned.directional(
      textDirection: Directionality.of(context),
      bottom: 96,
      end: 12,
      child: Material(
        color: HorseTheme.raised.withValues(alpha: .97),
        borderRadius: BorderRadius.circular(28),
        child: Container(
          width: 256,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: HorseTheme.line),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    english ? 'SETTINGS' : 'الإعدادات',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: onClose,
                    child: const Icon(Icons.close_rounded,
                        size: 16, color: Colors.white38),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                english ? 'Speed' : 'السرعة',
                style: const TextStyle(
                  color: Colors.white38,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: .8,
                ),
              ),
              const SizedBox(height: 7),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 2.6,
                children: [
                  for (final value in _speeds)
                    _Chip(
                      label: '${value == 1.0 ? '1' : value}×',
                      selected: (speed - value).abs() < .01,
                      onTap: () => onSpeed(value),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                english ? 'Video fit' : 'ملاءمة الفيديو',
                style: const TextStyle(
                  color: Colors.white38,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: .8,
                ),
              ),
              const SizedBox(height: 7),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 2.2,
                children: [
                  _Chip(
                    label: english ? 'Fit' : 'احتواء',
                    selected: fit == BoxFit.contain,
                    onTap: () => onFit(BoxFit.contain),
                  ),
                  _Chip(
                    label: english ? 'Fill' : 'ملء',
                    selected: fit == BoxFit.cover,
                    onTap: () => onFit(BoxFit.cover),
                  ),
                  _Chip(
                    label: english ? 'Zoom' : 'تكبير',
                    selected: fit == BoxFit.scaleDown,
                    onTap: () => onFit(BoxFit.scaleDown),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
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
            : Colors.white.withValues(alpha: .05),
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Center(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: selected ? HorseTheme.gold : Colors.white70,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      );
}

class _PlaybackError extends StatelessWidget {
  const _PlaybackError({
    required this.message,
    required this.english,
    required this.onRetry,
  });
  final String? message;
  final bool english;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 46,
                color: Color(0xFFFF8178),
              ),
              const SizedBox(height: 14),
              Text(
                english
                    ? 'Playback error'
                    : 'خطأ في التشغيل',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              if (message != null)
                Text(
                  message!,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(english ? 'Try again' : 'إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
}
