import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/horse_api.dart';
import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';
import 'addons_page.dart';
import 'integrations_page.dart';
import 'stats_page.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final width = MediaQuery.sizeOf(context).width;
    return Scaffold(
      appBar: AppBar(
        title: Text(english ? 'Settings' : 'الإعدادات'),
        centerTitle: false,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              width >= 700 ? 32 : 20,
              10,
              width >= 700 ? 32 : 20,
              36,
            ),
            children: [
              Text(
                english ? 'Your Horse' : 'تطبيق Horse',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 6),
              Text(
                english
                    ? 'A focused player and catalog for your add-ons.'
                    : 'كتالوج ومشغّل بسيط يعملان مع إضافاتك.',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: HorseTheme.muted),
              ),
              const SizedBox(height: 24),
              _SectionTitle(title: english ? 'Add-ons' : 'الإضافات'),
              _SettingsTile(
                icon: Icons.extension_rounded,
                title: english ? 'Installed add-ons' : 'الإضافات المثبتة',
                subtitle: english
                    ? '${app.addons.length} installed · catalogs and streams'
                    : '${app.addons.length} مثبتة · كتالوجات وبث',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const AddonsPage()),
                ),
              ),
              _SettingsTile(
                icon: Icons.hub_outlined,
                title: english ? 'Connected services' : 'الخدمات المرتبطة',
                subtitle: english
                    ? 'Trakt, Simkl, and Debrid playback'
                    : 'Trakt وSimkl وتشغيل Debrid',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const IntegrationsPage(),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              _SectionTitle(
                title: english ? 'Account and sync' : 'الحساب والمزامنة',
              ),
              _AccountPanel(),
              const SizedBox(height: 22),
              _SectionTitle(title: english ? 'Server' : 'الخادم'),
              _ServerPanel(),
              const SizedBox(height: 22),
              _SectionTitle(title: english ? 'App' : 'التطبيق'),
              _SettingsTile(
                icon: Icons.language_rounded,
                title: english ? 'Language' : 'اللغة',
                subtitle: english ? 'English' : 'العربية',
                trailing: Switch(
                  value: english,
                  onChanged: app.setLanguage,
                  activeThumbColor: HorseTheme.gold,
                ),
                onTap: () => app.setLanguage(!english),
              ),
              _SettingsTile(
                icon: Icons.palette_outlined,
                title: english ? 'Horse design' : 'تصميم Horse',
                subtitle: english
                    ? 'The signature dark and bronze look'
                    : 'الهوية الداكنة والذهبية المعتمدة',
                trailing: const Icon(
                  Icons.lock_outline_rounded,
                  size: 18,
                  color: HorseTheme.muted,
                ),
                onTap: null,
              ),
              const SizedBox(height: 22),
              _SectionTitle(title: english ? 'Usage' : 'الإحصائيات'),
              _SettingsTile(
                icon: Icons.query_stats_rounded,
                title: english ? 'Viewing statistics' : 'إحصائيات المشاهدة',
                subtitle: english
                    ? '${app.watchedCount} recent plays'
                    : '${app.watchedCount} مشاهدة مسجلة',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const StatsPage()),
                ),
              ),
              const SizedBox(height: 26),
              Text(
                'HORSE  ·  ${HorseApi.defaultServer.replaceFirst('https://', '')}',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white30,
                      letterSpacing: .6,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountPanel extends StatefulWidget {
  const _AccountPanel();
  @override
  State<_AccountPanel> createState() => _AccountPanelState();
}

class _AccountPanelState extends State<_AccountPanel> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _stremio = false;
  bool _register = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    final app = context.read<AppState>();
    try {
      if (_stremio) {
        await app.loginStremio(_email.text.trim(), _password.text);
      } else if (_register) {
        await app.registerHorse(
          _email.text.trim(),
          _password.text,
          _name.text.trim(),
        );
      } else {
        await app.loginHorse(_email.text.trim(), _password.text);
      }
      if (mounted) {
        setState(
          () => _message =
              app.english ? 'Connected and synced.' : 'تم الاتصال والمزامنة.',
        );
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _message = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final currentUser = _stremio ? app.stremioUser : app.horseUser;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: HorseTheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HorseTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: Text(english ? 'Horse account' : 'حساب Horse'),
                selected: !_stremio,
                onSelected: (_) => setState(() {
                  _stremio = false;
                  _message = null;
                }),
              ),
              ChoiceChip(
                label: const Text('Stremio'),
                selected: _stremio,
                onSelected: (_) => setState(() {
                  _stremio = true;
                  _message = null;
                }),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (currentUser != null) ...[
            Row(
              children: [
                const CircleAvatar(
                  radius: 19,
                  backgroundColor: Color(0xFF28231B),
                  child: Icon(
                    Icons.person_outline_rounded,
                    color: HorseTheme.gold,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    (currentUser['displayName'] ??
                            currentUser['email'] ??
                            currentUser['fullname'] ??
                            'Connected')
                        .toString(),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                TextButton(
                  onPressed: _stremio ? app.logoutStremio : app.logoutHorse,
                  child: Text(english ? 'Sign out' : 'خروج'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              _stremio
                  ? (english
                      ? 'Add-ons sync with your Stremio account.'
                      : 'تتزامن الإضافات مع حساب Stremio.')
                  : (english
                      ? 'Your add-ons and library sync securely with Horse.'
                      : 'تتزامن إضافاتك ومكتبتك بأمان مع Horse.'),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ] else ...[
            Text(
              _stremio
                  ? (english
                      ? 'Link Stremio to sync its add-on collection.'
                      : 'اربط Stremio لمزامنة قائمة إضافاته.')
                  : (english
                      ? 'Sign in to sync add-ons and your library across devices.'
                      : 'سجّل الدخول لمزامنة الإضافات ومكتبتك بين الأجهزة.'),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 13),
            if (!_stremio && _register) ...[
              TextField(
                controller: _name,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: english ? 'Display name' : 'الاسم',
                ),
              ),
              const SizedBox(height: 10),
            ],
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: english ? 'Email' : 'البريد الإلكتروني',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _password,
              obscureText: true,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: english ? 'Password' : 'كلمة المرور',
              ),
            ),
            if (!_stremio)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(
                  onPressed: () => setState(() => _register = !_register),
                  child: Text(
                    _register
                        ? (english
                            ? 'Already have an account? Sign in'
                            : 'لديك حساب؟ سجّل الدخول')
                        : (english
                            ? 'Create a Horse account'
                            : 'إنشاء حساب Horse'),
                  ),
                ),
              ),
            const SizedBox(height: 4),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        _stremio
                            ? (english ? 'Link Stremio' : 'ربط Stremio')
                            : (_register
                                ? (english ? 'Create account' : 'إنشاء الحساب')
                                : (english
                                    ? 'Sign in to Horse'
                                    : 'تسجيل الدخول إلى Horse')),
                      ),
              ),
            ),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  _message!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: _message!.contains('تم') ||
                                _message!.contains('Connected')
                            ? Colors.greenAccent
                            : HorseTheme.gold,
                      ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ServerPanel extends StatefulWidget {
  const _ServerPanel();
  @override
  State<_ServerPanel> createState() => _ServerPanelState();
}

class _ServerPanelState extends State<_ServerPanel> {
  late final TextEditingController _controller;
  bool _busy = false;
  String? _message;
  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: context.read<AppState>().api.baseUrl,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await context.read<AppState>().setServer(_controller.text);
      if (mounted) {
        setState(
          () => _message = context.read<AppState>().english
              ? 'Server connected.'
              : 'تم الاتصال بالخادم.',
        );
      }
    } catch (error) {
      if (mounted) {
        setState(
          () =>
              _message = error.toString().replaceFirst('FormatException: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: HorseTheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HorseTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            english ? 'Horse server address' : 'عنوان خادم Horse',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            english
                ? 'Your catalogs and account data use this server.'
                : 'يستخدم التطبيق هذا الخادم للكتالوجات وبيانات الحساب.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 13),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.url,
            textDirection: TextDirection.ltr,
            autocorrect: false,
            decoration: const InputDecoration(
              hintText: 'https://horse-silk.vercel.app',
            ),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton.tonal(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      width: 17,
                      height: 17,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(english ? 'Save and test' : 'حفظ واختبار'),
            ),
          ),
          if (_message != null)
            Text(
              _message!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: HorseTheme.gold),
            ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(bottom: 9, start: 3),
        child: Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(color: HorseTheme.gold),
        ),
      );
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: HorseTheme.surface,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: HorseTheme.line),
        ),
        child: ListTile(
          onTap: onTap,
          minVerticalPadding: 12,
          leading: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: HorseTheme.gold.withValues(alpha: .10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: HorseTheme.gold, size: 21),
          ),
          title: Text(title, style: Theme.of(context).textTheme.titleMedium),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ),
          trailing: trailing ??
              Icon(
                Icons.chevron_left_rounded,
                color: onTap == null ? HorseTheme.muted : HorseTheme.gold,
              ),
        ),
      );
}
