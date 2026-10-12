import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import '../../shared/widgets/media_rail.dart';
import '../../shared/widgets/poster_card.dart';
import '../media/media_detail_page.dart';

class KidsPage extends StatefulWidget {
  const KidsPage({super.key});

  @override
  State<KidsPage> createState() => _KidsPageState();
}

class _KidsPageState extends State<KidsPage> {
  Future<List<List<MediaItem>>>? _content;

  @override
  void initState() {
    super.initState();
    final repository = context.read<AppState>().catalogs;
    _content = Future.wait([repository.kids(), repository.kids(series: true)]);
  }

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    return FutureBuilder<List<List<MediaItem>>>(
      future: _content,
      builder: (context, snapshot) {
        final groups = snapshot.data ?? const <List<MediaItem>>[];
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: HorseTheme.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF303333)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: HorseTheme.gold.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.child_care_rounded,
                          color: HorseTheme.gold,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              english ? 'Family time' : 'وقت العائلة',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              english
                                  ? 'Family and animation catalogs from Cinemeta.'
                                  : 'كتالوجات العائلة والرسوم المتحركة من Cinemeta.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (snapshot.connectionState == ConnectionState.waiting &&
                groups.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: CircularProgressIndicator(
                    color: HorseTheme.gold,
                    strokeWidth: 2,
                  ),
                ),
              ),
            if (snapshot.hasError ||
                (snapshot.connectionState == ConnectionState.done &&
                    groups.every((e) => e.isEmpty)))
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      english
                          ? 'Family catalogs are temporarily unavailable.'
                          : 'كتالوجات العائلة غير متاحة مؤقتًا.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            if (groups.isNotEmpty && groups.first.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 26),
                  child: MediaRail(
                    title: english ? 'Family movies' : 'أفلام عائلية',
                    items: groups.first,
                    onTap: _open,
                  ),
                ),
              ),
            if (groups.length > 1 && groups[1].isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 26),
                  child: MediaRail(
                    title: english ? 'Family series' : 'مسلسلات عائلية',
                    items: groups[1],
                    onTap: _open,
                  ),
                ),
              ),
            if (groups.isNotEmpty)
              SliverPadding(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 34),
                sliver: SliverGrid.builder(
                  itemCount: groups.expand((e) => e).length,
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 170,
                    mainAxisExtent: 300,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 16,
                  ),
                  itemBuilder: (context, index) {
                    final items = groups.expand((e) => e).toList();
                    return PosterCard(
                      item: items[index],
                      width: double.infinity,
                      onTap: () => _open(items[index]),
                    );
                  },
                ),
              ),
          ],
        );
      },
    );
  }

  void _open(MediaItem item) => Navigator.of(
    context,
  ).push(MaterialPageRoute<void>(builder: (_) => MediaDetailPage(item: item)));
}
