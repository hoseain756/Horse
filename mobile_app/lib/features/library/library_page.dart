import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import '../../shared/widgets/poster_card.dart';
import '../media/media_detail_page.dart';

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key});

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final width = MediaQuery.sizeOf(context).width;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  english ? 'My library' : 'مكتبتي',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 6),
                Text(
                  english
                      ? 'Keep your watchlist and recent plays together.'
                      : 'اجمع قائمة المشاهدة وآخر ما شغّلته في مكان واحد.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: HorseTheme.muted),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: HorseTheme.surface,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      _LibraryTab(
                        label: english ? 'Watchlist' : 'قائمتي',
                        count: app.watchlist.length,
                        selected: _tab == 0,
                        onTap: () => setState(() => _tab = 0),
                      ),
                      _LibraryTab(
                        label: english ? 'History' : 'المشاهدة',
                        count: app.history.length,
                        selected: _tab == 1,
                        onTap: () => setState(() => _tab = 1),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_tab == 0) ...[
          if (app.watchlist.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _EmptyLibrary(
                icon: Icons.bookmark_border_rounded,
                title: english ? 'Nothing saved yet' : 'لم تحفظ أي عنوان بعد',
                body: english
                    ? 'Open a title and tap “My list” to keep it here.'
                    : 'افتح أي عنوان واضغط «قائمتي» لحفظه هنا.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 30),
              sliver: SliverGrid.builder(
                itemCount: app.watchlist.length,
                gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: width >= 800 ? 184 : 160,
                  mainAxisExtent: 296,
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 16,
                ),
                itemBuilder: (context, index) =>
                    _WatchlistCard(item: app.watchlist[index]),
              ),
            ),
        ] else ...[
          if (app.history.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _EmptyLibrary(
                icon: Icons.history_rounded,
                title: english ? 'No recent plays' : 'لا يوجد سجل مشاهدة',
                body: english
                    ? 'Titles you play will appear here.'
                    : 'ستظهر هنا العناوين التي تشغّلها.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 30),
              sliver: SliverList.separated(
                itemCount: app.history.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, color: HorseTheme.line),
                itemBuilder: (context, index) =>
                    _HistoryRow(entry: app.history[index]),
              ),
            ),
        ],
      ],
    );
  }
}

class _LibraryTab extends StatelessWidget {
  const _LibraryTab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(11),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.symmetric(vertical: 11),
            decoration: BoxDecoration(
              color: selected ? const Color(0xFF28231B) : Colors.transparent,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? HorseTheme.gold : HorseTheme.muted,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 7),
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    color: selected ? HorseTheme.gold : HorseTheme.muted,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _WatchlistCard extends StatelessWidget {
  const _WatchlistCard({required this.item});
  final MediaItem item;
  @override
  Widget build(BuildContext context) => Stack(
        alignment: AlignmentDirectional.topEnd,
        children: [
          PosterCard(
            item: item,
            width: double.infinity,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                  builder: (_) => MediaDetailPage(item: item)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(5),
            child: Material(
              color: Colors.black.withValues(alpha: .68),
              shape: const CircleBorder(),
              child: IconButton(
                iconSize: 18,
                constraints:
                    const BoxConstraints.tightFor(width: 38, height: 38),
                onPressed: () => context.read<AppState>().toggleWatchlist(item),
                icon:
                    const Icon(Icons.bookmark_rounded, color: HorseTheme.gold),
              ),
            ),
          ),
        ],
      );
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.entry});
  final dynamic entry;
  @override
  Widget build(BuildContext context) {
    final item = entry.item as MediaItem;
    final english = context.read<AppState>().english;
    final progress = entry.durationMs > 0
        ? (entry.positionMs / entry.durationMs).clamp(0.0, 1.0)
        : 0.0;
    final date = DateTime.fromMillisecondsSinceEpoch(entry.watchedAt as int);
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => MediaDetailPage(item: item)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 54,
                height: 76,
                child: item.poster == null
                    ? const ColoredBox(
                        color: HorseTheme.raised,
                        child: Icon(
                          Icons.movie_outlined,
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
                            color: HorseTheme.gold,
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.type == 'series' ? (english ? 'Series' : 'مسلسل') : (english ? 'Movie' : 'فيلم')} · ${MaterialLocalizations.of(context).formatMediumDate(date)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (entry.durationMs > 0) ...[
                    const SizedBox(height: 9),
                    LinearProgressIndicator(
                      value: progress,
                      minHeight: 3,
                      backgroundColor: HorseTheme.line,
                      color: HorseTheme.gold,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_left_rounded, color: HorseTheme.muted),
          ],
        ),
      ),
    );
  }
}

class _EmptyLibrary extends StatelessWidget {
  const _EmptyLibrary({
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title;
  final String body;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: HorseTheme.surface,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(icon, color: HorseTheme.gold, size: 27),
              ),
              const SizedBox(height: 15),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 5),
              Text(
                body,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      );
}
