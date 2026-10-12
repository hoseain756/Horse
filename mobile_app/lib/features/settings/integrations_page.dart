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
                    ? 'Trakt and Simkl sync through your Horse account. Debrid keys stay in secure device storage and are sent only when resolving a stream.'
                    : 'تتصل Trakt وSimkl بحساب Horse. تُحفظ مفاتيح Debrid في التخزين الآمن للجهاز ولا تُرسل إلا عند تجهيز رابط التشغيل.',
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

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    final app = context.read<AppState>();
    if (app.horseUser == null) {
      _setMessage(
        app.english
            ? 'Sign in to your Horse account first.'
            : 'سجّل الدخول إلى حساب Horse أولًا.',
        error: true,
      );
      return;
    }
    _pollTimer?.cancel();
    setState(() {
      _busy = true;
      _flow = null;
      _message = null;
    });
    try {
      final result = await app.api.startLinkedService(widget.service);
      final pollId = result['pollId']?.toString() ?? '';
      final code = result['userCode']?.toString() ?? '';
      final verificationUrl = result['verificationUrl']?.toString() ?? '';
      if (pollId.isEmpty || code.isEmpty || verificationUrl.isEmpty) {
        throw const FormatException('تعذر إنشاء رمز الربط.');
      }
      if (!mounted) return;
      setState(() {
        _flow = {
          'pollId': pollId,
          'userCode': code,
          'verificationUrl': verificationUrl,
          'intervalSec': (result['intervalSec'] as num?)?.toInt() ?? 5,
          'expiresAt': (result['expiresAt'] as num?)?.toInt() ??
              DateTime.now()
                  .add(const Duration(minutes: 10))
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
    final pollId = flow['pollId']?.toString() ?? '';
    try {
      final result = await context.read<AppState>().api.pollLinkedService(
            widget.service,
            pollId,
          );
      if (!mounted) return;
      final status = result['status']?.toString();
      if (status == 'authorized' && result['linkId'] is String) {
        await context.read<AppState>().saveLinkedService(widget.service, {
          'linkId': result['linkId'],
          'username': result['username'],
          'avatar': result['avatar'],
          'linkedAt': DateTime.now().millisecondsSinceEpoch,
        });
        if (!mounted) return;
        setState(() {
          _flow = null;
          _error = false;
          _message = context.read<AppState>().english
              ? 'Account connected.'
              : 'تم ربط الحساب.';
        });
        return;
      }
      if (status == 'pending') {
        final retryMs = (result['retryInMs'] as num?)?.toInt() ??
            ((_flow?['intervalSec'] as int? ?? 5) * 1000);
        _schedulePoll(Duration(milliseconds: retryMs.clamp(3000, 30000)));
        return;
      }
      setState(() {
        _flow = {...flow, 'status': status ?? 'failed'};
        _message = result['error']?.toString() ??
            (status == 'expired'
                ? (context.read<AppState>().english
                    ? 'The code expired.'
                    : 'انتهت صلاحية الرمز.')
                : (context.read<AppState>().english
                    ? 'The link was not approved.'
                    : 'لم تتم الموافقة على الربط.'));
        _error = true;
      });
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
          if (linked != null) ...[
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
              _flow?['userCode']?.toString() ?? '',
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
                      ClipboardData(text: _flow?['userCode']?.toString() ?? ''),
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
                    Uri.parse(_flow?['verificationUrl'].toString() ?? ''),
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
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _busy || app.horseUser == null ? null : _start,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 17,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.link_rounded),
                label: Text(
                  app.horseUser == null
                      ? (english
                          ? 'Sign in to Horse first'
                          : 'سجّل الدخول إلى Horse أولًا')
                      : (english
                          ? 'Connect ${widget.title}'
                          : 'ربط ${widget.title}'),
                ),
              ),
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
    _service = context.read<AppState>().api.debridService ?? _service;
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
    final service = app.api.debridService;
    final connected = service != null && app.api.debridApiKey != null;
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
                          ? 'Unlock cached torrent streams.'
                          : 'تشغيل التورنتات المتاحة عبر خدمة Debrid.',
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
            if (user?['premium'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  '${english ? 'Plan' : 'الخطة'}: ${user!['premium']}',
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
