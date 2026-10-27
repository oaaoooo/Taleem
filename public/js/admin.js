// admin.js — full control panel
let ST = null;
(async () => {
  await shell('', `<div id="aBody"></div>`);
  const main = $('aBody');
  if (!ME || ME.role !== 'admin') {
    main.innerHTML = `<div class="card" style="max-width:400px;margin:30px auto;text-align:center">
      <h3>🎛️ لوحة الإدارة</h3>
      <label class="f">الباسورد</label><input id="aPw" type="password">
      <button class="btn btn-p btn-big" id="aGo">دخول</button></div>`;
    $('aGo').onclick = async () => {
      const j = await api('/api/admin/login', 'POST', { password: $('aPw').value });
      if (!j.ok) { toast(j.error || 'خطأ'); return; }
      location.reload();
    };
    return;
  }
  main.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <h2 style="margin:0">🎛️ لوحة تحكم ${esc(S.academy_name)}</h2>
      <div><button class="btn-mini btn-g" id="muteBtn">🔔 تنبيه</button>
      <a class="btn btn-g btn-mini" style="text-decoration:none" href="/" target="_blank">👁 عرض الموقع</a></div>
    </div>
    <div class="tabs" id="aTabs">
      <button data-t="home" class="on">📊 الرئيسية</button>
      <button data-t="books">📅 الحجوزات <span id="bdPay"></span></button>
      <button data-t="teachers">👨‍🏫 المعلمون</button>
      <button data-t="apps">📩 طلبات الانضمام <span id="bdApps"></span></button>
      <button data-t="students">🎓 الطلاب</button>
      <button data-t="groups">👥 المجموعات</button>
      <button data-t="wd">💰 السحب <span id="bdWd"></span></button>
      <button data-t="revs">⭐ التقييمات <span id="bdRev"></span></button>
      <button data-t="sets">⚙️ الإعدادات</button>
      <button data-t="legal">📜 النصوص القانونية</button>
    </div><div id="aMain"></div>`;
  const m = $('aMain');
  const T = {
    home: showHome, books: () => showBooks(1), teachers: showTeachers, apps: showApps,
    students: showStudents, groups: showGroups, wd: showWd, revs: showRevs, sets: showSets, legal: showLegal
  };
  document.querySelectorAll('#aTabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#aTabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    T[b.dataset.t]();
  });
  let lastTotal = null, muted = localStorage.getItem('tl_mute') === '1', titleTimer = null;
  const origTitle = document.title;
  startNotify();
  showHome();

  async function stats() {
    const j = await api('/api/admin/stats');
    if (j.ok) ST = j;
    return ST;
  }
  function badge(id, n) {
    const e = $(id);
    if (!e) return;
    n = Number(n) || 0;
    e.innerHTML = n ? `<span class="pill" style="background:#dc2626;color:#fff">${n}</span>` : '';
  }
  async function showHome() {
    m.innerHTML = '<div class="card"><p class="muted">جاري التحميل...</p></div>';
    const j = await stats();
    if (!j) return;
    badge('bdPay', j.pendingPay); badge('bdApps', j.pendingApps); badge('bdWd', j.pendingWd); badge('bdRev', j.pendingRev);
    const cur = esc(S.currency || '');
    m.innerHTML = `<div class="steps">
      <div class="step"><span class="n">🎓</span>الطلاب<br><b>${j.students}</b></div>
      <div class="step"><span class="n">👨‍🏫</span>المعلمون<br><b>${j.teachers}</b></div>
      <div class="step"><span class="n">📅</span>الحجوزات<br><b>${j.bookings}</b> (اليوم: ${j.today})</div>
      <div class="step"><span class="n">💵</span>إجمالي الدخل<br><b>${j.revenue} ${cur}</b></div>
      <div class="step"><span class="n">💰</span>عمولتك<br><b>${Math.round(j.commission)} ${cur}</b></div>
    </div>
    <div class="card"><h3 style="margin-top:0">⏳ محتاج مراجعة</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-a" onclick="goTab('books')">💳 مدفوعات (${j.pendingPay})</button>
        <button class="btn btn-a" onclick="goTab('apps')">📩 انضمام (${j.pendingApps})</button>
        <button class="btn btn-a" onclick="goTab('wd')">💰 سحب (${j.pendingWd})</button>
        <button class="btn btn-a" onclick="goTab('revs')">⭐ تقييمات (${j.pendingRev})</button>
      </div></div>
    <div class="card"><h3 style="margin-top:0">🔐 تغيير باسورد الإدارة</h3>
      <div class="row2"><div><label class="f">الحالي</label><input id="apOld" type="password"></div>
      <div><label class="f">الجديد</label><input id="apNew" type="password"></div></div>
      <button class="btn btn-g" id="apGo" style="margin-top:8px">تغيير</button></div>`;
    $('apGo').onclick = async () => {
      const r = await api('/api/admin/password', 'POST', { old: $('apOld').value, next: $('apNew').value });
      toast(r.ok ? 'اتغير ✅' : (r.error || 'خطأ'));
    };
  }
  window.goTab = (t) => document.querySelector(`#aTabs button[data-t="${t}"]`).click();

  // ---------- bookings ----------
  let bkPage = 1;
  async function showBooks(page) {
    bkPage = page;
    const pay = ($('fPay') && $('fPay').value) || '';
    const st = ($('fSt') && $('fSt').value) || '';
    if (page === 1 && !m.dataset.bk) {
      m.innerHTML = `<div class="card"><h3 style="margin-top:0">📅 الحجوزات</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <select id="fPay" style="width:auto"><option value="">كل المدفوعات</option>
            <option value="pending">⏳ معلق</option><option value="approved">✅ معتمد</option><option value="rejected">❌ مرفوض</option></select>
          <select id="fSt" style="width:auto"><option value="">كل الحالات</option>
            <option value="scheduled">📅 مجدولة</option><option value="done">✔ تمت</option>
            <option value="cancelled">❌ ملغية</option><option value="missed_teacher">⚠️ غياب معلم</option><option value="missed_student">⚠️ غياب طالب</option></select>
          <button class="btn btn-g" id="fGo">عرض 🔍</button>
          <a class="btn btn-b" href="/api/admin/export-bookings">📥 تصدير CSV</a>
        </div><div id="bkList"></div></div>`;
      $('fGo').onclick = () => showBooks(1);
      m.dataset.bk = '1';
    }
    const box = $('bkList');
    box.innerHTML = '<p class="muted">جاري التحميل...</p>';
    const j = await api(`/api/admin/bookings?page=${bkPage}` + (pay ? '&pay=' + pay : '') + (st ? '&st=' + st : ''));
    if (!j.ok) return;
    const cur = esc(S.currency || '');
    box.innerHTML = `<div class="table-wrap"><table>
      <tr><th>الكود</th><th>الطالب</th><th>المعلم/النوع</th><th>الدفع والإثبات</th><th>الحالة</th><th>إجراءات</th></tr>
      ${j.bookings.map(b => `<tr>
        <td><b dir="ltr">${esc(b.code)}</b><br><small class="muted">${esc(String(b.created_at || '').slice(0, 10))}</small></td>
        <td><b>${esc(b.student_name)}</b><br><small dir="ltr">${esc(b.student_phone || '')}</small><br>
          ${b.guardian_phone ? `<a dir="ltr" href="${waLink(b.guardian_phone)}" target="_blank">💬 ${esc(b.guardian_phone)}</a>` : ''}</td>
        <td>${esc(b.teacher_name)}<br><small>${esc(S.kindAr[b.kind])} ${b.group_title ? '— ' + esc(b.group_title) : ''}</small><br>
          <small>${esc(b.slot || '')}</small><br><small>💰 ${b.price} ${cur} (المعلم: ${b.teacher_amt})</small></td>
        <td><span class="pill">${esc(S.payAr[b.pay_status])}</span><br><small>${esc(b.pay_method)}</small><br><small>🧾 ${esc(b.pay_proof)}</small></td>
        <td><span class="pill">${esc(S.bookAr[b.status])}</span></td>
        <td style="min-width:170px">
          ${b.pay_status === 'pending' ? `<button class="btn-mini btn-p" style="background:#dcfce7" onclick="bkPay(${b.id},'approved')">اعتماد الدفع ✅</button>
            <button class="btn-mini btn-r" style="background:#fee2e2" onclick="bkPay(${b.id},'rejected')">رفض ❌</button><br>` : ''}
          <select id="st${b.id}" style="width:auto;padding:4px;font-size:12px">
            ${['scheduled', 'done', 'cancelled', 'missed_teacher', 'missed_student'].map(s2 => `<option value="${s2}" ${s2 === b.status ? 'selected' : ''}>${esc(S.bookAr[s2])}</option>`).join('')}
          </select>
          <button class="btn-mini btn-g" onclick="bkSt(${b.id})">حفظ</button><br>
          <button class="btn-mini btn-b" style="background:#dbeafe" onclick="bkMeet(${b.id},'${esc(b.meet_link || '')}')">🎥 الرابط</button>
          <button class="btn-mini btn-g" onclick='printBk(${JSON.stringify({ code: b.code, student: b.student_name, phone: b.student_phone, teacher: b.teacher_name, kind: S.kindAr[b.kind], slot: b.slot, price: b.price, pay: b.pay_method })})'>🖨 إيصال</button>
        </td></tr>`).join('') || '<tr><td colspan="6" class="muted">مفيش حجوزات</td></tr>'}</table></div>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-g" ${j.page <= 1 ? 'disabled' : ''} onclick="bkPg(-1)">→ السابق</button>
        <span class="muted">صفحة ${j.page} من ${j.pages} (${j.total})</span>
        <button class="btn btn-g" ${j.page >= j.pages ? 'disabled' : ''} onclick="bkPg(1)">التالي ←</button>
      </div>`;
  }
  window.bkPg = (d) => showBooks(bkPage + d);
  window.bkPay = async (id, pay) => {
    const j = await api('/api/admin/booking-pay', 'POST', { id, pay });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showBooks(bkPage);
  };
  window.bkSt = async (id) => {
    const j = await api('/api/admin/booking-status', 'POST', { id, status: $('st' + id).value });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showBooks(bkPage);
  };
  window.bkMeet = async (id, old) => {
    const v = prompt('رابط الاجتماع (زووم/ميت):', old || '');
    if (v === null) return;
    const j = await api('/api/admin/booking-meet', 'PUT', { id, meet_link: v });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
  };
  window.printBk = (b) => {
    const cur = S.currency || '';
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) { alert('اسمح بالنوافذ المنبثقة'); return; }
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>إيصال ${esc(b.code)}</title></head><body style="font-family:Tahoma;padding:18px">
      <h2 style="text-align:center">🎓 ${esc(S.academy_name)}</h2><p style="text-align:center">إيصال حجز حصة</p><hr>
      <p><b>الكود:</b> <span dir="ltr">${esc(b.code)}</span></p>
      <p><b>الطالب:</b> ${esc(b.student)} — <span dir="ltr">${esc(b.phone || '')}</span></p>
      <p><b>المعلم:</b> ${esc(b.teacher)}</p><p><b>النوع:</b> ${esc(b.kind)}</p>
      <p><b>المعاد:</b> ${esc(b.slot || '—')}</p><p><b>الدفع:</b> ${esc(b.pay)}</p>
      <h3>الإجمالي: ${esc(b.price)} ${cur}</h3><hr>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close(); w.focus();
  };

  // ---------- teachers ----------
  async function showTeachers() {
    m.innerHTML = '<div class="card"><p class="muted">جاري التحميل...</p></div>';
    const j = await api('/api/admin/teachers');
    if (!j.ok) return;
    const cur = esc(S.currency || '');
    m.innerHTML = j.teachers.map(t => `<div class="card">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <img src="${imgSrc(t.img_id)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover">
        <div style="flex:1;min-width:180px"><b>${esc(t.name)}</b> — ${esc(t.subject)}
          <span class="pill">${t.active ? '✅ نشط' : '⏸ موقوف'}</span>
          ${t.featured ? '<span class="pill">⭐ مميز</span>' : ''}
          <div class="muted" style="font-size:12px">📱 <span dir="ltr">${esc(t.phone || '')}</span> • 💬 واتساب: <span dir="ltr">${esc(t.whatsapp || '')}</span> • ⭐ ${t.rating} (${t.ratings_count})</div>
        </div>
        <button class="btn btn-g" onclick="tEdit(${t.id})">تعديل ✏️</button>
        <a class="btn btn-w" href="${waLink(t.whatsapp || t.phone)}" target="_blank">💬</a>
      </div><div id="te${t.id}"></div></div>`).join('') || '<div class="card">مفيش معلمين</div>';
    window._teachers = j.teachers;
  }
  window.tEdit = (id) => {
    const t = window._teachers.find(x => x.id === id);
    const box = $('te' + id);
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<hr><div class="row2">
      <div><label class="f">الاسم</label><input id="etName${id}" value="${esc(t.name)}"></div>
      <div><label class="f">المادة</label><input id="etSub${id}" value="${esc(t.subject)}"></div></div>
      <div class="row2">
        <div><label class="f">الموبايل (للدخول)</label><input id="etPhone${id}" value="${esc(t.phone || '')}"></div>
        <div><label class="f">واتساب</label><input id="etWa${id}" value="${esc(t.whatsapp || '')}"></div></div>
      <label class="f">النبذة</label><textarea id="etBio${id}">${esc(t.bio || '')}</textarea>
      <div class="row2">
        <div><label class="f">سعر البرايفت</label><input id="etPp${id}" type="number" value="${t.price_private}"></div>
        <div><label class="f">سعر المجموعة</label><input id="etPg${id}" type="number" value="${t.price_group}"></div></div>
      <label class="f">رابط الاجتماع الافتراضي</label><input id="etMeet${id}" dir="ltr" value="${esc(t.meet_link || '')}">
      <label class="f">المواعيد</label><input id="etSched${id}" value="${esc(t.schedule_text || '')}">
      <label class="f">فيديو تعريفي</label><input id="etVid${id}" dir="ltr" value="${esc(t.video_url || '')}">
      <div class="row2">
        <div><label class="f">عمولة خاصة % (فاضي = الافتراضية ${esc(S.commission_default || 30)}%)</label><input id="etComm${id}" type="number" value="${Number(t.commission) >= 0 ? t.commission : ''}" placeholder="فاضي"></div>
        <div><label class="f">باسورد جديد (اختياري)</label><input id="etPw${id}" placeholder="سيبه فاضي لو مش عايز تغير"></div></div>
      <label class="f">الصورة 📷</label><input type="file" id="etImg${id}" accept="image/*">
      <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
        <label><input type="checkbox" id="etAct${id}" ${t.active ? 'checked' : ''} style="width:auto"> نشط ✅</label>
        <label><input type="checkbox" id="etFeat${id}" ${t.featured ? 'checked' : ''} style="width:auto"> مميز ⭐</label>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-p" onclick="tSave(${id})">حفظ ✅</button>
        <button class="btn btn-r" onclick="tDel(${id})">حذف 🗑</button>
      </div>`;
  };
  window.tSave = async (id) => {
    const body = {
      name: $('etName' + id).value, subject: $('etSub' + id).value,
      phone: $('etPhone' + id).value, whatsapp: $('etWa' + id).value, bio: $('etBio' + id).value,
      price_private: $('etPp' + id).value, price_group: $('etPg' + id).value,
      meet_link: $('etMeet' + id).value, schedule_text: $('etSched' + id).value,
      video_url: $('etVid' + id).value, commission: $('etComm' + id).value,
      active: $('etAct' + id).checked, featured: $('etFeat' + id).checked,
      new_password: $('etPw' + id).value
    };
    const f = $('etImg' + id).files[0];
    if (f) {
      try {
        const du = await compressImage(f);
        const im = await api('/api/admin/image', 'POST', { data: du.split(',')[1], mime: 'image/jpeg' });
        if (im.ok) body.img_id = im.img_id;
      } catch { toast('الصورة مش صالحة'); return; }
    }
    const j = await api('/api/admin/teachers/' + id, 'PUT', body);
    toast(j.ok ? 'اتحفظ ✅' : (j.error || 'خطأ'));
    if (j.ok) showTeachers();
  };
  window.tDel = async (id) => {
    if (!confirm('تحذف المعلم ده نهائيًا؟')) return;
    const j = await api('/api/admin/teachers/' + id, 'DELETE');
    toast(j.ok ? 'اتحذف' : (j.error || 'خطأ'));
    if (j.ok) showTeachers();
  };

  // ---------- apps ----------
  async function showApps() {
    m.innerHTML = '<div class="card"><p class="muted">جاري التحميل...</p></div>';
    const j = await api('/api/admin/apps');
    if (!j.ok) return;
    m.innerHTML = j.apps.map(a => `<div class="card">
      <b>${esc(a.name)}</b> — ${esc(a.subject)}
      <span class="pill">${a.status === 'pending' ? '⏳ معلق' : a.status === 'approved' ? '✅ مقبول' : '❌ مرفوض'}</span>
      <div class="muted" style="font-size:13px">📱 <span dir="ltr">${esc(a.phone)}</span> • 💬 <span dir="ltr">${esc(a.whatsapp || '')}</span> • 👤 ${a.price_private} / 👥 ${a.price_group}</div>
      <p>${esc(a.bio || '')}</p>
      ${a.status === 'pending' ? `<button class="btn btn-p" onclick="appGo(${a.id},'approve')">قبول ✅</button>
        <button class="btn btn-r" onclick="appGo(${a.id},'reject')">رفض ❌</button>` : ''}
      <div id="appMsg${a.id}"></div></div>`).join('') || '<div class="card">مفيش طلبات</div>';
  }
  window.appGo = async (id, act) => {
    if (act === 'reject' && !confirm('ترفض الطلب؟')) return;
    const j = await api('/api/admin/apps/' + id, 'POST', { act });
    if (!j.ok) { toast(j.error || 'خطأ'); return; }
    if (j.temp_password) {
      $('appMsg' + id).innerHTML = `<div class="card" style="background:#ecfdf5;margin-top:8px">✅ اتقبل! ابعتله على واتساب:<br>
        دخولك: رقم موبايلك + الباسورد المؤقت <b dir="ltr">${esc(j.temp_password)}</b> (يغيّره بعد الدخول)</div>`;
      toast('اتقبل ✅');
    } else { toast('تم'); showApps(); }
  };

  // ---------- students / groups / withdrawals / reviews ----------
  async function showStudents() {
    m.innerHTML = `<div class="card"><h3 style="margin-top:0">🎓 الطلاب</h3>
      <div style="display:flex;gap:8px;margin-bottom:10px"><input id="sq" placeholder="دوّر بالاسم أو الرقم 🔍"><button class="btn btn-g" id="sqGo">بحث</button></div>
      <div id="stList"></div></div>`;
    const load = async () => {
      const j = await api('/api/admin/students?q=' + encodeURIComponent($('sq').value));
      if (!j.ok) return;
      $('stList').innerHTML = `<div class="table-wrap"><table><tr><th>الاسم</th><th>الأرقام</th><th>الدولة/الصف</th><th>حجوزات</th><th>إجراءات</th></tr>
        ${j.students.map(s => `<tr><td><b>${esc(s.name)}</b> ${s.active ? '' : '<span class="pill">⏸ موقوف</span>'}</td>
          <td>📱 <span dir="ltr">${esc(s.phone || '—')}</span><br>👨‍👩‍👦 ${s.guardian_phone ? `<a dir="ltr" href="${waLink(s.guardian_phone)}" target="_blank">💬 ${esc(s.guardian_phone)}</a>` : '—'}</td>
          <td>${esc(s.country || '')} / ${esc(s.grade || '')}</td><td>${s.bookings}</td>
          <td><button class="btn-mini btn-g" onclick="stToggle(${s.id})">${s.active ? 'إيقاف ⏸' : 'تشغيل ▶'}</button>
          <button class="btn-mini btn-r" style="background:#fee2e2" onclick="stDel(${s.id})">حذف</button></td></tr>`).join('')}</table></div>`;
    };
    $('sqGo').onclick = load;
    load();
  }
  window.stToggle = async (id) => {
    const j = await api('/api/admin/students/' + id, 'POST', { act: 'toggle' });
    if (j.ok) showStudents();
  };
  window.stDel = async (id) => {
    if (!confirm('تحذف الطالب؟')) return;
    const j = await api('/api/admin/students/' + id, 'POST', { act: 'delete' });
    toast(j.ok ? 'اتحذف' : (j.error || 'خطأ'));
    if (j.ok) showStudents();
  };

  async function showGroups() {
    const j = await api('/api/admin/groups');
    if (!j.ok) return;
    m.innerHTML = `<div class="card"><h3 style="margin-top:0">👥 المجموعات (${j.groups.length})</h3>
      <div class="table-wrap"><table><tr><th>المجموعة</th><th>المعلم</th><th>الأعضاء</th><th>السعر</th><th>إجراءات</th></tr>
      ${j.groups.map(g => `<tr><td><b>${esc(g.title)}</b> ${g.active ? '' : '<span class="pill">⏸</span>'}<br><small class="muted">${esc(g.schedule_text || '')}</small></td>
        <td>${esc(g.teacher_name)}</td><td>${g.members}/${g.max_seats}</td><td>${g.price}</td>
        <td><button class="btn-mini btn-g" onclick="gAdm(${g.id},'toggle')">${g.active ? 'إيقاف' : 'تشغيل'}</button>
        <button class="btn-mini btn-r" style="background:#fee2e2" onclick="gAdm(${g.id},'delete')">حذف</button></td></tr>`).join('')}</table></div></div>`;
  }
  window.gAdm = async (id, act) => {
    if (act === 'delete' && !confirm('تحذف المجموعة؟')) return;
    const j = await api('/api/admin/groups/' + id, 'POST', { act });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showGroups();
  };

  async function showWd() {
    const j = await api('/api/admin/withdrawals');
    if (!j.ok) return;
    const cur = esc(S.currency || '');
    m.innerHTML = `<div class="card"><h3 style="margin-top:0">💰 طلبات السحب</h3>
      <div class="table-wrap"><table><tr><th>المعلم</th><th>المبلغ</th><th>الاستلام</th><th>الحالة</th><th>إجراءات</th></tr>
      ${j.withdrawals.map(w => `<tr><td><b>${esc(w.teacher_name)}</b><br><small dir="ltr">${esc(w.teacher_phone || '')}</small><br><small class="muted">${esc(String(w.created_at || '').slice(0, 10))}</small></td>
        <td><b>${w.amount} ${cur}</b></td><td>${esc(w.method)}<br><small dir="ltr">${esc(w.account)}</small></td>
        <td><span class="pill">${esc(S.wdAr[w.status])}</span></td>
        <td>${w.status === 'pending' ? `<button class="btn-mini btn-p" style="background:#dcfce7" onclick="wdGo(${w.id},'paid')">تم التحويل ✅</button>
          <button class="btn-mini btn-r" style="background:#fee2e2" onclick="wdGo(${w.id},'rejected')">رفض</button>` : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">مفيش طلبات</td></tr>'}</table></div></div>`;
  }
  window.wdGo = async (id, act) => {
    const j = await api('/api/admin/withdrawals/' + id, 'POST', { act });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showWd();
  };

  async function showRevs() {
    const j = await api('/api/admin/reviews');
    if (!j.ok) return;
    m.innerHTML = j.reviews.map(r => `<div class="card">
      <b>${esc(r.student_name)}</b> → ${esc(r.teacher_name)}
      <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
      <span class="pill">${r.approved ? '✅ ظاهر' : '⏳ معلق'}</span>
      <p>${esc(r.comment || '')}</p>
      ${!r.approved ? `<button class="btn btn-p" onclick="revGo(${r.id},'approve')">نشر ✅</button>` : `<button class="btn btn-g" onclick="revGo(${r.id},'hide')">إخفاء</button>`}
      <button class="btn btn-r" onclick="revGo(${r.id},'delete')">حذف 🗑</button></div>`).join('') || '<div class="card">مفيش تقييمات</div>';
  }
  window.revGo = async (id, act) => {
    if (act === 'delete' && !confirm('تحذف التقييم؟')) return;
    const j = await api('/api/admin/reviews/' + id, 'POST', { act });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showRevs();
  };

  // ---------- settings ----------
  async function showSets() {
    const j = await api('/api/admin/settings');
    if (!j.ok) return;
    const s = j.settings;
    const pay = JSON.parse(s.pay_methods || '[]');
    m.innerHTML = `<div class="card"><h3 style="margin-top:0">⚙️ الإعدادات العامة</h3>
      <div class="row2">
        <div><label class="f">اسم المنصة 🎓</label><input id="sName" value="${esc(s.academy_name)}"></div>
        <div><label class="f">العملة 💰</label><input id="sCur" value="${esc(s.currency)}"></div></div>
      <label class="f">السطر التعريفي</label><input id="sTag" value="${esc(s.tagline)}">
      <label class="f">شريط الإعلانات 📢 (فاضي = مخفي)</label><input id="sAnn" value="${esc(s.announcement)}">
      <label class="f">واتساب الدعم 💬 (بالكود الدولي — مثال: 2010xxxxxxxx)</label><input id="sWa" dir="ltr" value="${esc(s.admin_whatsapp)}">
      <div class="row2">
        <div><label class="f">نسبة العمولة الافتراضية % 💰</label><input id="sComm" type="number" min="0" max="90" value="${esc(s.commission_default)}"></div>
        <div><label class="f">العملة تُخصم تلقائيًا من كل حصة — ويمكن تخصيص نسبة لكل معلم من صفحة المعلمين</label></div></div>
      <div class="row2">
        <div><label class="f">الحد الأدنى لسحب المعلم</label><input id="sWmin" type="number" value="${esc(s.withdraw_min)}"></div>
        <div><label class="f">دورة الصرف</label><input id="sWc" value="${esc(s.withdraw_cycle)}"></div></div>
      <label class="f">مهلة الإلغاء المجاني (ساعة) — قبل المعاد</label><input id="sCh" type="number" value="${esc(s.cancel_hours)}" style="max-width:200px">
      <h4>🔛 إظهار / إخفاء الخدمات</h4>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <label><input type="checkbox" id="sPriv" ${s.enable_private === '1' ? 'checked' : ''} style="width:auto"> 👤 البرايفت</label>
        <label><input type="checkbox" id="sGrp" ${s.enable_groups === '1' ? 'checked' : ''} style="width:auto"> 👥 المجموعات</label>
      </div>
      <h4>📝 حقول التسجيل (إجباري / اختياري)</h4>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <label><input type="checkbox" id="sRqPh" ${s.req_student_phone === '1' ? 'checked' : ''} style="width:auto"> رقم الطالب إجباري</label>
        <label><input type="checkbox" id="sRqGh" ${s.req_guardian_phone === '1' ? 'checked' : ''} style="width:auto"> رقم ولي الأمر إجباري</label>
      </div>
      <h4>📚 المواد (سطر لكل مادة)</h4><textarea id="sSubj">${esc(JSON.parse(s.subjects || '[]').join('\n'))}</textarea>
      <h4>🎒 الصفوف (سطر لكل صف)</h4><textarea id="sGrades">${esc(JSON.parse(s.grades || '[]').join('\n'))}</textarea>
      <label class="f">🎥 دليل دخول الحصة (يظهر للطالب)</label><textarea id="sGuide">${esc(s.meet_guide)}</textarea>
      <button class="btn btn-p btn-big" id="sGo">حفظ كل الإعدادات ✅</button>
    </div>
    <div class="card"><h3 style="margin-top:0">💳 طرق الدفع اليدوية</h3><div id="payList"></div>
      <button class="btn btn-g" id="payAdd">➕ إضافة طريقة</button>
      <button class="btn btn-p" id="paySave">حفظ طرق الدفع ✅</button>
    </div>`;
    const paintPay = () => {
      $('payList').innerHTML = pay.map((p, i) => `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">
        <div class="row2"><div><label class="f">الاسم</label><input data-p="${i}" data-k="name" value="${esc(p.name)}" placeholder="فودافون كاش"></div>
        <div><label class="f">الرقم/الحساب</label><input data-p="${i}" data-k="account" dir="ltr" value="${esc(p.account)}"></div></div>
        <label class="f">تعليمات للطالب</label><input data-p="${i}" data-k="note" value="${esc(p.note)}">
        <button class="btn-mini btn-r" style="background:#fee2e2;margin-top:6px" onclick="payDel(${i})">حذف 🗑</button>
      </div>`).join('') || '<p class="muted">مفيش طرق دفع — ضيف واحدة</p>';
    };
    window.payDel = (i) => { pay.splice(i, 1); paintPay(); };
    paintPay();
    $('payAdd').onclick = () => { if (pay.length >= 10) return; pay.push({ name: '', account: '', note: '' }); paintPay(); };
    $('paySave').onclick = async () => {
      document.querySelectorAll('[data-p]').forEach(el => { pay[Number(el.dataset.p)][el.dataset.k] = el.value; });
      const r = await api('/api/admin/settings', 'PUT', { pay_methods: pay });
      toast(r.ok ? 'اتحفظت ✅' : (r.error || 'خطأ'));
      if (r.ok) sessionStorage.removeItem('tl_boot');
    };
    $('sGo').onclick = async () => {
      const r = await api('/api/admin/settings', 'PUT', {
        academy_name: $('sName').value, tagline: $('sTag').value, currency: $('sCur').value,
        announcement: $('sAnn').value, admin_whatsapp: $('sWa').value,
        commission_default: $('sComm').value, withdraw_min: $('sWmin').value,
        withdraw_cycle: $('sWc').value, cancel_hours: $('sCh').value,
        enable_private: $('sPriv').checked ? '1' : '0', enable_groups: $('sGrp').checked ? '1' : '0',
        req_student_phone: $('sRqPh').checked ? '1' : '0', req_guardian_phone: $('sRqGh').checked ? '1' : '0',
        subjects: $('sSubj').value, grades: $('sGrades').value, meet_guide: $('sGuide').value
      });
      toast(r.ok ? 'اتحفظت ✅' : (r.error || 'خطأ'));
      if (r.ok) sessionStorage.removeItem('tl_boot');
    };
  }

  async function showLegal() {
    const j = await api('/api/admin/settings');
    if (!j.ok) return;
    const s = j.settings;
    const secs = [
      ['legal_terms', '📜 شروط الاستخدام'], ['legal_privacy', '🔒 سياسة الخصوصية'],
      ['legal_teacher', '👨‍🏫 شروط المعلم وواجباته والعقوبات'], ['legal_student', '🎒 واجبات الطالب']
    ];
    m.innerHTML = `<div class="card"><h3 style="margin-top:0">📜 النصوص القانونية</h3>
      <p class="muted">النصوص دي بتظهر في صفحات الموقع — عدّلها بحرص. (يُنصح بمراجعة محامٍ قبل الإطلاق الرسمي)</p>
      ${secs.map(([k, t]) => `<h4>${t}</h4><textarea id="lg_${k}" style="min-height:220px">${esc(s[k])}</textarea>`).join('')}
      <button class="btn btn-p btn-big" id="lgGo">حفظ النصوص ✅</button></div>`;
    $('lgGo').onclick = async () => {
      const body = {};
      secs.forEach(([k]) => { body[k] = $('lg_' + k).value; });
      const r = await api('/api/admin/settings', 'PUT', body);
      toast(r.ok ? 'اتحفظت ✅' : (r.error || 'خطأ'));
    };
  }

  // ---------- new-booking alerts (admin only) ----------
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.55);
    } catch { /* needs a click first */ }
  }
  function startNotify() {
    setInterval(async () => {
      const j = await api('/api/admin/stats');
      if (!j.ok) return;
      if (lastTotal === null) { lastTotal = j.total; return; }
      if (Number(j.total) > Number(lastTotal)) {
        const n = Number(j.total) - Number(lastTotal);
        lastTotal = j.total;
        if (!muted) beep();
        clearInterval(titleTimer);
        let on = false;
        titleTimer = setInterval(() => { document.title = on ? origTitle : `(${n}) حجز جديد! 🛎`; on = !on; }, 900);
        setTimeout(() => { clearInterval(titleTimer); document.title = origTitle; }, 30000);
      } else lastTotal = j.total;
    }, 30000);
    const mb = $('muteBtn');
    const paint = () => { mb.textContent = muted ? '🔕 صامت' : '🔔 تنبيه'; };
    mb.onclick = () => { muted = !muted; localStorage.setItem('tl_mute', muted ? '1' : '0'); paint(); };
    paint();
  }
})();
