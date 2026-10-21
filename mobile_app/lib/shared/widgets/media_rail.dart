import 'package:flutter/material.dart';

import '../../core/models/media_item.dart';
import 'poster_card.dart';

class MediaRail extends StatelessWidget {
  const MediaRail({
    super.key,
    required this.title,
    required this.items,
    required this.onTap,
    this.numbered = false,
  });

  final String title;
  final List<MediaItem> items;
  final ValueChanged<MediaItem> onTap;
  final bool numbered;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final wide = MediaQuery.sizeOf(context).width >= 700;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: wide ? 34 : 20),
          child: Row(
            children: [
              Container(
                width: 3,
                height: 19,
                decoration: BoxDecoration(
                  color: const Color(0xFFC99C62),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (numbered)
                const Icon(
                  Icons.arrow_forward_rounded,
                  size: 16,
                  color: Color(0xFF969895),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 258,
          child: ListView.separated(
            padding: EdgeInsets.symmetric(horizontal: wide ? 34 : 20),
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemBuilder: (context, index) {
              final item = items[index];
              return numbered
                  ? SizedBox(
                      height: 248,
                      width: 125,
                      child: Stack(
                        alignment: Alignment.bottomCenter,
                        children: [
                          Positioned(
                            left: 0,
                            bottom: 41,
                            child: IgnorePointer(
                              child: Text(
                                '${index + 1}',
                                style: TextStyle(
                                  fontSize: 80,
                                  height: .86,
                                  fontWeight: FontWeight.w300,
                                  color: Colors.transparent,
                                  foreground: Paint()
                                    ..style = PaintingStyle.stroke
                                    ..strokeWidth = 1.2
                                    ..color = Colors.white.withValues(
                                      alpha: .42,
                                    ),
                                ),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.bottomRight,
                            child: PosterCard(
                              item: item,
                              width: 110,
                              onTap: () => onTap(item),
                            ),
                          ),
                        ],
                      ),
                    )
                  : PosterCard(item: item, onTap: () => onTap(item));
            },
          ),
        ),
      ],
    );
  }
}
