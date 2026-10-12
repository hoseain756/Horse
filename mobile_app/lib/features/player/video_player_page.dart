import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';

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
  });

  final MediaItem item;
  final String url;
  final String streamName;
  final String videoId;
  final int? initialPositionMs;
  final int? season;
  final int? episode;

  @override
  State<VideoPlayerPage> createState() => _VideoPlayerPageState();
}

class _VideoPlayerPageState extends State<VideoPlayerPage> {
  late VideoPlayerController _controller;
  late final AppState _app;
  Timer? _hideTimer;
  Timer? _progressTimer;
  bool _controlsVisible = true;
  bool _failed = false;
  bool _stopScrobbled = false;
  bool _completionScrobbled = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _app = context.read<AppState>();
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _createController();
    _initialize();
    _scheduleHide();
    _progressTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _saveProgress(),
    );
  }

  void _createController() {
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _controller.addListener(_onVideoChanged);
  }

  Future<void> _initialize() async {
    try {
      await _controller.initialize();
      if (widget.initialPositionMs != null && widget.initialPositionMs! > 0) {
        final end = _controller.value.duration.inMilliseconds;
        await _controller.seekTo(
          Duration(
            milliseconds: widget.initialPositionMs!.clamp(0, end).toInt(),
          ),
        );
      }
      await _controller.play();
      _scrobble('start');
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
    if (_controller.value.isCompleted && !_completionScrobbled) {
      _completionScrobbled = true;
      _stopScrobbled = true;
      _scrobble('stop');
    }
    if (_controller.value.hasError) {
      setState(() {
        _failed = true;
        _error = _controller.value.errorDescription;
      });
    } else {
      setState(() {});
    }
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _controller.value.isPlaying) {
        setState(() => _controlsVisible = false);
      }
    });
  }

  void _toggleControls() {
    setState(() => _controlsVisible = !_controlsVisible);
    if (_controlsVisible) {
      _scheduleHide();
    } else {
      _hideTimer?.cancel();
    }
  }

  Future<void> _seek(Duration offset) async {
    final duration = _controller.value.duration;
    final target = _controller.value.position + offset;
    await _controller.seekTo(
      Duration(
        milliseconds:
            target.inMilliseconds.clamp(0, duration.inMilliseconds).toInt(),
      ),
    );
    _scheduleHide();
  }

  Future<void> _saveProgress() async {
    if (!_controller.value.isInitialized) return;
    final value = _controller.value;
    await _app.recordPlayback(
      widget.item,
      positionMs: value.position.inMilliseconds,
      durationMs: value.duration.inMilliseconds,
      videoId: widget.videoId,
      season: widget.season,
      episode: widget.episode,
    );
  }

  void _scrobble(String action) {
    final imdbId = widget.item.id;
    if (!RegExp(r'^tt\d+$').hasMatch(imdbId)) return;
    final value = _controller.value;
    final duration = value.duration.inMilliseconds;
    final progress =
        duration <= 0 ? 0.0 : value.position.inMilliseconds / duration * 100;
    final type = widget.item.type == 'series' ? 'episode' : 'movie';
    for (final service in const ['trakt', 'simkl']) {
      final link = _app.linkedServices[service];
      final linkId = link?['linkId']?.toString();
      if (linkId == null || linkId.isEmpty) continue;
      unawaited(
        _app.api.scrobbleLinkedService(
          service: service,
          linkId: linkId,
          action: action,
          progress: progress,
          imdbId: imdbId,
          type: type,
          season: type == 'episode' ? widget.season : null,
          episode: type == 'episode' ? widget.episode : null,
        ),
      );
    }
  }

  Future<void> _close() async {
    _scrobble('stop');
    _stopScrobbled = true;
    await _saveProgress();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _progressTimer?.cancel();
    _controller.removeListener(_onVideoChanged);
    unawaited(_saveProgress());
    unawaited(_controller.dispose());
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(const []);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    final value = _controller.value;
    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          if (!_stopScrobbled) _scrobble('stop');
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
              _seek(const Duration(seconds: -10));
            }
            if (details.localPosition.dx > width * .66) {
              _seek(const Duration(seconds: 10));
            }
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (value.isInitialized && !_failed)
                Center(
                  child: AspectRatio(
                    aspectRatio: value.aspectRatio,
                    child: VideoPlayer(_controller),
                  ),
                )
              else if (_failed)
                _PlaybackError(
                  message: _error,
                  english: english,
                  onRetry: () {
                    setState(() {
                      _failed = false;
                      _error = null;
                    });
                    unawaited(_controller.dispose());
                    _createController();
                    _initialize();
                  },
                )
              else
                const Center(
                  child: CircularProgressIndicator(
                    color: HorseTheme.gold,
                    strokeWidth: 2,
                  ),
                ),
              if (!_failed && _controlsVisible)
                DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0xB8000000),
                        Colors.transparent,
                        Colors.transparent,
                        Color(0xB8000000),
                      ],
                      stops: [0, .26, .65, 1],
                    ),
                  ),
                  child: SafeArea(
                    child: Column(
                      children: [
                        Row(
                          children: [
                            IconButton(
                              onPressed: _close,
                              icon: const Icon(
                                Icons.arrow_back_rounded,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    widget.item.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    _episodeLabel(english),
                                    style: const TextStyle(
                                      color: Colors.white60,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Flexible(
                              child: Text(
                                widget.streamName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white60,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                            const SizedBox(width: 15),
                          ],
                        ),
                        const Spacer(),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            IconButton(
                              onPressed: () =>
                                  _seek(const Duration(seconds: -10)),
                              iconSize: 30,
                              icon: const Icon(
                                Icons.replay_10_rounded,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: .42),
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white24),
                              ),
                              child: IconButton(
                                onPressed: () {
                                  if (value.isPlaying) {
                                    _controller.pause();
                                    _scrobble('pause');
                                  } else {
                                    _controller.play();
                                    _scrobble('start');
                                  }
                                  _scheduleHide();
                                },
                                iconSize: 38,
                                icon: Icon(
                                  value.isPlaying
                                      ? Icons.pause_rounded
                                      : Icons.play_arrow_rounded,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            IconButton(
                              onPressed: () =>
                                  _seek(const Duration(seconds: 10)),
                              iconSize: 30,
                              icon: const Icon(
                                Icons.forward_10_rounded,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Padding(
                          padding: const EdgeInsetsDirectional.fromSTEB(
                            20,
                            0,
                            20,
                            10,
                          ),
                          child: _Timeline(controller: _controller),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _episodeLabel(bool english) {
    if (widget.season == null || widget.episode == null) {
      return widget.streamName;
    }
    return english
        ? 'Season ${widget.season} · Episode ${widget.episode}'
        : 'الموسم ${widget.season} · الحلقة ${widget.episode}';
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.controller});
  final VideoPlayerController controller;
  @override
  Widget build(BuildContext context) {
    final value = controller.value;
    final duration = value.duration.inMilliseconds;
    final position = value.position.inMilliseconds
        .clamp(0, duration > 0 ? duration : 0)
        .toInt();
    return Row(
      children: [
        Text(
          _time(Duration(milliseconds: position)),
          style: const TextStyle(color: Colors.white, fontSize: 11),
        ),
        Expanded(
          child: SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 3,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
            ),
            child: Slider(
              value: duration > 0 ? position.toDouble() : 0,
              max: duration > 0 ? duration.toDouble() : 1,
              activeColor: HorseTheme.gold,
              inactiveColor: Colors.white30,
              onChanged: duration <= 0
                  ? null
                  : (value) => controller.seekTo(
                        Duration(milliseconds: value.round()),
                      ),
            ),
          ),
        ),
        Text(
          _time(value.duration),
          style: const TextStyle(color: Colors.white, fontSize: 11),
        ),
      ],
    );
  }

  String _time(Duration value) {
    final hours = value.inHours;
    final minutes = value.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return hours > 0
        ? '$hours:$minutes:$seconds'
        : '${value.inMinutes}:$seconds';
  }
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
                color: Color(0xFFE88178),
              ),
              const SizedBox(height: 14),
              Text(
                english
                    ? 'This source could not be played'
                    : 'تعذر تشغيل هذا المصدر',
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
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(english ? 'Try again' : 'إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
}
