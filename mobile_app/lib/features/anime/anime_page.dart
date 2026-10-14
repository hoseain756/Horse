import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../shared/widgets/media_rail.dart';
import '../../shared/widgets/poster_card.dart';
import '../media/media_detail_page.dart';

class AnimePage extends StatefulWidget {
  const AnimePage({super.key});

  @override
  State<AnimePage> createState() => _AnimePageState();
}

class _AnimePageState extends State<AnimePage> {
  Future<List<MediaItem>>? _items;
  String? _signature;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = context.watch<AppState>();
    final signature = app.addons.map((e) => '${e.id}:${e.enabled}').join('|');
    if (_items == null || _signature != signature) {
      _signature = signature;
      _items = app.catalogs.anime(app.addons);
    }
  }

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    return FutureBuilder<List<MediaItem>>(
      future: _items,
      builder: (context, snapshot) {
        final items = snapshot.data ?? [];
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      english ? 'Anime, your way' : 'الأنمي على طريقتك',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      english
                          ? 'From Stremio catalogs and your installed add-ons.'
                          : 'من كتالوجات Stremio والإضافات التي ثبّتها.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(color: Colors.white60),
                    ),
                  ],
                ),
              ),
            ),
            if (snapshot.connectionState == ConnectionState.waiting &&
                items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFFC99C62),
                    strokeWidth: 2,
                  ),
                ),
              ),
            if (snapshot.hasError ||
                (snapshot.connectionState == ConnectionState.done &&
                    items.isEmpty))
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.auto_awesome_outlined,
                          size: 36,
                          color: Color(0xFFC99C62),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          english
                              ? 'No anime catalogs responded yet.'
                              : 'لم تستجب كتالوجات الأنمي بعد.',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          english
                              ? 'Try another Stremio add-on in Settings.'
                              : 'جرّب إضافة Stremio أخرى من الإعدادات.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            if (items.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 22),
                  child: MediaRail(
                    title: english ? 'Trending anime' : 'أنمي رائج',
                    items: items.take(10).toList(),
                    numbered: true,
                    onTap: _open,
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 34),
                sliver: SliverGrid.builder(
                  itemCount: items.length,
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 170,
                    mainAxisExtent: 300,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 16,
                  ),
                  itemBuilder: (context, index) => PosterCard(
                    item: items[index],
                    width: double.infinity,
                    onTap: () => _open(items[index]),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  void _open(MediaItem item) => Navigator.of(
    context,
  ).push(MaterialPageRoute<void>(builder: (_) => MediaDetailPage(item: item)));
}
