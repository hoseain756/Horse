import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/state/app_state.dart';
import '../../core/theme/horse_theme.dart';

class IntegrationsPage extends StatelessWidget {
  const IntegrationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final english = context.watch<AppState>().english;
    return Scaffold(
      appBar: AppBar(
          title: Text(english ? 'Connected services' : 'الخدمات المرتبطة')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
            children: [
              Text(
                english
                    ? 'Bring your watch history and playback services together.'
                    : 'اجمع سجل المشاهدة وخدمات التشغيل في مكان واحد.',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 7),
              Text(
                english
                    ? 'Trakt, Simkl, and TMDB connect directly from this device with your own application credentials — no middleman server. Debrid keys stay in secure device storage and are sent only to the provider itself when resolving a stream.'
                    : 'تتصل Trakt وSimkl وTMDB مباشرة من هذا الجهاز عبر بيانات تطبيقك الخاص — بلا أي خادم وسيط. تُحفظ مفاتيح Debrid في التخزين الآمن ولا تُرسل إلا لمزوّدها عند تجهيز رابط التشغيل.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: HorseTheme.muted,
                    ),
              ),
              const SizedBox(height: 22),
              _LinkedServiceCard(
                service: 'trakt',
                title: 'Trakt',
                subtitle: english
                    ? 'Import your watchlist and history; sync playback progress.'
                    : 'استيراد قائمتك وسجل المشاهدة ومزامنة تقدم التشغيل.',
                icon: Icons.local_movies_outlined,
              ),
              const SizedBox(height: 12),
              _LinkedServiceCard(
                service: 'simkl',
                title: 'Simkl',
                subtitle: english
                    ? 'Import your watchlist and history; sync playback progress.'
                    : 'استيراد قائمتك وسجل المشاهدة ومزامنة تقدم التشغيل.',
                icon: Icons.sync_rounded,
              ),
              const SizedBox(height: 12),
              const _TmdbCard(),
              const SizedBox(height: 12),
              const _DebridCard(),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinkedServiceCard extends StatefulWidget {
  const _LinkedServiceCard({
    required this.service,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String service;
  final String title;
  final String subtitle;
  final IconData icon;

  @override
  State<_LinkedServiceCard> createState() => _LinkedServiceCardState();
}

class _LinkedServiceCardState extends State<_LinkedServiceCard> {
  Timer? _pollTimer;
  Map<String, dynamic>? _flow;
  bool _busy = false;
  bool _syncing = false;
  String? _message;
  bool _error = false;
  bool _showCredentials = false;
  final _clientId = TextEditingController();
  final _clientSecret = TextEditingController();

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clientId.dispose();
    _clientSecret.dispose();
    super.dispose();
  }

  bool get _isTrakt => widget.service == 'trakt';

  Future<void> _saveCredentials() async {
    final app = context.read<AppState>();
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      if (_isTrakt) {
        await app.providers.saveTraktCredentials(
          _clientId.text,
          _clientSecret.text,
        );
      } else {
        await app.providers.saveSimklCredentials(
          _clientId.text,
          _clientSecret.text,
        );
      }
      if (mounted) {
        setState(() {
          _showCredentials = false;
          _message = app.english
              ? 'Credentials saved on this device.'
              : 'حُفظت بيانات التطبيق على هذا الجهاز.';
        });
      }
    } catch (error) {
      _setMessage(_friendlyError(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start() async {
    final app = context.read<AppState>();
    final providers = app.providers;
    final hasCredentials = _isTrakt
        ? providers.traktClientId != null
        : providers.simklClientId != null;
    if (!hasCredentials) {
      setState(() {
        _showCredentials = true;
        _message = app.english
            ? 'Enter your application credentials first.'
            : 'أدخل بيانات تطبيقك أولًا.';
        _error = false;
      });
      return;
    }
    _pollTimer?.cancel();
    setState(() {
      _busy = true;
      _flow = null;
      _message = null;
    });
    try {
      final result = _isTrakt
          ? await providers.traktStartDeviceLink()
          : await providers.simklStartPinLink();
      final deviceCode = result['device_code']?.toString() ?? '';
      final code = result['user_code']?.toString() ?? '';
      final verificationUrl =
          (result['verification_url_full'] ?? result['verification_url'])
                  ?.toString() ??
              (_isTrakt ? 'https://trakt.tv/activate' : 'https://simkl.com/apps/enter/');
      if (deviceCode.isEmpty || code.isEmpty) {
        throw const FormatException('تعذر إنشاء رمز الربط.');
      }
      if (!mounted) return;
      setState(() {
        _flow = {
          'device_code': deviceCode,
          'user_code': code,
          'verification_url': verificationUrl,
          'intervalSec':
              (result['interval'] as num?)?.toInt() ??
                  (result['intervalSec'] as num?)?.toInt() ??
                  5,
          'expiresAt': DateTime.now()
              .add(
                Duration(
                  seconds:
                      (result['expires_in'] as num?)?.toInt() ?? 600,
                ),
              )
              .millisecondsSinceEpoch,
          'status': 'waiting',
        };
      });
      await launchUrl(
        Uri.parse(verificationUrl),
        mode: LaunchMode.externalApplication,
      );
      _schedulePoll(
        Duration(seconds: (_flow?['intervalSec'] as int? ?? 5).clamp(3, 30)),
      );
    } catch (error) {
      _setMessage(_friendlyError(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _schedulePoll(Duration delay) {
    _pollTimer?.cancel();
    _pollTimer = Timer(delay, _poll);
  }

  Future<void> _poll() async {
    final flow = _flow;
    if (flow == null || flow['status'] != 'waiting') return;
    final app = context.read<AppState>();
    try {
      final (status, account) = _isTrakt
          ? await app.providers.traktPollDeviceLink(flow)
          : await app.providers.simklPollPinLink(flow);
      if (!mounted) return;
      switch (status) {
        case 'authorized':
          await app.saveLinkedService(widget.service, {
            ...?account,
            'linkedAt': DateTime.now().millisecondsSinceEpoch,
          });
          setState(() {
            _flow = null;
            _error = false;
            _message = app.english ? 'Account connected.' : 'تم ربط الحساب.';
          });
          return;
        case 'pending':
          _schedulePoll(
            Duration(
              seconds: (flow['intervalSec'] as int? ?? 5).clamp(3, 30),
            ),
          );
          return;
        case 'slow_down':
          setState(
            () => _flow = {
              ...flow,
              'intervalSec':
                  ((flow['intervalSec'] as int? ?? 5) + 5).clamp(5, 30),
            },
          );
          _schedulePoll(
            Duration(
              seconds: (_flow!['intervalSec'] as int).clamp(5, 30),
            ),
          );
          return;
        default:
          setState(() {
            _flow = {...flow, 'status': status};
            _message = app.english
                ? (status == 'expired'
                    ? 'The code expired.'
                    : 'The link was not approved.')
                : (status == 'expired'
                    ? 'انتهت صلاحية الرمز.'
                    : 'لم تتم الموافقة على الربط.');
            _error = true;
          });
      }
    } catch (_) {
      // Keep the device flow alive through brief mobile-network interruptions.
      if (mounted) _schedulePoll(const Duration(seconds: 8));
    }
  }

  Future<void> _sync() async {
    setState(() {
      _syncing = true;
      _message = null;
    });
    try {
      final (watchlist, history) =
          await context.read<AppState>().syncLinkedService(widget.service);
      if (mounted) {
        final english = context.read<AppState>().english;
        _setMessage(
          english
              ? 'Imported $watchlist titles and $history history items.'
              : 'تم استيراد $watchlist عنوانًا و$history من سجل المشاهدة.',
        );
      }
    } catch (error) {
      _setMessage(_friendlyError(error), error: true);
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _unlink() async {
    await context.read<AppState>().unlinkService(widget.service);
    if (mounted) {
      _setMessage(
        context.read<AppState>().english
            ? 'Account disconnected.'
            : 'تم فصل الحساب.',
      );
    }
  }

  void _setMessage(String value, {bool error = false}) {
    if (!mounted) return;
    setState(() {
      _message = value;
      _error = error;
    });
  }

  void _cancelFlow() {
    _pollTimer?.cancel();
    setState(() => _flow = null);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final linked = app.linkedServices[widget.service];
    final waiting = _flow?['status'] == 'waiting';
    final hasCredentials = _isTrakt
        ? app.providers.traktClientId != null
        : app.providers.simklClientId != null;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: HorseTheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HorseTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _ServiceIcon(icon: widget.icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.title,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 3),
                    Text(widget.subtitle,
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              if (linked != null)
                const Icon(Icons.check_circle_rounded, color: HorseTheme.gold),
            ],
          ),
          const SizedBox(height: 14),
          if (_showCredentials) ...[
            TextField(
              controller: _clientId,
              autocorrect: false,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText: english ? 'Client ID' : 'Client ID',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _clientSecret,
              autocorrect: false,
              obscureText: true,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText:
                    '${english ? 'Client secret' : 'Client Secret'} (${english ? 'optional for Trakt' : 'اختياري لـ Trakt'})',
              ),
            ),
            const SizedBox(height: 10),
            Text(
              english
                  ? 'Create a free developer application on ${_isTrakt ? 'trakt.tv/oauth/applications' : 'simkl.com/settings/developer'} — redirect URI can be any https address. Keys are stored only on this device.'
                  : 'أنشئ تطبيق مطوّر مجاني على ${_isTrakt ? 'trakt.tv/oauth/applications' : 'simkl.com/settings/developer'} — يمكن أن يكون عنوان الردود أي رابط https. تُحفظ المفاتيح على هذا الجهاز فقط.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                FilledButton.tonal(
                  onPressed: _busy ? null : _saveCredentials,
                  child: Text(english ? 'Save credentials' : 'حفظ البيانات'),
                ),
                TextButton(
                  onPressed: () =>
                      setState(() => _showCredentials = false),
                  child: Text(english ? 'Cancel' : 'إلغاء'),
                ),
              ],
            ),
          ] else if (linked != null) ...[
            Text(
              '${english ? 'Connected as' : 'متصل باسم'}  ${linked['username'] ?? widget.title}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: _syncing ? null : _sync,
                  icon: _syncing
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.sync_rounded),
                  label: Text(english ? 'Sync library' : 'مزامنة المكتبة'),
                ),
                TextButton.icon(
                  onPressed: _unlink,
                  icon: const Icon(Icons.link_off_rounded),
                  label: Text(english ? 'Disconnect' : 'فصل'),
                ),
              ],
            ),
          ] else if (waiting) ...[
            Text(
              english
                  ? 'Open ${widget.title} and enter this code:'
                  : 'افتح ${widget.title} وأدخل رمز التفعيل:',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            SelectableText(
              _flow?['user_code']?.toString() ?? '',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: HorseTheme.gold,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 4,
                  ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(
                        text: _flow?['user_code']?.toString() ?? '',
                      ),
                    );
                    if (mounted) {
                      _setMessage(
                        english ? 'Code copied.' : 'تم نسخ الرمز.',
                      );
                    }
                  },
                  icon: const Icon(Icons.copy_rounded),
                  label: Text(english ? 'Copy code' : 'نسخ الرمز'),
                ),
                OutlinedButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse(_flow?['verification_url'].toString() ?? ''),
                    mode: LaunchMode.externalApplication,
                  ),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: Text(
                      english ? 'Open activation page' : 'فتح صفحة التفعيل'),
                ),
                TextButton(
                  onPressed: _cancelFlow,
                  child: Text(english ? 'Cancel' : 'إلغاء'),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              english ? 'Waiting for approval…' : 'بانتظار الموافقة…',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: HorseTheme.muted,
                  ),
            ),
          ] else ...[
            if (!hasCredentials)
              Text(
                english
                    ? 'This device needs your own ${widget.title} developer credentials — nothing is proxied.'
                    : 'يحتاج هذا الجهاز بيانات تطبيق ${widget.title} الخاصة بك — بلا أي وسيط.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _busy ? null : _start,
                  icon: _busy
                      ? const SizedBox.square(
                          dimension: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.link_rounded),
                  label: Text(
                    hasCredentials
                        ? (english
                            ? 'Connect ${widget.title}'
                            : 'ربط ${widget.title}')
                        : (english
                            ? 'Add ${widget.title} credentials'
                            : 'إضافة بيانات ${widget.title}'),
                  ),
                ),
                if (!hasCredentials)
                  OutlinedButton(
                    onPressed: () => setState(() => _showCredentials = true),
                    child: Text(english ? 'Enter manually' : 'إدخال يدوي'),
                  ),
              ],
            ),
            if (_flow?['status'] != null)
              TextButton.icon(
                onPressed: _start,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(english ? 'Generate a new code' : 'إنشاء رمز جديد'),
              ),
          ],
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(
              _message!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _error ? const Color(0xFFFF8178) : HorseTheme.gold,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TmdbCard extends StatefulWidget {
  const _TmdbCard();

  @override
  State<_TmdbCard> createState() => _TmdbCardState();
}

class _TmdbCardState extends State<_TmdbCard> {
  final _key = TextEditingController();
  bool _busy = false;
  String? _message;
  bool _error = false;

  @override
  void dispose() {
    _key.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_key.text.trim().isEmpty) return;
    final app = context.read<AppState>();
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await app.providers.saveTmdbKey(_key.text);
      _key.clear();
      if (mounted) {
        setState(() {
          _message = app.english
              ? 'TMDB key verified — logos and artwork enabled.'
              : 'تم التحقق من مفتاح TMDB — فُعّلت الشعارات والصور.';
          _error = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _message = _friendlyError(error);
          _error = true;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    await context.read<AppState>().providers.clearTmdbKey();
    if (mounted) {
      setState(() {
        _message = context.read<AppState>().english
            ? 'TMDB key removed.'
            : 'تمت إزالة مفتاح TMDB.';
        _error = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final connected = app.providers.tmdbKey != null;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: HorseTheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HorseTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _ServiceIcon(icon: Icons.movie_filter_outlined),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('TMDB', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 3),
                    Text(
                      english
                          ? 'Official title logos, backdrops, and episode art.'
                          : 'شعارات العناوين الرسمية وخلفياتها وصور الحلقات.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              if (connected)
                const Icon(Icons.check_circle_rounded, color: HorseTheme.gold),
            ],
          ),
          const SizedBox(height: 14),
          if (connected) ...[
            Text(
              english
                  ? 'A v3 key or v4 read-access token is active on this device.'
                  : 'مفتاح v3 أو توكن v4 مفعّل على هذا الجهاز.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                onPressed: _remove,
                icon: const Icon(Icons.link_off_rounded),
                label: Text(english ? 'Remove key' : 'إزالة المفتاح'),
              ),
            ),
          ] else ...[
            TextField(
              controller: _key,
              autocorrect: false,
              obscureText: true,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText: english ? 'API key / v4 token' : 'مفتاح API / توكن v4',
                hintText: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
              ),
            ),
            const SizedBox(height: 10),
            Text(
              english
                  ? 'Free key from themoviedb.org → Settings → API. Stored only on this device and sent only to TMDB.'
                  : 'مفتاح مجاني من themoviedb.org ← الإعدادات ← API. يُحفظ على هذا الجهاز فقط ويُرسل لـ TMDB فقط.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonalIcon(
                onPressed: _busy ? null : _save,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.verified_user_outlined),
                label: Text(english ? 'Verify and save' : 'التحقق والحفظ'),
              ),
            ),
          ],
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(
              _message!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _error ? const Color(0xFFFF8178) : HorseTheme.gold,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DebridCard extends StatefulWidget {
  const _DebridCard();

  @override
  State<_DebridCard> createState() => _DebridCardState();
}

class _DebridCardState extends State<_DebridCard> {
  final _key = TextEditingController();
  String _service = 'realdebrid';
  bool _busy = false;
  String? _message;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _service = context.read<AppState>().providers.debridService ?? _service;
  }

  @override
  void dispose() {
    _key.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_key.text.trim().isEmpty) return;
    final app = context.read<AppState>();
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await app.configureDebrid(_service, _key.text);
      _key.clear();
      if (mounted) {
        setState(() {
          _message = app.english
              ? 'Key verified and saved securely.'
              : 'تم التحقق من المفتاح وحفظه بأمان.';
          _error = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _message = _friendlyError(error);
          _error = true;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    await context.read<AppState>().disconnectDebrid();
    if (mounted) {
      setState(() {
        _message = context.read<AppState>().english
            ? 'Debrid service disconnected.'
            : 'تم فصل خدمة Debrid.';
        _error = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final english = app.english;
    final service = app.providers.debridService;
    final connected = service != null && app.providers.debridApiKey != null;
    final user = app.debridUser;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: HorseTheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HorseTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _ServiceIcon(icon: Icons.bolt_rounded),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Debrid',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 3),
                    Text(
                      english
                          ? 'Unlock cached torrent streams — resolved directly on this device.'
                          : 'تشغيل التورنتات المتاحة عبر خدمة Debrid — يُجهَّز الرابط على هذا الجهاز مباشرة.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              if (connected)
                const Icon(Icons.check_circle_rounded, color: HorseTheme.gold),
            ],
          ),
          const SizedBox(height: 14),
          if (connected) ...[
            Text(
              '${_serviceName(service)}${user?['username'] == null ? '' : ' · ${user!['username']}'}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (user?['planName'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  '${english ? 'Plan' : 'الخطة'}: ${user!['planName']}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                onPressed: _busy ? null : _remove,
                icon: const Icon(Icons.link_off_rounded),
                label: Text(english ? 'Remove key' : 'إزالة المفتاح'),
              ),
            ),
          ] else ...[
            DropdownButtonFormField<String>(
              initialValue: _service,
              decoration:
                  InputDecoration(labelText: english ? 'Service' : 'الخدمة'),
              items: const [
                DropdownMenuItem(
                    value: 'realdebrid', child: Text('Real-Debrid')),
                DropdownMenuItem(value: 'alldebrid', child: Text('AllDebrid')),
                DropdownMenuItem(value: 'torbox', child: Text('TorBox')),
              ],
              onChanged: _busy
                  ? null
                  : (value) => setState(() => _service = value ?? _service),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _key,
              obscureText: true,
              autocorrect: false,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText: english ? 'API key' : 'مفتاح API',
                hintText: english
                    ? 'Paste your service API key'
                    : 'ألصق مفتاح الخدمة',
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonalIcon(
                onPressed: _busy ? null : _save,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.verified_user_outlined),
                label: Text(english ? 'Verify and save' : 'التحقق والحفظ'),
              ),
            ),
          ],
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(
              _message!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _error ? const Color(0xFFFF8178) : HorseTheme.gold,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceIcon extends StatelessWidget {
  const _ServiceIcon({required this.icon});
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: HorseTheme.gold.withValues(alpha: .11),
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(icon, color: HorseTheme.gold),
      );
}

String _serviceName(String? service) => switch (service) {
      'realdebrid' => 'Real-Debrid',
      'alldebrid' => 'AllDebrid',
      'torbox' => 'TorBox',
      _ => 'Debrid',
    };

String _friendlyError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['error'] is String) return data['error'] as String;
  }
  return error
      .toString()
      .replaceFirst(RegExp(r'^(Exception|FormatException):\s*'), '');
}
