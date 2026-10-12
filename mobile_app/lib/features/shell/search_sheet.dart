import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/media_item.dart';
import '../../core/state/app_state.dart';
import '../../shared/widgets/poster_card.dart';
import '../media/media_detail_page.dart';

class SearchSheet extends StatefulWidget {
  const SearchSheet({super.key});

  @override
  State<SearchSheet> createState() => _SearchSheetState();
}

class _SearchSheetState extends State<SearchSheet> {
  final _controller = TextEditingController();
  Timer? _timer;
  bool _loading = false;
  List<MediaItem> _results = [];
  String? _error;

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _timer?.cancel();
    if (value.trim().length < 2) {
      setState(() {
        _results = [];
        _error = null;
      });
      return;
    }
    _timer = Timer(
      const Duration(milliseconds: 350),
      () => _search(value.trim()),
    );
  }

  Future<void> _search(String query) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final catalogs = context.read<AppState>().catalogs;
    final results = await Future.wait(
      [
        catalogs.catalog('movie', 'top', extras: {'search': query}),
        catalogs.catalog('series', 'top', extras: {'search': query}),
      ].map((job) async {
        try {
          return await job;
        } catch (_) {
          return <MediaItem>[];
        }
      }),
    );
    if (!mounted) return;
    final seen = <String>{};
    setState(() {
      _results = results
          .expand((e) => e)
          .where((e) => seen.add(e.id))
          .take(30)
          .toList();
      _loading = false;
      _error = _results.isEmpty
          ? (context.read<AppState>().english
                ? 'No titles found.'
                : 'لم يتم العثور على عناوين.')
          : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final height = MediaQuery.sizeOf(context).height * .92;
    return SizedBox(
      height: height,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _controller,
              autofocus: true,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: english
                    ? 'Search movies and series'
                    : 'ابحث عن فيلم أو مسلسل',
              ),
            ),
            const SizedBox(height: 18),
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            if (_error != null)
              Padding(padding: const EdgeInsets.all(12), child: Text(_error!)),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.only(top: 8, bottom: 20),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 150,
                  mainAxisExtent: 286,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 14,
                ),
                itemCount: _results.length,
                itemBuilder: (context, index) => PosterCard(
                  item: _results[index],
                  width: double.infinity,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => MediaDetailPage(item: _results[index]),
                    ),
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
