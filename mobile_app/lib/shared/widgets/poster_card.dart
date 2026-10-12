import 'package:flutter/material.dart';

import '../../core/models/media_item.dart';
import '../../core/theme/horse_theme.dart';

class PosterCard extends StatelessWidget {
  const PosterCard({
    super.key,
    required this.item,
    required this.onTap,
    this.width = 122,
  });

  final MediaItem item;
  final VoidCallback onTap;
  final double width;

  @override
  Widget build(BuildContext context) {
    final ratio = MediaQuery.sizeOf(context).width >= 700 ? 0.72 : 0.72;
    return SizedBox(
      width: width,
      child: Semantics(
        button: true,
        label: item.name,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: ratio,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (item.poster != null)
                        Image.network(
                          item.poster!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const _PosterFallback(),
                        )
                      else
                        const _PosterFallback(),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: Container(
                          height: 42,
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [Colors.black54, Colors.transparent],
                            ),
                          ),
                        ),
                      ),
                      if (item.rating != null)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: .72),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 4,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.star_rounded,
                                    color: HorseTheme.gold,
                                    size: 12,
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    item.rating!,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
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
              ),
              const SizedBox(height: 8),
              Text(
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                ),
              ),
              if (item.releaseInfo != null)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(
                    item.releaseInfo!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PosterFallback extends StatelessWidget {
  const _PosterFallback();
  @override
  Widget build(BuildContext context) => Container(
    color: HorseTheme.raised,
    child: const Center(
      child: Icon(Icons.movie_outlined, size: 34, color: HorseTheme.gold),
    ),
  );
}
