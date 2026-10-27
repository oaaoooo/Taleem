// site.js — home + teacher profile + booking modal
const isTeacherPage = location.pathname.includes('teacher.html');

function teacherCard(t) {
  const cur = esc(S.currency || '');
  return `<div class="tcard">
    ${t.featured ? '<span class="feat">⭐ مميز</span>' : ''}
    <img src="${imgSrc(t.img_id)}" alt="" loading="lazy">
    <h3>${esc(t.name)}</h3>
    <div class="subj">${esc(t.subject)}</div>
    ${starsHtml(t.rating, t.ratings_count)}
    <div class="bio">${esc((t.bio || '').slice(0, 90))}</div>
    <div class="pr">${S.enable_private === '1' && t.price_private ? `👤 برايفت: <b>${t.price_private} ${cur}</b>` : ''}</div>
    <div class="pr">${S.enable_groups === '1' && t.price_group ? `👥 مجموعة: <b>${t.price_group} ${cur}</b>` : ''}</div>
    <a class="btn btn-p btn-big" href="/teacher.html?id=${t.id}">عرض واحجز 📅</a>
  </div>`;
}

function groupCard(g) {
  const left = Math.max(0, g.max_seats - g.taken);
  const pct = g.max_seats ? Math.round((g.taken / g.max_seats) * 100) : 0;
  return `<div class="tcard">
    <h3>👥 ${esc(g.title)}</h3>
    <div class="subj">${esc(g.teacher_name)} — ${esc(g.subject)}</div>
    <div class="pr">📅 ${esc(g.schedule_text || '—')}</div>
    <div class="pr">💰 <b>${g.price} ${esc(S.currency || '')}</b> للطالب</div>
    <div class="pr">${left > 0 ? `متبقي <b>${left}</b> مقاعد` : '<b style="color:#dc2626">اكتملت</b>'}</div>
    <div class="seatbar"><i style="width:${pct}%"></i></div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <a class="btn btn-g" style="flex:1" href="/teacher.html?id=${g.teacher_id}">المعلم</a>
      ${left > 0 ? `<button class="btn btn-p" style="flex:1" onclick='openBook({kind:"group",groupId:${g.id},teacherId:${g.teacher_id},title:${JSON.stringify(g.title)},price:${g.price}})'>اشترك ✅</button>` : ''}
    </div>
  </div>`;
}

async function renderHome(main) {
  const [tj, gj] = await Promise.all([api('/api/teachers'), api('/api/groups')]);
  const teachers = tj.ok ? tj.teachers : [];
  const groups = gj.ok ? gj.groups : [];
  const subjects = S.subjects || [];
  main.innerHTML = `
    <div class="hero">
      <h1>🎓 ${esc(S.academy_name)}</h1>
      <p>${esc(S.tagline || '')}</p>
      <div style="display:flex;gap:8px;max-width:440px;margin:0 auto;flex-wrap:wrap">
        <select id="fSubject" style="flex:1;min-width:140px">
          <option value="">كل المواد 📚</option>
          ${subjects.map(s => `<option>${esc(s)}</option>`).join('')}
        </select>
        <button class="btn btn-a" id="fGo">دوّر 🔍</button>
      </div>
    </div>
    <div class="steps" style="margin-bottom:14px">
      <div class="step"><span class="n">1️⃣</span>اختار المعلم المناسب</div>
      <div class="step"><span class="n">2️⃣</span>احجز برايفت أو مجموعة</div>
      <div class="step"><span class="n">3️⃣</span>ادفع بأي طريقة تناسبك</div>
      <div class="step"><span class="n">4️⃣</span>ادخل الحصة لايف 🎥</div>
    </div>
    <div class="card" id="teachers"><h2 style="margin-top:0">👨‍🏫 المعلمون <small class="muted">(${teachers.length})</small></h2>
      <div class="grid" id="tGrid">${teachers.map(teacherCard).join('') || '<p class="muted">لا يوجد معلمون حاليًا</p>'}</div>
    </div>
    ${S.enable_groups === '1' ? `<div class="card" id="groups"><h2 style="margin-top:0">👥 مجموعات متاحة</h2>
      <div class="grid">${groups.map(groupCard).join('') || '<p class="muted">لا توجد مجموعات مفتوحة حاليًا — تابعنا قريبًا 🙏</p>'}</div>
    </div>` : ''}
    <div class="card" style="text-align:center">
      <h3 style="margin-top:0">👨‍🏫 معلم وتريد الانضمام إلينا؟</h3>
      <p class="muted">قدّم طلبك في دقيقة وابدأ التدريس معنا بعد القبول</p>
      <a class="btn btn-a" href="/join.html">قدّم كمعلم ➕</a>
    </div>`;
  $('fGo').onclick = async () => {
    const sub = $('fSubject').value;
    const j = await api('/api/teachers' + (sub ? '?subject=' + encodeURIComponent(sub) : ''));
    $('tGrid').innerHTML = (j.ok && j.teachers.length)
      ? j.teachers.map(teacherCard).join('') : '<p class="muted">لا يوجد معلمون لهذه المادة حاليًا</p>';
    document.getElementById('teachers').scrollIntoView({ behavior: 'smooth' });
  };
}

