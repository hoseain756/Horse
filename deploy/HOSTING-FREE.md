# استضافة محرك التورنت مجاناً وعلى مدار الساعة (24/7) — وسبب استحالة تشغيله على Vercel نفسه

> هذه الوثيقة تجيب على سؤالين:
> 1. **لماذا لا يمكن تشغيل المحرك على Vercel نفسه؟** (الجواب موثّق بمصادر رسمية، وليس رأياً)
> 2. **ما الحل المجاني الذي يعمل فعلاً مع نشر `horse-1.vercel.app`؟** (ثلاثة خيارات، الأول مجاني للأبد)

---

## 1) الحقيقة الصريحة: ثلاثة حواجز تجعل Vercel مستحيلاً

| # | الحاجز | الدليل (مصادر رسمية) | النتيجة |
| --- | --- | --- | --- |
| 1 | **مدة الدالة القصوى** | Hobby = **300 ثانية كحدّ أقصى** (افتراضي وأقصى معاً)؛ Pro/Enterprise = 800 ثانية (قابلة للتمديد إلى 1800 ثانية = 30 دقيقة). المصدر: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) | جلسة تورنت حيّة تمتد **ساعات** (تنزيل + إقران + بث). حتى أقصى حد على الخطة المدفوعة (30 دقيقة) لا يكفي لمشاهدة فيلم واحد، وخطة Hobby (وهي خطة horse-1) تتوقف بعد **5 دقائق**. |
| 2 | **لا مقابس واردة ولا UDP** | دوال Vercel تستقبل **HTTP عبر حافة المنصة فقط**؛ لا يمكنها الاستماع على TCP/UDP. بروتوكول DHT (اكتشاف الأقران) يعمل على UDP، ومعظم الأقران عبر TCP/uTP وارد وصادر طويل الأمد. كما أن `/tmp` مؤقت ويزول مع إعادة تدوير المثيل. | محرك تورنت بدون DHT وبدون مقابس حية = لا أقران = لا تنزيل. هذا قيد منصّي، لا إعدادي. |
| 3 | **سياسة الاستخدام المقبول + DMCA** | [Vercel AUP](https://vercel.com/legal/acceptable-use-policy) (تحديث 21 أبريل 2026): القسم 4 يخصّص آلية DMCA §512 لحقوق النشر، والقسم 5 ينص أن المخالفة "**إخلال جوهري بالاتفاقية**" → تعليق/إنهاء المشروع أو الحساب. | حتى لو خُدع الحاجزان 1 و2، فتشغيل تنزيلات تورنت على Vercel يعرّض حسابك للإيقاف. **لن أضيف كود تورنت داخل دوال Vercel** — حمايةً لمشروعك وأمنحك حلاً لا يُحذف لاحقاً. |

**ماذا عن Fluid Compute؟** يحفظ الذاكرة بين الطلبات ويطيل المدة، لكنه لا يمنح UDP، ولا مقابس واردة، ولا يعالج الحاجز 3. أي أن الفكرة تبقى مستحيلة تقنياً وسياسياً.

> **الخلاصة:** الحل ليس "داخل Vercel" — بل: **التطبيق يبقى على Vercel كما هو، والمحرك يعمل في مكان مجاني دائم يتصل به**. من منظورك كمستخدم ستفتح horse-1.vercel.app وتشاهد داخل التطبيق تماماً كما في المعاينة.

---

## 2) الخيار الأول — Oracle Cloud Always Free (مجاني **فعلياً** للأبد، وليس تجربة)

هذا أفضل مضيف مجاني دائم متاح اليوم لبروتوكول P2P، لأنه **خادم كامل** (وليس دوالاً بلا حالة): مقابس TCP/UDP حرة، قرص دائم، Docker كامل.

> ⚠️ **حدود يونيو 2026 المهمة:** خفّضت Oracle المنحة المجانية الدائمة إلى **1500 ساعة‑OCPU/شهر** و**9000 ساعة‑GB/شهر**. لذلك:
> - أنشئ الجهاز بمواصفات **2 OCPU + 12 GB RAM** → يعمل **24/7 طوال الشهر** ضمن المنحة (2×744 = 1488 ≤ 1500 ✓).
> - الحجم القديم 4 OCPU / 24 GB لن يبقى شغّالاً إلا **~15.6 يوم** شهرياً ثم يتوقف عن الفوترة المجانية — لا تختره.
> - المصدر: [Always Free Resources — Oracle Docs](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

### ماذا تحصل مجاناً؟

| المورد | المنحة الدائمة |
| --- | --- |
| معالج ARM Ampere A1 | 2 OCPU (يعمل 24/7 ضمن 1500 ساعة‑OCPU) |
| ذاكرة | 12 GB (ضمن 9000 ساعة‑GB) |
| تخزين كتلي | حتى 200 GB |
| نقل بيانات صادر | ≈ 10 TB/شهر (تأكد من صفحة [Free Tier](https://www.oracle.com/cloud/free)) |

### الخطوات الكاملة (≈ 15 دقيقة)

**أ. التسجيل وإنشاء الجهاز**

1. سجّل في [oracle.com/cloud/free](https://www.oracle.com/cloud/free) — يطلب بطاقة **للتحقق فقط**؛ الموارد الدائمة (Always Free) لا تُخصم منها.
2. من Console: **Compute → Instances → Create Instance**:
   - Image: **Ubuntu 22.04** (أو 24.04) — aarch64
   - Shape: **VM.Standard.A1.Flex** → **2 OCPU / 12 GB** ← مهم (انظر تحذير الحدود أعلاه)
   - Boot volume: 50–100 GB
   - حمّل مفتاح SSH الخاص (أو استخدم مفتاحاً لديك).
3. بعد الجاهزية، اتصل: `ssh ubuntu@<PUBLIC_IP>`

**ب. فتح المنفذ (مستويان إلزاميان)**

```bash
# المستوى 1 — قائمة أمان VCN من موقع Oracle:
#   Networking → Virtual Cloud Networks → شبكتك → Security Lists → Default → Add Ingress Rule:
#   Source CIDR = 0.0.0.0/0 , IP Protocol = TCP , Destination Port = 3031
#   (أضف قاعدة UDP 6881 وأيضاً TCP 6881 لتحسين الاتصال بالأقران — اختياري لكنه مفيد)

# المستوى 2 — جدار النظام داخل أوبونتو:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3031 -j ACCEPT
sudo netfilter-persistent save
```

**ج. تشغيل المحرك عبر Docker (من حزمة `deploy/` في هذا المستودع)**

```bash
sudo apt-get update && sudo apt-get -y install docker.io docker-compose-v2
sudo usermod -aG docker ubuntu && newgrp docker

git clone https://github.com/hoseain756/Horse.git && cd Horse/deploy

# مفتاح سري طويل — ستحتاجه في Vercel لاحقاً
echo "ENGINE_API_KEY=$(openssl rand -hex 24)" > .env

docker compose up -d
curl -s http://127.0.0.1:3031/health   # يجب أن يعيد JSON سليماً
```

**د. HTTPS عام بلا دومين — عبر Cloudflare Tunnel (مجاني)**

`ENGINE_PUBLIC_URL` يجب أن يكون **https** عاماً (المتصفح يشغّل صفحة https ولن يتصل بـ http://IP — قيود متصفح Mixed-Content). أسرع حل بلا دومين وبدون فتح منافذ:

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel --url http://localhost:3031
# سيطبع رابطاً مثل: https://random-words-1234.trycloudflare.com
```

> ملاحظة صادقة: الرابط السريع (Quick Tunnel) **يتغير عند كل تشغيل** — مناسب للتجربة. لرابط ثابت 24/7 أنشئ "Named Tunnel" مجانياً (يتطلب تسجيل Cloudflare مجاني، بلا دومين مدفوع عبر نطاقات `trycloudflare` المدارة أو دومين رخيص تملكه). شغّل النفقين (المحرك + النفق) كخدمات تعمل دائماً:
> ```bash
> sudo cloudflared service install <NAMED-TUNNEL-TOKEN>
> sudo systemctl enable --now docker
> ```

**هـ. ربط Vercel (خطوة أخيرة)**

في Vercel → المشروع → Settings → Environment Variables، أضف ثم **أعد النشر**:

| المتغير | القيمة |
| --- | --- |
| `ENGINE_URL` | `https://random-words-1234.trycloudflare.com` (نفس رابط النفق) |
| `ENGINE_PUBLIC_URL` | نفس الرابط أعلاه |
| `ENGINE_API_KEY` | قيمة `.env` التي أنشأتها في الخطوة (ج) |

**و. التحقق داخل التطبيق**

افتح horse-1.vercel.app → الإعدادات → التكاملات → **P2P** → يجب أن تظهر شارة **"محرك خارجي"** — اضغط **"اختبار المحرك"** → أخضر ✓ → شغّل أي تورنت داخل المشغّل.

---

## 3) الخيار الثاني — المحرك على جهازك (مجاني، يعمل الآن، نقرتا نقر)

إذا كان الكمبيوتر/اللابتوب متاحاً أثناء المشاهدة فهذا أبسط حل ولا يحتاج أي حساب:

- **Windows:** افتح مجلد `mini-services/torrent-service` وانقر نقراً مزدوجاً على **`start-engine.bat`**
- **macOS:** انقر نقراً مزدوجاً على **`start-engine.command`**
- **Linux:** شغّل `./start-engine.sh`

السكربت يثبّت المتطلبات تلقائياً عند أول تشغيل ثم يشغّل المحرك على `http://localhost:3031`.
ثم في التطبيق (حتى على Vercel): الإعدادات → التكاملات → P2P → **"المحرك على هذا الجهاز"** → الصق `http://localhost:3031` → **حفظ واختبار**.

**حدوده (بصراحة):** الجهاز يجب أن يبقى شغّالاً أثناء المشاهدة، والإعداد لكل جهاز على حدة.

---

## 4) مقارنة الخيارات

| الخيار | التكلفة | يعمل 24/7؟ | كل الأجهزة؟ | الجهد |
| --- | --- | --- | --- | --- |
| **Oracle Always Free + Tunnel** | **$0 للأبد** | ✅ نعم | ✅ نعم | ~15 دقيقة، مرة واحدة |
| **المحرك المحلي على جهازك** | $0 | ⚠️ طالما الجهاز شغّال | ❌ لكل جهاز إعداده | ~2 دقيقة |
| **Debrid** (مقارنة) | اشتراك (~€3/16 يوم) | ✅ | ✅ | ~2 دقيقة |
| ~~تشغيل المحرك على Vercel~~ | — | ❌ مستحيل (الحواجز الثلاثة أعلاه) | — | — |

---

## 5) استكشاف الأخطاء

| المشكلة | السبب والحل |
| --- | --- |
| "اختبار المحرك" يعيد "غير قابل للوصول" | المنفذ مغلق: تأكد من قاعدة **Security List** **و** `iptables` معاً (المستويان). جرّب `curl http://<IP>:3031/health` من جهازك. |
| يعمل بـ http لكن لا يعمل مع الموقع | المتصفح يمنع http داخل صفحة https — استخدم **Cloudflare Tunnel** (الخطوة د). |
| "عدم تطابق المفتاح" (401) | `ENGINE_API_KEY` في `.env` على الخادم ≠ القيمة في Vercel — يجب أن تكون **نفس القيمة** تماماً. |
| بطيء أو لا أقران | افتح منافذ TCP+UDP **6881** أيضاً؛ المحرك يحتاج اتصالات واردة لسرعة أفضل. تحقق أن الجهاز لا "ينام" (Oracle لا يوقف Always Free، لكن أوقف Hibernation إن وجدت). |
| الجهاز تغيّر رابط النفق | Quick Tunnel يتغير عند كل إعادة تشغيل — استخدم Named Tunnel أو ثبّت الرابط ثم حدّث `ENGINE_URL`/`ENGINE_PUBLIC_URL` في Vercel. |

---

## 6) المصادر

- Vercel Functions Limits (المدة القصوى): https://vercel.com/docs/functions/limitations
- Vercel Acceptable Use Policy (DMCA + المخالفة إخلال جوهري): https://vercel.com/legal/acceptable-use-policy
- Oracle Always Free Resources: https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Cloud Free Tier: https://www.oracle.com/cloud/free
- دليل النشر الكامل (Docker/Caddy/Render): [deploy/README.md](./README.md)
- أوامر المحرك المحلي: [mini-services/torrent-service/README.md](../mini-services/torrent-service/README.md)
