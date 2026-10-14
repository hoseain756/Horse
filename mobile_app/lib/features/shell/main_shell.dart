import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import '../anime/anime_page.dart';
import '../home/home_page.dart';
import '../kids/kids_page.dart';
import '../library/library_page.dart';
import '../settings/settings_page.dart';
import 'search_sheet.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selected = 0;

  static const _icons = [
    Icons.home_rounded,
    Icons.auto_awesome_rounded,
    Icons.child_care_rounded,
    Icons.video_library_rounded,
  ];
  static const _selectedIcons = [
    Icons.home_rounded,
    Icons.auto_awesome,
    Icons.child_care,
    Icons.video_library_rounded,
  ];

  List<String> _labels(bool english) => english
      ? const ['Home', 'Anime', 'Kids', 'My Library']
      : const ['الرئيسية', 'أنمي', 'الأطفال', 'مكتبتي'];

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final labels = _labels(app.english);
    final wide = MediaQuery.sizeOf(context).width >= 800;
    final extended = MediaQuery.sizeOf(context).width >= 1080;
    final pages = const [HomePage(), AnimePage(), KidsPage(), LibraryPage()];

    return Scaffold(
      body: SafeArea(
        bottom: !wide,
        child: Column(
          children: [
            _TopBar(
              english: app.english,
              onSearch: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: HorseTheme.surface,
                builder: (_) => const SearchSheet(),
              ),
              onSettings: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const SettingsPage()),
              ),
            ),
            Expanded(
              child: wide
                  ? Row(
                      children: [
                        NavigationRail(
                          extended: extended,
                          minWidth: 76,
                          minExtendedWidth: 190,
                          groupAlignment: -.72,
                          labelType: extended
                              ? null
                              : NavigationRailLabelType.all,
                          selectedIndex: _selected,
                          onDestinationSelected: (value) =>
                              setState(() => _selected = value),
                          leading: Padding(
                            padding: const EdgeInsets.only(top: 10, bottom: 18),
                            child: extended
                                ? Row(
                                    children: [
                                      const Icon(
                                        Icons.brightness_7_rounded,
                                        color: HorseTheme.gold,
                                      ),
                                      const SizedBox(width: 10),
                                      Text(
                                        'HORSE',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium
                                            ?.copyWith(letterSpacing: 2),
                                      ),
                                    ],
                                  )
                                : const Icon(
                                    Icons.brightness_7_rounded,
                                    color: HorseTheme.gold,
                                  ),
                          ),
                          destinations: [
                            for (var i = 0; i < labels.length; i++)
                              NavigationRailDestination(
                                icon: Icon(_icons[i]),
                                selectedIcon: Icon(_selectedIcons[i]),
                                label: Text(labels[i]),
                              ),
                          ],
                        ),
                        const VerticalDivider(
                          width: 1,
                          thickness: 1,
                          color: HorseTheme.line,
                        ),
                        Expanded(
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 1600),
                              child: IndexedStack(
                                index: _selected,
                                children: pages,
                              ),
                            ),
                          ),
                        ),
                      ],
                    )
                  : IndexedStack(index: _selected, children: pages),
            ),
          ],
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              height: 70,
              selectedIndex: _selected,
              onDestinationSelected: (value) =>
                  setState(() => _selected = value),
              destinations: [
                for (var i = 0; i < labels.length; i++)
                  NavigationDestination(
                    icon: Icon(_icons[i]),
                    selectedIcon: Icon(_selectedIcons[i]),
                    label: labels[i],
                  ),
              ],
            ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.english,
    required this.onSearch,
    required this.onSettings,
  });

  final bool english;
  final VoidCallback onSearch;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) => Container(
    height: 64,
    padding: const EdgeInsetsDirectional.symmetric(horizontal: 20),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: HorseTheme.line)),
    ),
    child: Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: HorseTheme.gold,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(
            Icons.brightness_7_rounded,
            size: 21,
            color: Color(0xFF1A1209),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'HORSE',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            letterSpacing: 2.2,
            fontWeight: FontWeight.w800,
          ),
        ),
        const Spacer(),
        IconButton(
          tooltip: english ? 'Search' : 'بحث',
          onPressed: onSearch,
          icon: const Icon(Icons.search_rounded),
        ),
        IconButton(
          tooltip: english ? 'Settings' : 'الإعدادات',
          onPressed: onSettings,
          icon: const Icon(Icons.tune_rounded),
        ),
      ],
    ),
  );
}