async function renderTeacher(main, id) {
  const j = await api('/api/teacher/' + id);
  if (!j.ok) { main.innerHTML = `<div class="card"><p>${esc(j.error || 'غير موجود')}</p><a href="/">→ الرئيسية</a></div>`; return; }
  const t = j.t;
  const cur = esc(S.currency || '');
  const canPrivate = S.enable_private === '1' && t.price_private > 0;
  const canGroups = S.enable_groups === '1' && t.groups && t.groups.length;
  main.innerHTML = `
    <div class="card">
      <div class="phead">
        <img src="${imgSrc(t.img_id)}" alt="">
        <div>
          <h2 style="margin:0">${esc(t.name)}</h2>
          <div class="subj" style="color:var(--green);font-weight:bold">${esc(t.subject)}</div>
          ${starsHtml(t.rating, t.ratings_count)}
        </div>
      </div>
      <p>${esc(t.bio || '')}</p>
      ${t.schedule_text ? `<p>📅 <b>المواعيد المتاحة:</b> ${esc(t.schedule_text)}</p>` : ''}
      ${t.video_url ? `<p><a href="${esc(t.video_url)}" target="_blank">🎬 شاهد فيديو تعريفي</a></p>` : ''}
      <div class="row2">
        ${canPrivate ? `<button class="btn btn-p btn-big" id="bookPriv">👤 احجز برايفت — ${t.price_private} ${cur}</button>` : ''}
        ${!canPrivate && !canGroups ? '<p class="muted">الحجز متوقف مؤقتًا</p>' : ''}
      </div>
    </div>
    ${canGroups ? `<div class="card"><h3 style="margin-top:0">👥 مجموعات ${esc(t.name)}</h3>
      <div class="grid">${t.groups.map(g => groupCard({ ...g, teacher_name: t.name, subject: t.subject, teacher_id: t.id })).join('')}</div>
    </div>` : ''}
    <div class="card"><h3 style="margin-top:0">⭐ تقييمات الطلاب (${t.reviews.length})</h3>
      ${t.reviews.map(r => `<div style="border-bottom:1px solid var(--line);padding:8px 0">
        <b>${esc(r.sname)}</b> <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
        <div>${esc(r.comment || '')}</div></div>`).join('') || '<p class="muted">لا توجد تقييمات بعد</p>'}
    </div>`;
  if (canPrivate) $('bookPriv').onclick = () => openBook({ kind: 'private', teacherId: t.id, price: t.price_private, title: t.name });
}

