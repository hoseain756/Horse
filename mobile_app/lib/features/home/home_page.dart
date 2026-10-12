import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import '../../shared/widgets/media_rail.dart';
import '../media/media_detail_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  Future<List<List<MediaItem>>>? _feed;
  String? _addonSignature;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = context.watch<AppState>();
    final signature = app.addons.map((e) => '${e.id}:${e.enabled}').join('|');
    if (_feed == null || signature != _addonSignature) {
      _addonSignature = signature;
      _feed = _load(app);
    }
  }

  Future<List<List<MediaItem>>> _load(AppState app) async {
    final jobs = <Future<List<MediaItem>>>[
      app.catalogs.homeTopTen(),
      app.catalogs.catalog('movie', 'trailer'),
      app.catalogs.catalog('series', 'trailer'),
      app.catalogs.catalog('series', 'last-videos'),
      app.catalogs.addonCatalogs(app.addons),
    ];
    return Future.wait(
      jobs.map((job) async {
        try {
          return await job;
        } catch (_) {
          return <MediaItem>[];
        }
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    return FutureBuilder<List<List<MediaItem>>>(
      future: _feed,
      builder: (context, snapshot) {
        final rows = snapshot.data ?? const <List<MediaItem>>[];
        final featured =
            rows.isNotEmpty && rows.first.isNotEmpty ? rows.first.first : null;
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      english
                          ? 'Your next story starts here'
                          : 'حكايتك التالية تبدأ هنا',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 5),
                    Text(
                      english
                          ? 'Discover something worth watching.'
                          : 'اكتشف شيئًا يستحق المشاهدة.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(color: HorseTheme.muted),
                    ),
                    const SizedBox(height: 20),
                    if (featured != null)
                      _FeaturedCard(
                        item: featured,
                        onTap: () => _open(featured),
                      )
                    else if (snapshot.connectionState ==
                        ConnectionState.waiting)
                      const _FeaturedSkeleton()
                    else
                      _ServiceMessage(
                        english: english,
                        onRetry: () => setState(() => _feed = _load(app)),
                      ),
                  ],
                ),
              ),
            ),
            if (app.continueWatching.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: _ContinueRail(
                    entries: app.continueWatching,
                    english: english,
                  ),
                ),
              ),
            if (rows.isNotEmpty && rows[0].isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 28),
                  child: MediaRail(
                    title: english ? 'Top 10 Today' : 'أفضل 10 اليوم',
                    items: rows[0],
                    numbered: true,
                    onTap: _open,
                  ),
                ),
              ),
            if (rows.length > 1 && rows[1].isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 28),
                  child: MediaRail(
                    title:
                        english ? 'Movies to explore' : 'أفلام تستحق الاكتشاف',
                    items: rows[1],
                    onTap: _open,
                  ),
                ),
              ),
            if (rows.length > 2 && rows[2].isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 28),
                  child: MediaRail(
                    title: english ? 'Popular series' : 'مسلسلات رائجة',
                    items: rows[2],
                    onTap: _open,
                  ),
                ),
              ),
            if (rows.length > 3 && rows[3].isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 28),
                  child: MediaRail(
                    title: english ? 'New episodes' : 'حلقات جديدة',
                    items: rows[3],
                    onTap: _open,
                  ),
                ),
              ),
            if (rows.length > 4 && rows[4].isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 32),
                  child: MediaRail(
                    title: english ? 'From your add-ons' : 'من إضافاتك',
                    items: rows[4],
                    onTap: _open,
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 28)),
          ],
        );
      },
    );
  }

  void _open(MediaItem item) => Navigator.of(
        context,
      ).push(
          MaterialPageRoute<void>(builder: (_) => MediaDetailPage(item: item)));
}

class _ContinueRail extends StatelessWidget {
  const _ContinueRail({required this.entries, required this.english});
  final List<WatchHistoryEntry> entries;
  final bool english;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              english ? 'Continue watching' : 'تابع المشاهدة',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 143,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: entries.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final entry = entries[index];
                final progress = (entry.positionMs / entry.durationMs).clamp(
                  0.0,
                  1.0,
                );
                final image = entry.item.background ?? entry.item.poster;
                return SizedBox(
                  width: 220,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(13),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => MediaDetailPage(
                          item: entry.item,
                          resumeVideoId: entry.videoId,
                          resumePositionMs: entry.positionMs,
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              SizedBox(
                                width: 220,
                                height: 104,
                                child: image == null
                                    ? const ColoredBox(
                                        color: HorseTheme.surface)
                                    : Image.network(
                                        image,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) =>
                                            const ColoredBox(
                                          color: HorseTheme.surface,
                                        ),
                                      ),
                              ),
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: .62),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.play_arrow_rounded,
                                  color: Colors.white,
                                ),
                              ),
                              Positioned(
                                left: 0,
                                right: 0,
                                bottom: 0,
                                child: LinearProgressIndicator(
                                  value: progress,
                                  minHeight: 3,
                                  backgroundColor: Colors.white24,
                                  color: HorseTheme.gold,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          entry.item.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      );
}

class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({required this.item, required this.onTap});
  final MediaItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 700;
    return SizedBox(
      height: wide ? 330 : 260,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if ((item.background ?? item.poster) != null)
              Image.network(
                item.background ?? item.poster!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    const ColoredBox(color: HorseTheme.raised),
              )
            else
              const ColoredBox(color: HorseTheme.raised),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                  colors: [
                    Color(0xEF080A0B),
                    Color(0xB8080A0B),
                    Color(0x18080A0B),
                  ],
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(wide ? 30 : 22),
              child: Align(
                alignment: AlignmentDirectional.bottomStart,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: HorseTheme.gold.withValues(alpha: .16),
                          borderRadius: BorderRadius.circular(30),
                        ),
                        child: Text(
                          'HORSE  ·  ${item.type.toUpperCase()}',
                          style: const TextStyle(
                            color: HorseTheme.gold,
                            fontWeight: FontWeight.w700,
                            fontSize: 10,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 11),
                      Text(
                        item.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      if (item.description != null) ...[
                        const SizedBox(height: 7),
                        Text(
                          item.description!,
                          maxLines: wide ? 2 : 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.white70),
                        ),
                      ],
                      const SizedBox(height: 15),
                      FilledButton.icon(
                        onPressed: onTap,
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: Text(
                          Localizations.localeOf(context).languageCode == 'ar'
                              ? 'التفاصيل والتشغيل'
                              : 'Details & play',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeaturedSkeleton extends StatelessWidget {
  const _FeaturedSkeleton();
  @override
  Widget build(BuildContext context) => Container(
        height: 260,
        decoration: BoxDecoration(
          color: HorseTheme.surface,
          borderRadius: BorderRadius.circular(22),
        ),
        child: const Center(
          child:
              CircularProgressIndicator(color: HorseTheme.gold, strokeWidth: 2),
        ),
      );
}

class _ServiceMessage extends StatelessWidget {
  const _ServiceMessage({required this.english, required this.onRetry});
  final bool english;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Container(
        height: 180,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: HorseTheme.surface,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                english ? 'Could not load the catalog' : 'تعذر تحميل الكتالوج',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: Text(english ? 'Try again' : 'إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
}
