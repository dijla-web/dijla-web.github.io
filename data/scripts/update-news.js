const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'news.json');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;

const MAX_HOME_NEWS = 30;
const MAX_PER_GLOBAL_TOPIC = 15;
const MAX_ARCHIVE_TOPICS = 300;

function readData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function buildKnownTitlesList(data) {
  const titles = [].concat(data.archive_topics || []);
  (data.home_news || []).forEach((it) => it && it.title && titles.push(it.title.ar || ''));
  const gu = data.global_updates || {};
  ['amazon', 'ocean', 'climate'].forEach((k) => {
    (gu[k] || []).forEach((it) => it && it.title && titles.push(it.title.ar || ''));
  });
  return titles.filter(Boolean);
}

function buildPrompt(knownTitles) {
  return `أنت محرر بيئي محترف تدير قسم الأخبار بموقع "الرافدين تستغيث" — موقع يوثّق أزمات بيئة العراق والعالم.
تتصرف بدقة ومسؤولية إنسان محرر حقيقي، وليس كأداة تلقي كل شي بمكان واحد. مهمتك: البحث عن مستجدات
حقيقية وحديثة (خلال آخر 14 يوماً قدر الإمكان)، وتصنيفها بدقة متناهية ضمن فئة واحدة صحيحة بالضبط،
لأن كل فئة تُعرض تلقائياً بصفحة مخصصة مختلفة بالموقع — أي خطأ بالتصنيف يعني ظهور الخبر بالصفحة الغلط.

===== الفئات المسموحة حصراً (ثماني فئات فقط، ولا فئة غيرها) =====

فئات عراقية (تظهر بالصفحة الرئيسية + صفحتها المخصصة):
1. river    → أخبار محددة عن نهر دجلة و/أو الفرات بالعراق: تلوث، صرف صحي، مناسيب مياه، سدود تركيا/إيران، اتفاقيات مائية، نفوق أسماك بسبب المياه.
2. desert   → أخبار محددة عن التصحر بالعراق: زحف الرمال، جفاف أراضي زراعية، بيانات رسمية عن مساحات متصحرة.
3. pollution→ أخبار محددة عن التلوث الكبريتي أو حرق الغاز المصاحب أو تلوث الهواء الصناعي بالعراق تحديداً.
4. sinkhole → اكتشافات جديدة مشابهة لخسفة الأنبار: كهوف/خسفات/أنهار جوفية/أنواع أحياء نادرة مكتشفة حديثاً بالعراق. لا تضع هنا أي خبر عن أسماك دخيلة أو تلوث مياه عادي — هذا خاص فقط باكتشافات جيولوجية/بيولوجية جديدة.
5. discovery→ استثناء خاص: حدث أو اكتشاف بيئي عراقي **كبير ومهم فعلاً** لا ينطبق إطلاقاً على الفئات الأربع أعلاه
   (مثال: نوع نادر جديد كلياً غير خسفة الأنبار، كارثة بيئية غير مسبوقة، مشروع بيئي وطني ضخم، ظاهرة طبيعية غير معتادة).
   استخدم هذي الفئة **بحذر شديد جداً** وفقط للأخبار الكبيرة التي تستحق صفحة كاملة مستقلة بذاتها — وليس لأي
   خبر عادي أو صغير أو يشبه شي موجود أصلاً. إذا كان بالإمكان تصنيفه ضمن الفئات 1-4، استخدم تلك الفئة دائماً
   ولا تستخدم discovery. القاعدة: discovery نادرة الحدوث، مو فئة "سلة مهملات" لأي شي غامض.

فئات عالمية (تظهر فقط بصفحة "🌍 عالمياً"، تبويبها المحدد، ولا تظهر بالرئيسية):
6. amazon  → أخبار غابات الأمازون المطيرة تحديداً (إزالة غابات، حرائق، حماية). ما لها علاقة بالعراق.
7. ocean   → أخبار المحيطات والبحار عالمياً (تلوث بلاستيكي، تحمّض، شعاب مرجانية، صيد جائر). ما لها علاقة بالعراق.
8. climate → أخبار الاحتباس الحراري والتغير المناخي على المستوى العالمي/العلمي العام (تقارير IPCC، أرقام حرارة قياسية عالمية، اتفاقيات مناخية دولية).

===== قواعد فصل دقيقة (مهم جداً) =====
- إذا كان الخبر عن تأثير الاحتباس الحراري على العراق تحديداً (موجة حر ببغداد مثلاً) → هذا لا يدخل بأي فئة من فئاتك السبع، تجاهله (الموقع أصلاً يغطي هذا الموضوع بمحتوى ثابت). لا تحاول توزيعه بالقوة على "river" أو "climate".
- لا تخلط بين "pollution" (تلوث كبريتي/هوائي عراقي) و"river" (تلوث مائي بدجلة/الفرات) — كل وحدة لها فئتها الدقيقة رغم إنهم كلهم "تلوث" بالمعنى العام.
- إذا الخبر عن سد أو مفاوضات مائية مع تركيا/إيران → river، مو desert حتى لو النتيجة جفاف.
- لا تنشئ فئة جديدة ولا تخترع تسمية غير الثمانية المذكورة أعلاه (بما فيها discovery). إذا الخبر ما ينطبق تماماً وبدقة على فئة واحدة منها، لا تدرجه إطلاقاً — تجاهله بالكامل. الدقة أهم من الكمية.

===== ممنوعات صارمة =====
- ممنوع منعاً باتاً اقتراح أي محتوى يخص صفحات: "من أنا" (about)، "الحاسبة البيئية" (calculator)، "العراق الآن" (map/رصد حي)، أو "تواصل" (contact). هذي صفحات يديرها صاحب الموقع يدوياً فقط، وأنت لا تملك أي صلاحية أو مخطط بيانات يخصها أصلاً — لا تحاول.
- ممنوع اقتراح أي كود HTML أو CSS أو JavaScript — أنت تُنتج بيانات JSON فقط، ولا علاقة لك بتصميم أو بنية الموقع إطلاقاً.
- ممنوع اختراع أخبار أو أرقام أو تواريخ غير موثقة بمصدر حقيقي تأكدت منه عبر البحث.

هذه عناوين/مواضيع موجودة أصلاً بالأرشيف ويجب عدم تكرارها أو اقتراح نفس الخبر مرة أخرى:
${knownTitles.map((t) => `- ${t}`).join('\n')}

===== إذا ما فيه شي جديد =====
إذا بعد البحث الدقيق ما لكيت أي مستجد حقيقي وجديد ضمن الفئات الثمانية، أعد مصفوفات فارغة. هذا متوقع
ومقبول تماماً بمعظم الأيام — الموقع يبقى محدَّث بشكل صحيح حتى لو ما انضاف شي اليوم. لا تجبر نفسك
على إيجاد "شي" لمجرد ملء الاستجابة.

===== صيغة الرد =====
أعد الإجابة بصيغة JSON فقط بدون أي نص إضافي قبله أو بعده، وبدون علامات markdown (لا تستخدم \`\`\`).
لكل خبر: العنوان والملخص والمحتوى بثلاث لغات (عربي ar، إنكليزي en، فرنسي fr) بشكل مستقل ودقيق لكل
لغة (وليس ترجمة آلية حرفية). حقل "body" لكل لغة مصفوفة من 2-4 فقرات قصيرة بدون أي وسوم HTML.
"date" يكتب الشهر والسنة (مثال: "أغسطس 2026"). أعد رابط ودرجة المصدر الحقيقي بـ source_url و source_name.

المخطط بالضبط:
{
  "home_news": [
    {
      "category": "river|desert|pollution|sinkhole|discovery",
      "date": {"ar": "...", "en": "...", "fr": "..."},
      "title": {"ar": "...", "en": "...", "fr": "..."},
      "summary": {"ar": "...", "en": "...", "fr": "..."},
      "body": {"ar": ["..."], "en": ["..."], "fr": ["..."]},
      "source_url": "https://...",
      "source_name": "..."
    }
  ],
  "global_updates": {
    "amazon": [ { "date": {...}, "title": {...}, "summary": {...}, "source_url": "...", "source_name": "..." } ],
    "ocean": [ ... ],
    "climate": [ ... ]
  }
}`;
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4 }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text = json.candidates && json.candidates[0] && json.candidates[0].content &&
    json.candidates[0].content.parts && json.candidates[0].content.parts.map((p) => p.text || '').join('\n');

  if (!text) throw new Error('لم يرجع Gemini أي نص بالرد');
  return text;
}