// ---------- booking modal ----------
function payMethodsHtml() {
  const ms = S.pay_methods || [];
  if (!ms.length) return '<p class="muted">لا توجد طرق دفع معلنة — تواصل مع الدعم</p>';
  return `<label class="f">طريقة الدفع 💳</label>
    <select id="bkMethod">${ms.map((m, i) => `<option value="${i}">${esc(m.name)}</option>`).join('')}</select>
    <div class="card" style="background:#f8fafc;margin:8px 0" id="bkMethodInfo"></div>`;
}
function paintMethodInfo() {
  const ms = S.pay_methods || [];
  const m = ms[Number($('bkMethod').value) || 0];
  if (!m) return;
  $('bkMethodInfo').innerHTML = m.account
    ? `<b>${esc(m.name)}</b><br>📌 <b dir="ltr">${esc(m.account)}</b><br><small class="muted">${esc(m.note || '')}</small>`
    : `<b>${esc(m.name)}</b><br><small class="muted">${esc(m.note || '')}</small>`;
}
async function openBook({ kind, teacherId, groupId = 0, title = '', price = 0 }) {
  if (!ME) { location.href = '/auth.html?next=' + encodeURIComponent(location.pathname + location.search); return; }
  if (ME.role !== 'student') { toast('الحجز متاح لحسابات الطلاب فقط 🎓'); return; }
  const cur = esc(S.currency || '');
  const old = document.querySelector('.modal');
  if (old) old.remove();
  const d = document.createElement('div');
  d.className = 'modal show';
  d.innerHTML = `<div class="mbox">
    <button class="mclose" id="bkX">✕</button>
    <h3 style="margin-top:0">${kind === 'private' ? '👤 حجز حصة برايفت' : '👥 الاشتراك في مجموعة'}</h3>
    <p class="muted">${esc(title)} — <b>${price} ${cur}</b></p>
    ${kind === 'private' ? `<label class="f">المعاد المناسب ليك 📅</label>
      <input id="bkSlot" placeholder="مثال: السبت 5 مساءً">` : `<p class="muted">📌 معاد المجموعة ثابت حسب جدول المعلم</p>`}
    ${payMethodsHtml()}
    <label class="f">إثبات التحويل 🧾</label>
    <input id="bkProof" placeholder="رقم التليفون المحوِّل منه أو رقم العملية">
    <label class="f">ملاحظة للمعلم (اختياري)</label>
    <input id="bkNote" placeholder="مثال: عايز أركز على النحو">
    <label style="display:flex;gap:6px;font-size:13px;margin-top:10px">
      <input type="checkbox" id="bkAccept" style="width:auto"> أوافق على
      <a href="/page.html?k=terms" target="_blank">شروط الاستخدام</a> و
      <a href="/page.html?k=student" target="_blank">واجبات الطالب</a>
    </label>
    <button class="btn btn-p btn-big" id="bkGo">تأكيد الحجز ✅</button>
  </div>`;
  document.body.appendChild(d);
  $('bkX').onclick = () => d.remove();
  d.addEventListener('click', (e) => { if (e.target === d) d.remove(); });
  if ($('bkMethod')) { $('bkMethod').onchange = paintMethodInfo; paintMethodInfo(); }
  $('bkGo').onclick = async () => {
    if (!$('bkAccept').checked) { toast('لازم توافق على الشروط الأول ✅'); return; }
    const ms = S.pay_methods || [];
    const btn = $('bkGo');
    btn.disabled = true; btn.textContent = 'جاري الحجز... ⏳';
    const j = await api('/api/book', 'POST', {
      kind, teacher_id: teacherId, group_id: groupId,
      slot: kind === 'private' && $('bkSlot') ? $('bkSlot').value : '',
      pay_method: ms.length ? ms[Number($('bkMethod').value) || 0].name : '',
      pay_proof: $('bkProof').value, note: $('bkNote').value
    });
    btn.disabled = false; btn.textContent = 'تأكيد الحجز ✅';
    if (!j.ok) { toast(j.error || 'خطأ'); return; }
    d.querySelector('.mbox').innerHTML = `<h3>🎉 تم استلام طلبك!</h3>
      <p>كود الحجز: <b dir="ltr">${esc(j.code)}</b></p>
      <p>حوّل المبلغ بالطريقة اللي اخترتها، والإدارة هتراجع الدفع وتأكد حجزك خلال 24 ساعة.</p>
      <p>تابع حالة حجزك من <a href="/student.html">لوحتي 🎓</a></p>
      <button class="btn btn-p btn-big" onclick="location.href='/student.html'">تمام ✅</button>`;
  };
}

(async () => {
  if (isTeacherPage) {
    const id = new URLSearchParams(location.search).get('id');
    await shell('teachers', '<div id="pageBody"><div class="card"><p class="muted">جاري التحميل...</p></div></div>');
    renderTeacher(document.querySelector('.main'), id);
  } else {
    await shell('home', '<div id="pageBody"></div>');
    renderHome(document.querySelector('.main'));
  }
})();
