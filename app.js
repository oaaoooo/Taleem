// ============================================================
// Taleem — tutoring marketplace API (Hono, Node + Workers)
// ============================================================
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  hashPassword, verifyPassword, signToken, verifyToken,
  normalizePhone, cairoDayRange, COUNTRIES, PAY_AR, BOOK_AR, KIND_AR, WD_AR
} from './lib.js';

export async function createApp({ q, sessionSecret }) {
  const app = new Hono();
  const PEPPER = 'taleem:' + sessionSecret;

  // ---------- tiny rate limiter (per-isolate) ----------
  const hits = new Map();
  const limit = (key, max, ms = 60000) => async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'x';
    const k = key + ':' + ip;
    const now = Date.now();
    const arr = (hits.get(k) || []).filter(t => now - t < ms);
    if (arr.length >= max) return c.json({ ok: false, error: 'محاولات كتير — استنى دقيقة وحاول تاني ⏳' }, 429);
    arr.push(now);
    hits.set(k, arr);
    return next();
  };

  // ---------- settings ----------
  const getSetting = async (k) => {
    const r = await q`SELECT value FROM settings WHERE key = ${k}`;
    return r.rows.length ? r.rows[0].value : '';
  };
  const setSetting = async (k, v) => {
    await q`INSERT INTO settings(key,value) VALUES(${k},${String(v)})
      ON CONFLICT(key) DO UPDATE SET value = ${String(v)}`;
  };
  const getSettings = async (keys) => {
    const r = await q`SELECT key, value FROM settings`;
    const m = {};
    r.rows.forEach(x => { m[x.key] = x.value; });
    const out = {};
    keys.forEach(k => { out[k] = m[k] || ''; });
    return out;
  };

  // ---------- legal texts (seeded, editable from admin) ----------
  const LEGAL = {
    terms: `شروط الاستخدام

1) طبيعة المنصة: المنصة وسيط تقني يجمع بين المعلمين المستقلين والطلاب، ولا تقدم الخدمة التعليمية بنفسها ولا تعتبر جهة توظيف للمعلمين.

2) الحسابات: يجب تقديم بيانات صحيحة. تسجيل من هم دون 18 سنة يتم بمعرفة ولي الأمر. أنت مسئول عن سرية كلمة المرور الخاصة بك.

3) الحجز والدفع: الدفع مقدم قبل الحصة بالطرق اليدوية المعلنة، وتتم مراجعة المدفوعات واعتمادها من الإدارة خلال 24 ساعة كحد أقصى.

4) الإلغاء والاسترداد: إلغاء الطالب قبل موعد الحصة بـ 12 ساعة على الأقل يستحق استردادًا كاملًا. الإلغاء في مدة أقل يستحق 50% فقط. غياب المعلم يستحق تعويض الحصة مجانًا أو استردادًا كاملًا حسب رغبة الطالب. غياب الطالب دون إلغاء مسبق لا يستحق أي استرداد.

5) قواعد السلوك: الالتزام بالاحترام المتبادل. يُمنع تسجيل الحصص أو نشرها دون إذن كتابي. يُمنع مشاركة روابط الحصص مع غير المسجلين. يُمنع الاتفاق بين المعلم والطالب خارج المنصة، ويعرض الحساب المخالف للإيقاف النهائي.

6) حدود المسئولية: تبذل المنصة عناية معقولة في اختيار المعلمين ومراجعة الشكاوى، ولا تضمن نتيجة تعليمية محددة. الحد الأقصى لمسئولية المنصة عن أي حصة هو قيمة تلك الحصة. لا مسئولية عن أعطال الإنترنت أو برامج الاجتماعات لدى أي طرف.

7) الإيقاف: يحق للإدارة إيقاف أو إغلاق أي حساب مخالف لهذه الشروط دون استرداد للمبالغ المرتبطة بالمخالفة.

8) القانون الواجب التطبيق: تخضع هذه الشروط لقوانين جمهورية مصر العربية، وتختص محاكم القاهرة بنظر أي نزاع.

9) التواصل: لأي استفسار أو شكوى تواصل مع الدعم عبر واتساب المنصة المعلن في الموقع.`,
    privacy: `سياسة الخصوصية

1) البيانات التي نجمعها: الاسم، أرقام الهواتف (الطالب وولي الأمر)، الدولة، الصف الدراسي، سجل الحجوزات والمدفوعات، والتقييمات التي تكتبها.

2) استخدام البيانات: تشغيل الخدمة (الحجز والتواصل وتنظيم الحصص)، والرد على الاستفسارات، وتحسين جودة المنصة.

3) مشاركة البيانات: يرى المعلم بيانات التواصل الخاصة بطلاب حجوزاته المؤكدة فقط لغرض تقديم الحصة. يرى الطالب رقم واتساب المعلم بعد اعتماد الدفع فقط. لا نبيع بياناتك لأي طرف ثالث إطلاقًا.

4) ملفات تعريف الارتباط: نستخدم ملف جلسة واحد لتسجيل الدخول فقط (تذكرني)، ولا نستخدم أي أدوات تتبع إعلانية.

5) الأمان: كلمات المرور مخزنة بصورة مشفرة لا يمكن استرجاعها، والاتصال بالموقع مؤمن. ورغم ذلك لا توجد وسيلة إلكترونية آمنة بنسبة 100%.

6) الاحتفاظ والحذف: نحتفظ بالبيانات طالما الحساب نشط. يمكنك طلب حذف حسابك وبياناتك عبر الدعم، ويُنفذ خلال 7 أيام مع الاحتفاظ بسجلات المدفوعات المطلوبة قانونيًا.

7) بيانات القُصّر: تسجيل الطلاب دون 18 سنة يتم عبر ولي الأمر صاحب القرار في مشاركة البيانات.

8) التعديلات: أي تعديل على هذه السياسة يُعلن في الموقع، واستمرار استخدامك للمنصة يعني موافقتك عليه.`,
    teacher_terms: `شروط انضمام المعلم وواجباته والعقوبات

أولًا: شروط الانضمام
1) مؤهل علمي أو خبرة موثقة في المادة المتقدم لها.
2) صورة شخصية حقيقية وبيانات تواصل صحيحة ورقم واتساب فعال.
3) اجتياز المقابلة أو الحصة التجريبية التي تحددها الإدارة.
4) الموافقة على هذه الشروط ونسبة العمولة المعلنة. القبول من عدمه حق أصيل للإدارة دون إبداء أسباب.

ثانيًا: العمولة والمستحقات
1) تحصل المنصة على نسبة عمولة من كل حصة مدفوعة وفق النسبة المعلنة في الموقع أو المتفق عليها كتابة مع المعلم.
2) تُحتسب مستحقات المعلم تلقائيًا عن الحصص المكتملة مدفوعة القيمة.
3) صرف المستحقات أسبوعيًا بحد أدنى للسحب وفق المعلن في الموقع، عبر الطرق المتاحة.

ثالثًا: واجبات المعلم
1) الالتزام الكامل بالمواعيد والحضور قبل الحصة بـ 5 دقائق على الأقل.
2) التأكد من عمل رابط الاجتماع (زووم/جوجل ميت) قبل كل حصة.
3) التحضير الجيد وتقديم شرح يليق بسمعة المنصة.
4) الإبلاغ المسبق عن أي تأجيل قبل 24 ساعة على الأقل.
5) الحفاظ على سرية بيانات الطلاب وعدم استخدامها خارج الحصص.
6) السلوك المهني المحترم مع جميع الطلاب وأولياء الأمور.
7) يُمنع منعًا باتًا الاتفاق مع الطلاب خارج المنصة أو طلب أي مبالغ خارجها.

رابعًا: العقوبات (تدرج حسب جسامة المخالفة)
1) تنبيه كتابي أول مرة للمخالفات البسيطة (تأخير يسير ونحوه).
2) خصم من المستحقات عند تكرار التأخير أو إلغاء الحصص دون عذر.
3) إيقاف مؤقت عن استقبال حجوزات جديدة.
4) فصل نهائي ومصادرة المستحقات المعلقة في حالات: الغش، الإساءة للطلاب، إفشاء البيانات، أو التعامل خارج المنصة.

خامسًا: يحق لأي طرف إنهاء التعاون بإشعار كتابي قبل 7 أيام، مع استكمال الحصص المحجوزة مدفوعة القيمة.`,
    student_terms: `واجبات الطالب وقواعد الحضور

1) تقديم بيانات صحيحة عند التسجيل، وتسجيل القُصّر بمعرفة ولي الأمر.

2) سداد قيمة الحصة مقدمًا بالطرق المعلنة، ولا يُعتمد الحجز إلا بعد مراجعة الدفع.

3) الحضور في الموعد المحدد. التأخير أكثر من 15 دقيقة يُعتبر غيابًا دون استرداد، مع احتفاظ المعلم بحقه في إنهاء الحصة في موعدها.

4) الإلغاء قبل موعد الحصة بـ 12 ساعة على الأقل لاستحقاق الاسترداد الكامل، والإلغاء في مدة أقل يستحق 50% فقط.

5) الالتزام بالسلوك المحترم تجاه المعلم والزملاء في المجموعات.

6) يُمنع تسجيل الحصص صوتًا أو صورة أو نشر أي جزء منها دون إذن كتابي من المعلم والإدارة.

7) يُمنع مشاركة روابط الحصص مع أي شخص غير مسجل.

8) يُمنع الاتفاق مع المعلم خارج المنصة، ويعرض الحساب المخالف للإيقاف دون استرداد.

9) العقوبات: تنبيه، ثم إيقاف مؤقت عن الحجز، ثم إغلاق الحساب نهائيًا دون استرداد للمخالفات الجسيمة أو المتكررة.`
  };

  // ---------- seed ----------
  async function seed() {
    if ((await getSetting('seeded')) === '1') return;
    const S = {
      academy_name: 'أكاديمية النور',
      tagline: 'دروس لايف مع نخبة المعلمين — برايفت ومجموعات 📚',
      currency: 'ج.م',
      commission_default: '30',
      pay_methods: JSON.stringify([
        { name: 'فودافون كاش', account: '', note: 'حوّل المبلغ على الرقم ثم اكتب رقم التليفون المحوِّل منه في خانة الإثبات' },
        { name: 'انستاباي', account: '', note: 'حوّل على العنوان ثم اكتب اسم الحساب المحوِّل في خانة الإثبات' }
      ]),
      enable_private: '1', enable_groups: '1',
      req_student_phone: '0', req_guardian_phone: '1',
      subjects: JSON.stringify(['لغة عربية', 'قرآن كريم', 'لغة إنجليزية', 'رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'فرنساوي', 'ألماني']),
      grades: JSON.stringify(['ابتدائي', 'إعدادي', 'ثانوي', 'جامعة', 'تحفيظ قرآن', 'تأسيس', 'أخرى']),
      admin_whatsapp: '', announcement: '',
      withdraw_min: '200', withdraw_cycle: 'أسبوعي', cancel_hours: '12',
      meet_guide: 'ادخل على رابط الحصة قبل موعدها بـ 5 دقائق. لو زووم: حمّل تطبيق Zoom وسجّل دخول بأي إيميل. لو جوجل ميت: افتح الرابط من متصفح كروم وسجّل دخول بحساب جوجل. تأكد إن المايك والكاميرا شغالين، واختار مكان هادي. لو الرابط مش شغال كلّم الدعم فورًا.',
      admin_password: await hashPassword('admin123', PEPPER),
      legal_terms: LEGAL.terms, legal_privacy: LEGAL.privacy,
      legal_teacher: LEGAL.teacher_terms, legal_student: LEGAL.student_terms,
      seeded: '1'
    };
    for (const [k, v] of Object.entries(S)) await setSetting(k, v);
    // seed teachers (edit phones/data from admin panel)
    const tpw = await hashPassword('teacher123', PEPPER);
    const T = [
      ['أ. مريم أحمد', '0100000001', 'لغة عربية', 'معلمة لغة عربية خبرة 10 سنوات في تأسيس النحو والبلاغة وتبسيط المناهج لجميع المراحل.', 120, 50],
      ['أ. فاطمة السيد', '0100000002', 'قرآن كريم', 'محفظة قرآن كريم بالتجويد لجميع الأعمار، تحفيظ ومراجعة وتثبيت بمنهجية ميسرة.', 100, 40],
      ['أ. نورا علي', '0100000003', 'لغة إنجليزية', 'معلمة لغة إنجليزية متخصصة في التأسيس والمحادثة ومناهج المدارس لغات وعربي.', 150, 60]
    ];
    for (const [name, phone, subject, bio, pp, pg] of T) {
      await q`INSERT INTO teachers(name, phone, whatsapp, subject, bio, price_private, price_group, password, active, featured)
        VALUES(${name},${phone},${phone},${subject},${bio},${pp},${pg},${tpw},1,1)`;
    }
    console.log('✅ Taleem seeded (admin: admin123 / teachers: teacher123)');
  }
  await seed();

  // ---------- auth helpers ----------
  const COOKIE = 'tl_sid';
  async function currentUser(c) {
    const tok = getCookie(c, COOKIE);
    if (!tok) return null;
    const p = await verifyToken(tok, sessionSecret);
    if (!p || !p.r) return null;
    if (p.r === 'a') {
      const h = await getSetting('admin_password');
      if (!h || h.slice(0, 12) !== p.ph) return null;
      return { role: 'admin', id: 0, name: 'الإدارة' };
    }
    if (p.r === 's') {
      const r = await q`SELECT * FROM students WHERE id = ${p.id} AND active = 1`;
      if (!r.rows.length || String(r.rows[0].password).slice(0, 12) !== p.ph) return null;
      const u = r.rows[0]; delete u.password;
      return { role: 'student', ...u };
    }
    if (p.r === 't') {
      const r = await q`SELECT * FROM teachers WHERE id = ${p.id} AND active = 1`;
      if (!r.rows.length || String(r.rows[0].password).slice(0, 12) !== p.ph) return null;
      const u = r.rows[0]; delete u.password;
      return { role: 'teacher', ...u };
    }
    return null;
  }
  const need = (role) => async (c, next) => {
    const u = await currentUser(c);
    if (!u || u.role !== role) return c.json({ ok: false, error: 'سجّل الدخول الأول 🔐' }, 401);
    c.set('u', u);
    return next();
  };
  async function issueToken(c, role, id, ph, remember) {
    const exp = Date.now() + (remember ? 30 * 864e5 : 864e5);
    const tok = await signToken({ r: role, id, ph, exp }, sessionSecret);
    setCookie(c, COOKIE, tok, {
      httpOnly: true, sameSite: 'Lax', path: '/',
      secure: new URL(c.req.url).protocol === 'https:',
      ...(remember ? { maxAge: 30 * 86400 } : {})
    });
  }

  const PUB_KEYS = ['academy_name', 'tagline', 'currency', 'enable_private', 'enable_groups',
    'req_student_phone', 'req_guardian_phone', 'subjects', 'grades', 'admin_whatsapp',
    'announcement', 'pay_methods', 'withdraw_min', 'withdraw_cycle', 'cancel_hours', 'meet_guide'];
  const parseJSON = (s, fb) => { try { const v = JSON.parse(s || ''); return v === undefined ? fb : v; } catch { return fb; } };

  // ============================================================
  // PUBLIC
  // ============================================================
  app.get('/health', (c) => c.json({ ok: true }));
  app.get('/admin', (c) => c.redirect('/admin.html'));

  app.get('/api/bootstrap', async (c) => {
    const s = await getSettings(PUB_KEYS);
    s.subjects = parseJSON(s.subjects, []);
    s.grades = parseJSON(s.grades, []);
    s.pay_methods = parseJSON(s.pay_methods, []);
    s.countries = COUNTRIES;
    s.payAr = PAY_AR; s.bookAr = BOOK_AR; s.kindAr = KIND_AR; s.wdAr = WD_AR;
    const t = await q`SELECT COUNT(*)::int c FROM teachers WHERE active = 1`.catch(async () => q`SELECT COUNT(*) c FROM teachers WHERE active = 1`);
    s.teachers_count = t.rows[0].c;
    return c.json({ ok: true, s }, 200, { 'Cache-Control': 'public, max-age=60' });
  });

  const teacherPublic = (t) => ({
    id: t.id, name: t.name, subject: t.subject, bio: t.bio, img_id: t.img_id,
    video_url: t.video_url, price_private: Number(t.price_private), price_group: Number(t.price_group),
    schedule_text: t.schedule_text, rating: Number(t.rating) || 0,
    ratings_count: Number(t.ratings_count) || 0, featured: Number(t.featured) || 0
  });

  app.get('/api/teachers', async (c) => {
    const subject = (c.req.query('subject') || '').trim();
    const rows = subject
      ? (await q`SELECT * FROM teachers WHERE active = 1 AND subject = ${subject} ORDER BY featured DESC, rating DESC`).rows
      : (await q`SELECT * FROM teachers WHERE active = 1 ORDER BY featured DESC, rating DESC`).rows;
    return c.json({ ok: true, teachers: rows.map(teacherPublic) }, 200, { 'Cache-Control': 'public, max-age=60' });
  });

  app.get('/api/teacher/:id', async (c) => {
    const r = await q`SELECT * FROM teachers WHERE id = ${c.req.param('id')} AND active = 1`;
    if (!r.rows.length) return c.json({ ok: false, error: 'المعلم غير متاح' }, 404);
    const t = teacherPublic(r.rows[0]);
    const g = await q`SELECT g.*, (SELECT COUNT(*) FROM group_members m
        WHERE m.group_id = g.id AND m.status = 'active' AND m.pay_status = 'approved') AS taken
      FROM groups g WHERE g.teacher_id = ${t.id} AND g.active = 1 ORDER BY g.id`;
    t.groups = g.rows.map(x => ({ ...x, price: Number(x.price), taken: Number(x.taken) }));
    const rv = await q`SELECT r.rating, r.comment, r.created_at, s.name AS sname FROM reviews r
      JOIN students s ON s.id = r.student_id
      WHERE r.teacher_id = ${t.id} AND r.approved = 1 ORDER BY r.id DESC LIMIT 20`;
    t.reviews = rv.rows;
    return c.json({ ok: true, t }, 200, { 'Cache-Control': 'public, max-age=60' });
  });

  app.get('/api/groups', async (c) => {
    const g = await q`SELECT g.*, t.name AS teacher_name, t.subject,
      (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id AND m.status = 'active' AND m.pay_status = 'approved') AS taken
      FROM groups g JOIN teachers t ON t.id = g.teacher_id
      WHERE g.active = 1 AND t.active = 1 ORDER BY g.id DESC`;
    return c.json({
      ok: true,
      groups: g.rows.map(x => ({ ...x, price: Number(x.price), taken: Number(x.taken) }))
    }, 200, { 'Cache-Control': 'public, max-age=60' });
  });

  app.get('/api/page/:key', async (c) => {
    const k = c.req.param('key');
    const map = { terms: 'legal_terms', privacy: 'legal_privacy', teacher: 'legal_teacher', student: 'legal_student' };
    if (!map[k]) return c.json({ ok: false, error: 'صفحة غير موجودة' }, 404);
    const titles = { terms: 'شروط الاستخدام', privacy: 'سياسة الخصوصية', teacher: 'شروط انضمام المعلم وواجباته والعقوبات', student: 'واجبات الطالب وقواعد الحضور' };
    return c.json({ ok: true, title: titles[k], body: await getSetting(map[k]) }, 200, { 'Cache-Control': 'public, max-age=300' });
  });

  app.get('/img/:id', async (c) => {
    const r = await q`SELECT data, mime FROM images WHERE id = ${c.req.param('id')}`;
    if (!r.rows.length) return c.text('not found', 404);
    const bin = Uint8Array.from(atob(r.rows[0].data), ch => ch.charCodeAt(0));
    return new Response(bin, {
      headers: { 'Content-Type': r.rows[0].mime || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }
    });
  });

  // ---------- register / login ----------
  app.post('/api/register', limit('reg', 10), async (c) => {
    try {
      const b = await c.req.json().catch(() => ({}));
      const s = await getSettings(['req_student_phone', 'req_guardian_phone']);
      const name = String(b.name || '').trim();
      const phone = normalizePhone(b.phone);
      const guardian = normalizePhone(b.guardian_phone);
      const country = String(b.country || '').trim();
      const grade = String(b.grade || '').trim();
      const pw = String(b.password || '');
      if (name.length < 3) return c.json({ ok: false, error: 'اكتب الاسم بالكامل (3 حروف على الأقل)' });
      if (s.req_student_phone === '1' && phone.replace(/\D/g, '').length < 7)
        return c.json({ ok: false, error: 'اكتب رقم موبايل الطالب صح' });
      if (phone && phone.replace(/\D/g, '').length < 7)
        return c.json({ ok: false, error: 'رقم موبايل الطالب غير صحيح' });
      if (s.req_guardian_phone === '1' && guardian.replace(/\D/g, '').length < 7)
        return c.json({ ok: false, error: 'اكتب رقم موبايل ولي الأمر صح (إجباري)' });
      if (guardian && guardian.replace(/\D/g, '').length < 7)
        return c.json({ ok: false, error: 'رقم موبايل ولي الأمر غير صحيح' });
      if (!country) return c.json({ ok: false, error: 'اختار الدولة 🌍' });
      if (pw.length < 6) return c.json({ ok: false, error: 'كلمة المرور 6 حروف على الأقل 🔐' });
      if (!b.accept) return c.json({ ok: false, error: 'لازم توافق على الشروط وسياسة الخصوصية الأول ✅' });
      if (phone) {
        const dup = await q`SELECT id FROM students WHERE phone = ${phone}`;
        if (dup.rows.length) return c.json({ ok: false, error: 'الرقم ده مسجل قبل كده — سجّل الدخول بدل التسجيل' });
      }
      const hash = await hashPassword(pw, PEPPER);
      const ins = await q`INSERT INTO students(name, phone, guardian_phone, country, grade, password)
        VALUES(${name},${phone},${guardian},${country},${grade},${hash}) RETURNING id`;
      const id = ins.rows[0].id;
      await issueToken(c, 's', Number(id), hash.slice(0, 12), true);
      return c.json({ ok: true });
    } catch (e) { console.error('register', e); return c.json({ ok: false, error: 'حصل خطأ، حاول تاني' }, 500); }
  });

  app.post('/api/login', limit('login', 15), async (c) => {
    try {
      const b = await c.req.json().catch(() => ({}));
      const role = b.role === 'teacher' ? 't' : 's';
      const phone = normalizePhone(b.phone);
      const pw = String(b.password || '');
      const remember = b.remember !== false;
      const r = role === 't'
        ? await q`SELECT * FROM teachers WHERE phone = ${phone} AND active = 1`
        : await q`SELECT * FROM students WHERE phone = ${phone} AND active = 1`;
      if (!r.rows.length) return c.json({ ok: false, error: 'الرقم أو كلمة المرور غلط' });
      const u = r.rows[0];
      if (!u.password || !(await verifyPassword(pw, PEPPER, u.password)))
        return c.json({ ok: false, error: 'الرقم أو كلمة المرور غلط' });
      await issueToken(c, role, Number(u.id), String(u.password).slice(0, 12), remember);
      return c.json({ ok: true, role: role === 't' ? 'teacher' : 'student' });
    } catch (e) { console.error('login', e); return c.json({ ok: false, error: 'حصل خطأ، حاول تاني' }, 500); }
  });

  app.post('/api/admin/login', limit('alogin', 10), async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const h = await getSetting('admin_password');
    if (!h || !(await verifyPassword(String(b.password || ''), PEPPER, h)))
      return c.json({ ok: false, error: 'الباسورد غلط' });
    await issueToken(c, 'a', 0, h.slice(0, 12), true);
    return c.json({ ok: true });
  });

  app.post('/api/logout', async (c) => {
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/me', async (c) => {
    const u = await currentUser(c);
    if (!u) return c.json({ ok: false });
    return c.json({ ok: true, role: u.role, user: u });
  });

  // ---------- teacher application ----------
  app.post('/api/apply', limit('apply', 5), async (c) => {
    try {
      const b = await c.req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      const phone = normalizePhone(b.phone);
      const wa = normalizePhone(b.whatsapp || phone);
      const subject = String(b.subject || '').trim();
      const bio = String(b.bio || '').trim();
      if (name.length < 3) return c.json({ ok: false, error: 'اكتب الاسم بالكامل' });
      if (phone.replace(/\D/g, '').length < 7) return c.json({ ok: false, error: 'اكتب رقم موبايل صحيح' });
      if (!subject) return c.json({ ok: false, error: 'اختار المادة' });
      if (bio.length < 20) return c.json({ ok: false, error: 'اكتب نبذة عن خبرتك (20 حرف على الأقل)' });
      if (!b.accept) return c.json({ ok: false, error: 'لازم توافق على شروط انضمام المعلم الأول ✅' });
      const dup = await q`SELECT id FROM teacher_apps WHERE phone = ${phone} AND status = 'pending'`;
      if (dup.rows.length) return c.json({ ok: false, error: 'طلبك موجود بالفعل وبيتراجع — هنكلمك قريب 🙏' });
      await q`INSERT INTO teacher_apps(name, phone, whatsapp, subject, bio, price_private, price_group)
        VALUES(${name},${phone},${wa},${subject},${bio},${Number(b.price_private) || 0},${Number(b.price_group) || 0})`;
      return c.json({ ok: true });
    } catch (e) { console.error('apply', e); return c.json({ ok: false, error: 'حصل خطأ، حاول تاني' }, 500); }
  });

  // ============================================================
  // STUDENT
  // ============================================================
  app.post('/api/book', need('student'), limit('book', 10), async (c) => {
    try {
      const u = c.get('u');
      const b = await c.req.json().catch(() => ({}));
      const s = await getSettings(['enable_private', 'enable_groups', 'commission_default', 'pay_methods']);
      const methods = parseJSON(s.pay_methods, []).map(m => m.name);
      const kind = b.kind === 'group' ? 'group' : 'private';
      const payMethod = String(b.pay_method || '').trim();
      const payProof = String(b.pay_proof || '').trim();
      if (!methods.includes(payMethod)) return c.json({ ok: false, error: 'اختار طريقة الدفع' });
      if (payProof.length < 3) return c.json({ ok: false, error: 'اكتب إثبات التحويل (رقم التليفون المحوِّل أو رقم العملية)' });

      if (kind === 'private') {
        if (s.enable_private !== '1') return c.json({ ok: false, error: 'حجز البرايفت متوقف حاليًا' });
        const t = await q`SELECT * FROM teachers WHERE id = ${b.teacher_id} AND active = 1`;
        if (!t.rows.length) return c.json({ ok: false, error: 'المعلم غير متاح' });
        const teacher = t.rows[0];
        const price = Number(teacher.price_private) || 0;
        if (price <= 0) return c.json({ ok: false, error: 'المعلم مش محدد سعر للبرايفت حاليًا' });
        const slot = String(b.slot || '').trim();
        if (slot.length < 3) return c.json({ ok: false, error: 'اكتب المعاد المناسب ليك (مثال: السبت 5 مساءً)' });
        const pct = Number(teacher.commission) >= 0 ? Number(teacher.commission) : (Number(s.commission_default) || 0);
        const teacherAmt = Math.round(price * (1 - pct / 100) * 100) / 100;
        const ins = await q`INSERT INTO bookings(student_id, teacher_id, kind, slot, price, commission_pct, teacher_amt,
            pay_method, pay_proof, meet_link, student_note)
          VALUES(${u.id},${teacher.id},'private',${slot},${price},${pct},${teacherAmt},
            ${payMethod},${payProof},${teacher.meet_link || ''},${String(b.note || '').trim()}) RETURNING id`;
        const id = Number(ins.rows[0].id);
        const code = 'BK-' + (1000 + id);
        await q`UPDATE bookings SET code = ${code} WHERE id = ${id}`;
        return c.json({ ok: true, code });
      }

      // group join
      if (s.enable_groups !== '1') return c.json({ ok: false, error: 'الانضمام للمجموعات متوقف حاليًا' });
      const g = await q`SELECT g.*, t.price_private AS tp, t.commission AS tcomm, t.meet_link AS tmeet, t.active AS tact
        FROM groups g JOIN teachers t ON t.id = g.teacher_id WHERE g.id = ${b.group_id} AND g.active = 1`;
      if (!g.rows.length || Number(g.rows[0].tact) !== 1) return c.json({ ok: false, error: 'المجموعة غير متاحة' });
      const gr = g.rows[0];
      const ex = await q`SELECT id FROM group_members WHERE group_id = ${gr.id} AND student_id = ${u.id} AND status = 'active'`;
      if (ex.rows.length) return c.json({ ok: false, error: 'إنت مشترك في المجموعة دي بالفعل ✅' });
      const cnt = await q`SELECT COUNT(*) c FROM group_members WHERE group_id = ${gr.id} AND status = 'active' AND pay_status = 'approved'`;
      if (Number(cnt.rows[0].c) >= Number(gr.max_seats)) return c.json({ ok: false, error: 'المجموعة اكتملت 😔 — اختار مجموعة تانية' });
      const price = Number(gr.price) || 0;
      const pct = Number(gr.tcomm) >= 0 ? Number(gr.tcomm) : (Number(s.commission_default) || 0);
      const teacherAmt = Math.round(price * (1 - pct / 100) * 100) / 100;
      const ins = await q`INSERT INTO bookings(student_id, teacher_id, kind, group_id, slot, price, commission_pct, teacher_amt,
          pay_method, pay_proof, meet_link, student_note)
        VALUES(${u.id},${gr.teacher_id},'group',${gr.id},${gr.schedule_text || ''},${price},${pct},${teacherAmt},
          ${payMethod},${payProof},${gr.meet_link || gr.tmeet || ''},${String(b.note || '').trim()}) RETURNING id`;
      const id = Number(ins.rows[0].id);
      const code = 'BK-' + (1000 + id);
      await q`UPDATE bookings SET code = ${code} WHERE id = ${id}`;
      await q`INSERT INTO group_members(group_id, student_id, pay_method, pay_proof)
        VALUES(${gr.id},${u.id},${payMethod},${payProof})
        ON CONFLICT(group_id, student_id) DO UPDATE SET pay_method = ${payMethod}, pay_proof = ${payProof}, pay_status = 'pending', status = 'active'`;
      return c.json({ ok: true, code });
    } catch (e) { console.error('book', e); return c.json({ ok: false, error: 'حصل خطأ، حاول تاني' }, 500); }
  });

  app.get('/api/s/bookings', need('student'), async (c) => {
    const u = c.get('u');
    const r = await q`SELECT b.*, t.name AS teacher_name, t.subject, t.whatsapp AS teacher_wa, g.title AS group_title
      FROM bookings b JOIN teachers t ON t.id = b.teacher_id
      LEFT JOIN groups g ON g.id = b.group_id
      WHERE b.student_id = ${u.id} ORDER BY b.id DESC`;
    return c.json({
      ok: true,
      bookings: r.rows.map(b => ({
        ...b, price: Number(b.price),
        teacher_wa: b.pay_status === 'approved' ? b.teacher_wa : '',
        meet_link: b.pay_status === 'approved' ? b.meet_link : ''
      }))
    });
  });

  app.post('/api/s/cancel', need('student'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT * FROM bookings WHERE id = ${b.id} AND student_id = ${u.id}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'الحجز غير موجود' });
    const bk = r.rows[0];
    if (bk.status !== 'scheduled') return c.json({ ok: false, error: 'الحجز ده مينفعش يتلغي' });
    await q`UPDATE bookings SET status = 'cancelled' WHERE id = ${bk.id}`;
    if (bk.kind === 'group' && bk.group_id)
      await q`UPDATE group_members SET status = 'left' WHERE group_id = ${bk.group_id} AND student_id = ${u.id}`;
    const ch = Number(await getSetting('cancel_hours')) || 12;
    return c.json({ ok: true, msg: `تم الإلغاء — لو قبل المعاد بـ ${ch} ساعة تستحق استردادًا كاملًا، والإدارة هتراجع طلبك 🙏` });
  });

  app.put('/api/s/profile', need('student'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const s = await getSettings(['req_student_phone', 'req_guardian_phone']);
    const name = String(b.name || '').trim();
    const phone = normalizePhone(b.phone);
    const guardian = normalizePhone(b.guardian_phone);
    if (name.length < 3) return c.json({ ok: false, error: 'الاسم 3 حروف على الأقل' });
    if (s.req_student_phone === '1' && phone.replace(/\D/g, '').length < 7)
      return c.json({ ok: false, error: 'رقم الطالب إجباري' });
    if (s.req_guardian_phone === '1' && guardian.replace(/\D/g, '').length < 7)
      return c.json({ ok: false, error: 'رقم ولي الأمر إجباري' });
    if (phone && phone !== u.phone) {
      const dup = await q`SELECT id FROM students WHERE phone = ${phone}`;
      if (dup.rows.length) return c.json({ ok: false, error: 'الرقم ده مسجل لحساب تاني' });
    }
    await q`UPDATE students SET name = ${name}, phone = ${phone}, guardian_phone = ${guardian},
      country = ${String(b.country || '').trim()}, grade = ${String(b.grade || '').trim()} WHERE id = ${u.id}`;
    return c.json({ ok: true });
  });

  app.put('/api/s/password', need('student'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT password FROM students WHERE id = ${u.id}`;
    if (!(await verifyPassword(String(b.old || ''), PEPPER, r.rows[0].password)))
      return c.json({ ok: false, error: 'كلمة المرور الحالية غلط' });
    if (String(b.next || '').length < 6) return c.json({ ok: false, error: 'الجديدة 6 حروف على الأقل' });
    const h = await hashPassword(String(b.next), PEPPER);
    await q`UPDATE students SET password = ${h} WHERE id = ${u.id}`;
    await issueToken(c, 's', u.id, h.slice(0, 12), true);
    return c.json({ ok: true });
  });

  app.post('/api/s/review', need('student'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT * FROM bookings WHERE id = ${b.booking_id} AND student_id = ${u.id}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'الحجز غير موجود' });
    const bk = r.rows[0];
    if (bk.status !== 'done' || bk.pay_status !== 'approved')
      return c.json({ ok: false, error: 'التقييم متاح بعد إتمام حصة مدفوعة فقط' });
    const ex = await q`SELECT id FROM reviews WHERE booking_id = ${bk.id}`;
    if (ex.rows.length) return c.json({ ok: false, error: 'قيّمت الحصة دي قبل كده 🙏' });
    const rating = Math.max(1, Math.min(5, parseInt(b.rating) || 5));
    await q`INSERT INTO reviews(teacher_id, student_id, booking_id, rating, comment)
      VALUES(${bk.teacher_id},${u.id},${bk.id},${rating},${String(b.comment || '').trim().slice(0, 500)})`;
    return c.json({ ok: true, msg: 'شكرًا! تقييمك هيتراجع ويظهر قريب ⭐' });
  });

  // ============================================================
  // TEACHER
  // ============================================================
  app.get('/api/t/bookings', need('teacher'), async (c) => {
    const u = c.get('u');
    const r = await q`SELECT b.*, s.name AS student_name, s.phone AS student_phone,
        s.guardian_phone, s.country, g.title AS group_title
      FROM bookings b JOIN students s ON s.id = b.student_id
      LEFT JOIN groups g ON g.id = b.group_id
      WHERE b.teacher_id = ${u.id} ORDER BY b.id DESC LIMIT 200`;
    return c.json({ ok: true, bookings: r.rows.map(b => ({ ...b, price: Number(b.price), teacher_amt: Number(b.teacher_amt) })) });
  });

  app.post('/api/t/booking-status', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const allow = ['done', 'cancelled', 'missed_student'];
    if (!allow.includes(b.status)) return c.json({ ok: false, error: 'حالة غير صالحة' });
    const r = await q`SELECT * FROM bookings WHERE id = ${b.id} AND teacher_id = ${u.id}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'الحجز غير موجود' });
    if (r.rows[0].status !== 'scheduled') return c.json({ ok: false, error: 'الحجز ده اتقفل خلاص' });
    await q`UPDATE bookings SET status = ${b.status} WHERE id = ${b.id}`;
    return c.json({ ok: true });
  });

  app.put('/api/t/profile', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    await q`UPDATE teachers SET bio = ${String(b.bio || '').trim().slice(0, 1000)},
      price_private = ${Math.max(0, Number(b.price_private) || 0)},
      price_group = ${Math.max(0, Number(b.price_group) || 0)},
      meet_link = ${String(b.meet_link || '').trim().slice(0, 300)},
      schedule_text = ${String(b.schedule_text || '').trim().slice(0, 500)},
      whatsapp = ${normalizePhone(b.whatsapp)}, video_url = ${String(b.video_url || '').trim().slice(0, 300)}
      WHERE id = ${u.id}`;
    return c.json({ ok: true });
  });

  app.put('/api/t/password', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT password FROM teachers WHERE id = ${u.id}`;
    if (!(await verifyPassword(String(b.old || ''), PEPPER, r.rows[0].password || '')))
      return c.json({ ok: false, error: 'كلمة المرور الحالية غلط' });
    if (String(b.next || '').length < 6) return c.json({ ok: false, error: 'الجديدة 6 حروف على الأقل' });
    const h = await hashPassword(String(b.next), PEPPER);
    await q`UPDATE teachers SET password = ${h} WHERE id = ${u.id}`;
    await issueToken(c, 't', u.id, h.slice(0, 12), true);
    return c.json({ ok: true });
  });

  app.get('/api/t/groups', need('teacher'), async (c) => {
    const u = c.get('u');
    const g = await q`SELECT g.*, (SELECT COUNT(*) FROM group_members m
        WHERE m.group_id = g.id AND m.status = 'active') AS members
      FROM groups g WHERE g.teacher_id = ${u.id} ORDER BY g.id DESC`;
    return c.json({ ok: true, groups: g.rows.map(x => ({ ...x, price: Number(x.price) })) });
  });

  app.post('/api/t/groups', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    if ((await getSetting('enable_groups')) !== '1')
      return c.json({ ok: false, error: 'المجموعات متوقفة من الإدارة حاليًا' });
    const title = String(b.title || '').trim();
    if (title.length < 3) return c.json({ ok: false, error: 'اكتب اسم المجموعة' });
    await q`INSERT INTO groups(teacher_id, title, subject, grade, price, max_seats, schedule_text, meet_link)
      VALUES(${u.id},${title},${u.subject},${String(b.grade || '').trim().slice(0, 50)},
        ${Math.max(0, Number(b.price) || 0)},${Math.max(2, Math.min(50, parseInt(b.max_seats) || 8))},
        ${String(b.schedule_text || '').trim().slice(0, 300)},${String(b.meet_link || u.meet_link || '').trim().slice(0, 300)})`;
    return c.json({ ok: true });
  });

  app.put('/api/t/groups/:id', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT id FROM groups WHERE id = ${c.req.param('id')} AND teacher_id = ${u.id}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'المجموعة غير موجودة' });
    await q`UPDATE groups SET title = ${String(b.title || '').trim().slice(0, 120)},
      grade = ${String(b.grade || '').trim().slice(0, 50)},
      price = ${Math.max(0, Number(b.price) || 0)},
      max_seats = ${Math.max(2, Math.min(50, parseInt(b.max_seats) || 8))},
      schedule_text = ${String(b.schedule_text || '').trim().slice(0, 300)},
      meet_link = ${String(b.meet_link || '').trim().slice(0, 300)},
      active = ${b.active ? 1 : 0} WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.get('/api/t/group-members/:id', need('teacher'), async (c) => {
    const u = c.get('u');
    const g = await q`SELECT id FROM groups WHERE id = ${c.req.param('id')} AND teacher_id = ${u.id}`;
    if (!g.rows.length) return c.json({ ok: false, error: 'المجموعة غير موجودة' });
    const r = await q`SELECT m.*, s.name, s.phone, s.guardian_phone FROM group_members m
      JOIN students s ON s.id = m.student_id WHERE m.group_id = ${c.req.param('id')} ORDER BY m.id`;
    return c.json({ ok: true, members: r.rows });
  });

  async function teacherEarnings(tid) {
    const e = await q`SELECT COALESCE(SUM(teacher_amt),0) s FROM bookings
      WHERE teacher_id = ${tid} AND pay_status = 'approved' AND status IN ('scheduled','done')`;
    const w = await q`SELECT COALESCE(SUM(amount),0) s FROM withdrawals
      WHERE teacher_id = ${tid} AND status IN ('pending','paid')`;
    const d = await q`SELECT COALESCE(SUM(teacher_amt),0) s FROM bookings
      WHERE teacher_id = ${tid} AND pay_status = 'approved' AND status = 'done'`;
    const earned = Number(e.rows[0].s) || 0, reserved = Number(w.rows[0].s) || 0, doneSum = Number(d.rows[0].s) || 0;
    return { earned, withdrawable: Math.max(0, Math.round((doneSum - reserved) * 100) / 100), reserved };
  }

  app.get('/api/t/earnings', need('teacher'), async (c) => {
    const u = c.get('u');
    const e = await teacherEarnings(u.id);
    const wmin = Number(await getSetting('withdraw_min')) || 0;
    const wc = await getSetting('withdraw_cycle');
    const wd = await q`SELECT * FROM withdrawals WHERE teacher_id = ${u.id} ORDER BY id DESC LIMIT 20`;
    return c.json({ ok: true, ...e, withdraw_min: wmin, withdraw_cycle: wc, withdrawals: wd.rows.map(x => ({ ...x, amount: Number(x.amount) })) });
  });

  app.post('/api/t/withdraw', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const e = await teacherEarnings(u.id);
    const wmin = Number(await getSetting('withdraw_min')) || 0;
    const amt = Math.round((Number(b.amount) || 0) * 100) / 100;
    if (amt < wmin) return c.json({ ok: false, error: `الحد الأدنى للسحب ${wmin}` });
    if (amt > e.withdrawable + 0.001) return c.json({ ok: false, error: 'المبلغ أكبر من المتاح للسحب' });
    if (String(b.account || '').trim().length < 3) return c.json({ ok: false, error: 'اكتب بيانات الاستلام (رقم المحفظة/الحساب)' });
    await q`INSERT INTO withdrawals(teacher_id, amount, method, account)
      VALUES(${u.id},${amt},${String(b.method || '').trim().slice(0, 60)},${String(b.account || '').trim().slice(0, 120)})`;
    return c.json({ ok: true, msg: 'طلبك اتسجل وهيتحوّل في دورة الصرف 🙏' });
  });

  // ============================================================
  // IMAGES (teacher avatars — compressed client-side)
  // ============================================================
  async function saveImage(c, b64, mime) {
    const s = String(b64 || '');
    if (!s || s.length > 400000) return { err: 'الصورة كبيرة — اختار صورة أصغر' };
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { err: 'صيغة غير مدعومة' };
    const ins = await q`INSERT INTO images(data, mime) VALUES(${s},${mime}) RETURNING id`;
    return { id: Number(ins.rows[0].id) };
  }
  app.post('/api/t/image', need('teacher'), async (c) => {
    const u = c.get('u');
    const b = await c.req.json().catch(() => ({}));
    const r = await saveImage(c, b.data, b.mime);
    if (r.err) return c.json({ ok: false, error: r.err });
    await q`UPDATE teachers SET img_id = ${r.id} WHERE id = ${u.id}`;
    return c.json({ ok: true, img_id: r.id });
  });
  app.post('/api/admin/image', need('admin'), async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const r = await saveImage(c, b.data, b.mime);
    if (r.err) return c.json({ ok: false, error: r.err });
    return c.json({ ok: true, img_id: r.id });
  });

  // ============================================================
  // ADMIN
  // ============================================================
  const needA = need('admin');

  app.get('/api/admin/stats', needA, async (c) => {
    const [dayStart] = cairoDayRange();
    const one = async (strings, ...v) => Number((await q(strings, ...v)).rows[0].c) || 0;
    const sum = async (strings, ...v) => Number((await q(strings, ...v)).rows[0].s) || 0;
    const students = await one`SELECT COUNT(*) c FROM students`;
    const teachers = await one`SELECT COUNT(*) c FROM teachers WHERE active = 1`;
    const bookings = await one`SELECT COUNT(*) c FROM bookings`;
    const newPay = await one`SELECT COUNT(*) c FROM bookings WHERE pay_status = 'pending'`;
    const apps = await one`SELECT COUNT(*) c FROM teacher_apps WHERE status = 'pending'`;
    const wds = await one`SELECT COUNT(*) c FROM withdrawals WHERE status = 'pending'`;
    const revs = await one`SELECT COUNT(*) c FROM reviews WHERE approved = 0`;
    const revenue = await sum`SELECT COALESCE(SUM(price),0) s FROM bookings WHERE pay_status = 'approved' AND status != 'cancelled'`;
    const commission = await sum`SELECT COALESCE(SUM(price - teacher_amt),0) s FROM bookings WHERE pay_status = 'approved' AND status != 'cancelled'`;
    const today = await one`SELECT COUNT(*) c FROM bookings WHERE created_at >= ${dayStart}`;
    return c.json({
      ok: true, students, teachers, bookings, total: bookings, revenue, commission,
      today, pendingPay: newPay, pendingApps: apps, pendingWd: wds, pendingRev: revs,
      payAr: PAY_AR, bookAr: BOOK_AR, kindAr: KIND_AR, wdAr: WD_AR
    });
  });

  const PAGE = 20;
  app.get('/api/admin/bookings', needA, async (c) => {
    const page = Math.max(1, parseInt(c.req.query('page')) || 1);
    const pay = (c.req.query('pay') || '').trim();
    const st = (c.req.query('st') || '').trim();
    let rows = (await q`SELECT b.*, s.name AS student_name, s.phone AS student_phone, s.guardian_phone,
        t.name AS teacher_name, t.subject, g.title AS group_title
      FROM bookings b JOIN students s ON s.id = b.student_id
      JOIN teachers t ON t.id = b.teacher_id
      LEFT JOIN groups g ON g.id = b.group_id ORDER BY b.id DESC`).rows;
    if (pay) rows = rows.filter(r => r.pay_status === pay);
    if (st) rows = rows.filter(r => r.status === st);
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    const pg = Math.min(page, pages);
    return c.json({
      ok: true, page: pg, pages, total: rows.length,
      bookings: rows.slice((pg - 1) * PAGE, pg * PAGE).map(b => ({ ...b, price: Number(b.price), teacher_amt: Number(b.teacher_amt) }))
    });
  });

  app.post('/api/admin/booking-pay', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (!['approved', 'rejected'].includes(b.pay)) return c.json({ ok: false, error: 'قيمة غير صالحة' });
    const r = await q`SELECT * FROM bookings WHERE id = ${b.id}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'غير موجود' });
    const bk = r.rows[0];
    await q`UPDATE bookings SET pay_status = ${b.pay} WHERE id = ${bk.id}`;
    if (bk.kind === 'group' && bk.group_id)
      await q`UPDATE group_members SET pay_status = ${b.pay} WHERE group_id = ${bk.group_id} AND student_id = ${bk.student_id}`;
    return c.json({ ok: true });
  });

  app.post('/api/admin/booking-status', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const allow = ['scheduled', 'done', 'cancelled', 'missed_teacher', 'missed_student'];
    if (!allow.includes(b.status)) return c.json({ ok: false, error: 'حالة غير صالحة' });
    await q`UPDATE bookings SET status = ${b.status} WHERE id = ${b.id}`;
    return c.json({ ok: true });
  });

  app.put('/api/admin/booking-meet', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    await q`UPDATE bookings SET meet_link = ${String(b.meet_link || '').trim().slice(0, 300)} WHERE id = ${b.id}`;
    return c.json({ ok: true });
  });

  app.get('/api/admin/export-bookings', needA, async (c) => {
    const r = await q`SELECT b.code, b.created_at, s.name AS student, s.phone, s.guardian_phone, s.country,
        t.name AS teacher, t.subject, b.kind, b.slot, b.price, b.teacher_amt, b.pay_method, b.pay_status, b.status
      FROM bookings b JOIN students s ON s.id = b.student_id
      JOIN teachers t ON t.id = b.teacher_id ORDER BY b.id DESC`;
    const qe = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const head = ['الكود', 'التاريخ', 'الطالب', 'موبايل الطالب', 'ولي الأمر', 'الدولة', 'المعلم', 'المادة', 'النوع', 'المعاد', 'السعر', 'مستحق المعلم', 'الدفع', 'حالة الدفع', 'الحالة'];
    const rows = r.rows.map(x => [x.code, String(x.created_at || '').slice(0, 16).replace('T', ' '),
      x.student, x.phone, x.guardian_phone, x.country, x.teacher, x.subject,
      KIND_AR[x.kind] || x.kind, x.slot, x.price, x.teacher_amt, x.pay_method,
      PAY_AR[x.pay_status] || x.pay_status, BOOK_AR[x.status] || x.status].map(qe).join(','));
    return new Response('﻿' + head.map(qe).join(',') + '\n' + rows.join('\n'), {
      headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename=taleem-bookings.csv' }
    });
  });

  // ---- teachers / apps / students ----
  app.get('/api/admin/teachers', needA, async (c) => {
    const r = await q`SELECT * FROM teachers ORDER BY id`;
    return c.json({ ok: true, teachers: r.rows.map(t => ({ ...t, password: undefined })) });
  });
  app.put('/api/admin/teachers/:id', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    await q`UPDATE teachers SET name = ${String(b.name || '').trim().slice(0, 80)},
      phone = ${normalizePhone(b.phone)}, whatsapp = ${normalizePhone(b.whatsapp)},
      subject = ${String(b.subject || '').trim().slice(0, 60)}, bio = ${String(b.bio || '').trim().slice(0, 1000)},
      price_private = ${Math.max(0, Number(b.price_private) || 0)},
      price_group = ${Math.max(0, Number(b.price_group) || 0)},
      meet_link = ${String(b.meet_link || '').trim().slice(0, 300)},
      schedule_text = ${String(b.schedule_text || '').trim().slice(0, 500)},
      video_url = ${String(b.video_url || '').trim().slice(0, 300)},
      commission = ${b.commission === '' || b.commission === null || b.commission === undefined ? -1 : Math.max(0, Math.min(100, Number(b.commission)))},
      active = ${b.active ? 1 : 0}, featured = ${b.featured ? 1 : 0},
      img_id = ${parseInt(b.img_id) || 0} WHERE id = ${c.req.param('id')}`;
    if (b.new_password && String(b.new_password).length >= 6) {
      const h = await hashPassword(String(b.new_password), PEPPER);
      await q`UPDATE teachers SET password = ${h} WHERE id = ${c.req.param('id')}`;
    }
    return c.json({ ok: true });
  });
  app.delete('/api/admin/teachers/:id', needA, async (c) => {
    const n = await q`SELECT COUNT(*) c FROM bookings WHERE teacher_id = ${c.req.param('id')}`;
    if (Number(n.rows[0].c)) return c.json({ ok: false, error: 'المعلم عنده حجوزات — اعمله إيقاف بدل الحذف' });
    await q`DELETE FROM teachers WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.get('/api/admin/apps', needA, async (c) => {
    const r = await q`SELECT * FROM teacher_apps ORDER BY id DESC`;
    return c.json({ ok: true, apps: r.rows });
  });
  app.post('/api/admin/apps/:id', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT * FROM teacher_apps WHERE id = ${c.req.param('id')}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'غير موجود' });
    const a = r.rows[0];
    if (b.act === 'reject') {
      await q`UPDATE teacher_apps SET status = 'rejected' WHERE id = ${a.id}`;
      return c.json({ ok: true });
    }
    if (b.act === 'approve') {
      const dup = await q`SELECT id FROM teachers WHERE phone = ${a.phone}`;
      if (dup.rows.length) return c.json({ ok: false, error: 'الرقم ده مسجل كمعلم بالفعل' });
      const temp = Math.random().toString(36).slice(2, 10);
      const h = await hashPassword(temp, PEPPER);
      await q`INSERT INTO teachers(name, phone, whatsapp, subject, bio, price_private, price_group, password, active)
        VALUES(${a.name},${a.phone},${a.whatsapp},${a.subject},${a.bio},
          ${Number(a.price_private) || 0},${Number(a.price_group) || 0},${h},1)`;
      await q`UPDATE teacher_apps SET status = 'approved' WHERE id = ${a.id}`;
      return c.json({ ok: true, temp_password: temp });
    }
    return c.json({ ok: false, error: 'أمر غير معروف' });
  });

  app.get('/api/admin/students', needA, async (c) => {
    const search = (c.req.query('q') || '').trim();
    let r = (await q`SELECT id, name, phone, guardian_phone, country, grade, active, created_at,
      (SELECT COUNT(*) FROM bookings b WHERE b.student_id = students.id) AS bookings
      FROM students ORDER BY id DESC LIMIT 300`).rows;
    if (search) r = r.filter(x => (x.name + x.phone + x.guardian_phone).includes(search));
    return c.json({ ok: true, students: r });
  });
  app.post('/api/admin/students/:id', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (b.act === 'toggle') {
      await q`UPDATE students SET active = 1 - active WHERE id = ${c.req.param('id')}`;
      return c.json({ ok: true });
    }
    if (b.act === 'delete') {
      const n = await q`SELECT COUNT(*) c FROM bookings WHERE student_id = ${c.req.param('id')}`;
      if (Number(n.rows[0].c)) return c.json({ ok: false, error: 'الطالب عنده حجوزات — اعمله إيقاف بدل الحذف' });
      await q`DELETE FROM students WHERE id = ${c.req.param('id')}`;
      return c.json({ ok: true });
    }
    return c.json({ ok: false, error: 'أمر غير معروف' });
  });

  // ---- groups / withdrawals / reviews ----
  app.get('/api/admin/groups', needA, async (c) => {
    const r = await q`SELECT g.*, t.name AS teacher_name, (SELECT COUNT(*) FROM group_members m
        WHERE m.group_id = g.id AND m.status = 'active') AS members
      FROM groups g JOIN teachers t ON t.id = g.teacher_id ORDER BY g.id DESC`;
    return c.json({ ok: true, groups: r.rows });
  });
  app.post('/api/admin/groups/:id', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (b.act === 'toggle') {
      await q`UPDATE groups SET active = 1 - active WHERE id = ${c.req.param('id')}`;
      return c.json({ ok: true });
    }
    if (b.act === 'delete') {
      const n = await q`SELECT COUNT(*) c FROM group_members WHERE group_id = ${c.req.param('id')}`;
      if (Number(n.rows[0].c)) return c.json({ ok: false, error: 'المجموعة فيها أعضاء — اعملها إيقاف بدل الحذف' });
      await q`DELETE FROM groups WHERE id = ${c.req.param('id')}`;
      return c.json({ ok: true });
    }
    return c.json({ ok: false, error: 'أمر غير معروف' });
  });

  app.get('/api/admin/withdrawals', needA, async (c) => {
    const r = await q`SELECT w.*, t.name AS teacher_name, t.phone AS teacher_phone
      FROM withdrawals w JOIN teachers t ON t.id = w.teacher_id ORDER BY w.id DESC`;
    return c.json({ ok: true, withdrawals: r.rows.map(x => ({ ...x, amount: Number(x.amount) })) });
  });
  app.post('/api/admin/withdrawals/:id', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (!['paid', 'rejected'].includes(b.act)) return c.json({ ok: false, error: 'أمر غير معروف' });
    await q`UPDATE withdrawals SET status = ${b.act} WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.get('/api/admin/reviews', needA, async (c) => {
    const r = await q`SELECT r.*, t.name AS teacher_name, s.name AS student_name
      FROM reviews r JOIN teachers t ON t.id = r.teacher_id JOIN students s ON s.id = r.student_id
      ORDER BY r.id DESC LIMIT 200`;
    return c.json({ ok: true, reviews: r.rows });
  });
  app.post('/api/admin/reviews/:id', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const r = await q`SELECT * FROM reviews WHERE id = ${c.req.param('id')}`;
    if (!r.rows.length) return c.json({ ok: false, error: 'غير موجود' });
    if (b.act === 'delete') {
      await q`DELETE FROM reviews WHERE id = ${r.rows[0].id}`;
    } else if (['approve', 'hide'].includes(b.act)) {
      await q`UPDATE reviews SET approved = ${b.act === 'approve' ? 1 : 0} WHERE id = ${r.rows[0].id}`;
    } else return c.json({ ok: false, error: 'أمر غير معروف' });
    const tid = r.rows[0].teacher_id;
    const agg = await q`SELECT COUNT(*) c, COALESCE(AVG(rating),0) a FROM reviews WHERE teacher_id = ${tid} AND approved = 1`;
    await q`UPDATE teachers SET rating = ${Math.round(Number(agg.rows[0].a) * 10) / 10}, ratings_count = ${Number(agg.rows[0].c)} WHERE id = ${tid}`;
    return c.json({ ok: true });
  });

  // ---- settings ----
  const ADMIN_KEYS = ['academy_name', 'tagline', 'currency', 'commission_default', 'pay_methods',
    'enable_private', 'enable_groups', 'req_student_phone', 'req_guardian_phone',
    'subjects', 'grades', 'admin_whatsapp', 'announcement', 'withdraw_min', 'withdraw_cycle',
    'cancel_hours', 'meet_guide', 'legal_terms', 'legal_privacy', 'legal_teacher', 'legal_student'];
  app.get('/api/admin/settings', needA, async (c) => {
    return c.json({ ok: true, settings: await getSettings(ADMIN_KEYS) });
  });
  app.put('/api/admin/settings', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    for (const k of ADMIN_KEYS) {
      if (b[k] === undefined) continue;
      let v = b[k];
      if (k === 'pay_methods') {
        const arr = Array.isArray(v) ? v.slice(0, 10) : [];
        v = JSON.stringify(arr.map(m => ({
          name: String(m.name || '').slice(0, 40),
          account: String(m.account || '').slice(0, 120),
          note: String(m.note || '').slice(0, 300)
        })).filter(m => m.name));
      }
      if (k === 'subjects' || k === 'grades') {
        const arr = Array.isArray(v) ? v : String(v).split('\n');
        v = JSON.stringify(arr.map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 40));
      }
      if (['enable_private', 'enable_groups', 'req_student_phone', 'req_guardian_phone'].includes(k))
        v = v === '1' || v === 1 || v === true ? '1' : '0';
      if (k === 'commission_default') v = String(Math.max(0, Math.min(90, Number(v) || 0)));
      await setSetting(k, typeof v === 'string' ? v : String(v));
    }
    return c.json({ ok: true });
  });
  app.post('/api/admin/password', needA, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const h = await getSetting('admin_password');
    if (!(await verifyPassword(String(b.old || ''), PEPPER, h)))
      return c.json({ ok: false, error: 'الحالية غلط' });
    if (String(b.next || '').length < 6) return c.json({ ok: false, error: 'الجديدة 6 حروف على الأقل' });
    const nh = await hashPassword(String(b.next), PEPPER);
    await setSetting('admin_password', nh);
    await issueToken(c, 'a', 0, nh.slice(0, 12), true);
    return c.json({ ok: true });
  });

  // robots + sitemap
  app.get('/robots.txt', async (c) => {
    const host = new URL(c.req.url).origin;
    return c.text(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin.html\nDisallow: /student.html\nDisallow: /tutor.html\n\nSitemap: ${host}/sitemap.xml\n`);
  });
  app.get('/sitemap.xml', async (c) => {
    const host = new URL(c.req.url).origin;
    const d = new Date().toISOString().slice(0, 10);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${host}/</loc>\n    <lastmod>${d}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
  });

  return { app };
}