function extractJson(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('لا يوجد JSON صالح بالرد');
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(cleaned);
}

function isValidLangObj(o) {
  return o && typeof o === 'object' && (o.ar || o.en || o.fr);
}

function makeId(prefix, title) {
  const slug = (title || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${rand}${slug ? '-' + slug : ''}`;
}

function sanitizeHomeItem(raw, knownTitlesLower) {
  if (!raw || !isValidLangObj(raw.title) || !isValidLangObj(raw.summary)) return null;
  const titleAr = (raw.title.ar || raw.title.en || '').trim();
  if (!titleAr) return null;
  if (knownTitlesLower.has(titleAr.toLowerCase())) return null;

  const allowedCategories = ['river', 'desert', 'pollution', 'sinkhole', 'discovery'];
  const category = allowedCategories.includes(raw.category) ? raw.category : 'other';

  return {
    id: makeId('home', titleAr),
    category,
    date: isValidLangObj(raw.date) ? raw.date : { ar: '', en: '', fr: '' },
    title: raw.title,
    summary: raw.summary,
    body: raw.body && typeof raw.body === 'object' ? raw.body : { ar: [], en: [], fr: [] },
    image: typeof raw.image === 'string' ? raw.image : null,
    source_url: typeof raw.source_url === 'string' ? raw.source_url : null,
    source_name: typeof raw.source_name === 'string' ? raw.source_name : null
  };
}

function sanitizeGlobalItem(raw, knownTitlesLower) {
  if (!raw || !isValidLangObj(raw.title) || !isValidLangObj(raw.summary)) return null;
  const titleAr = (raw.title.ar || raw.title.en || '').trim();
  if (!titleAr) return null;
  if (knownTitlesLower.has(titleAr.toLowerCase())) return null;

  return {
    id: makeId('gu', titleAr),
    date: isValidLangObj(raw.date) ? raw.date : { ar: '', en: '', fr: '' },
    title: raw.title,
    summary: raw.summary,
    source_url: typeof raw.source_url === 'string' ? raw.source_url : null,
    source_name: typeof raw.source_name === 'string' ? raw.source_name : null
  };
}

async function main() {
  if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY غير موجود بمتغيرات البيئة. تأكد من إضافته كـ Secret بالمستودع.');
    process.exit(1);
  }

  const data = readData();
  const knownTitles = buildKnownTitlesList(data);
  const knownTitlesLower = new Set(knownTitles.map((t) => t.toLowerCase()));

  console.log(`🔎 عدد المواضيع المؤرشفة حالياً: ${knownTitles.length}`);
  console.log(`🤖 استدعاء Gemini (${MODEL}) مع بحث كوكل...`);

  const prompt = buildPrompt(knownTitles);
  const rawText = await callGemini(prompt);

  let parsed;
  try {
    parsed = extractJson(rawText);
  } catch (e) {
    console.error('⚠️ تعذّر تحليل رد Gemini كـ JSON صالح. لن يتم تعديل الملف. نص الرد:');
    console.error(rawText.slice(0, 2000));
    process.exit(0);
  }

  const newHome = (parsed.home_news || [])
    .map((it) => sanitizeHomeItem(it, knownTitlesLower))
    .filter(Boolean);

  const gu = parsed.global_updates || {};
  const newAmazon = (gu.amazon || []).map((it) => sanitizeGlobalItem(it, knownTitlesLower)).filter(Boolean);
  const newOcean = (gu.ocean || []).map((it) => sanitizeGlobalItem(it, knownTitlesLower)).filter(Boolean);
  const newClimate = (gu.climate || []).map((it) => sanitizeGlobalItem(it, knownTitlesLower)).filter(Boolean);

  const totalNew = newHome.length + newAmazon.length + newOcean.length + newClimate.length;
  console.log(`✅ عدد المقالات/التحديثات الجديدة والصالحة: ${totalNew}`);

  if (totalNew === 0) {
    console.log('لا يوجد جديد اليوم — لن يتم تعديل data/news.json.');
    return;
  }

  data.home_news = [...(data.home_news || []), ...newHome].slice(-MAX_HOME_NEWS);
  data.global_updates = data.global_updates || { amazon: [], ocean: [], climate: [] };
  data.global_updates.amazon = [...(data.global_updates.amazon || []), ...newAmazon].slice(-MAX_PER_GLOBAL_TOPIC);
  data.global_updates.ocean = [...(data.global_updates.ocean || []), ...newOcean].slice(-MAX_PER_GLOBAL_TOPIC);
  data.global_updates.climate = [...(data.global_updates.climate || []), ...newClimate].slice(-MAX_PER_GLOBAL_TOPIC);

  const addedTitles = [...newHome, ...newAmazon, ...newOcean, ...newClimate].map((it) => it.title.ar || it.title.en);
  data.archive_topics = [...(data.archive_topics || []), ...addedTitles].slice(-MAX_ARCHIVE_TOPICS);

  data.last_run = new Date().toISOString();

  writeData(data);
  console.log('💾 تم تحديث data/news.json بنجاح.');
}

main().catch((err) => {
  console.error('❌ فشل السكربت:', err.message || err);
  process.exit(1);
});
