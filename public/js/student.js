// student.js — student dashboard
(async () => {
  await shell('', `<div class="admin-layout"><aside class="admin-side" id="dTabs">
      <button data-t="lessons" class="on">📅 حصصي</button>
      <button data-t="profile">👤 بياناتي</button>
      <button data-t="guide">🎥 إزاي أدخل الحصة؟</button>
    </aside><div class="admin-main" id="dBody"></div></div>`, { noSide: true, title: 'لوحتي' });
  if (!ME || ME.role !== 'student') { location.href = '/auth.html?next=/student.html'; return; }
  const main = $('dBody');
  document.querySelectorAll('#dTabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#dTabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    ({ lessons: showLessons, profile: showProfile, guide: showGuide })[b.dataset.t]();
  });

  async function showLessons() {
    main.innerHTML = '<div class="card"><p class="muted">جاري التحميل...</p></div>';
    const j = await api('/api/s/bookings');
    if (!j.ok) { main.innerHTML = '<div class="card">خطأ</div>'; return; }
    const cur = esc(S.currency || '');
    if (!j.bookings.length) {
      main.innerHTML = `<div class="card" style="text-align:center">
        <h3>مفيش حجوزات لسه 📭</h3><p class="muted">اختار معلمك وابدأ أول حصة</p>
        <a class="btn btn-p" href="/#teachers">تصفح المعلمين 👨‍🏫</a></div>`;
      return;
    }
    const allBk = j.bookings;
    let bkF = 'up';
    const nUp = allBk.filter(b => b.status === 'scheduled').length;
    main.innerHTML = `<div class="filters"><div class="seg">
      <button id="fUp" class="on">📅 القادمة (${nUp})</button>
      <button id="fPast">📜 السابقة (${allBk.length - nUp})</button></div></div><div id="bkGrid"></div>`;
    const paintBk = () => {
      const list = allBk.filter(b => bkF === 'up' ? b.status === 'scheduled' : b.status !== 'scheduled');
      $('bkGrid').innerHTML = '<div class="grid">' + list.map(b => {
      const approved = b.pay_status === 'approved';
      const live = approved && b.status === 'scheduled' && b.meet_link;
      return `<div class="tcard" style="text-align:right">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b dir="ltr">${esc(b.code)}</b>
          <span class="pill">${esc(S.kindAr[b.kind] || b.kind)}</span>
        </div>
        <h3>👨‍🏫 ${esc(b.teacher_name)}</h3>
        <div class="subj">${esc(b.subject)}${b.group_title ? ' — ' + esc(b.group_title) : ''}</div>
        <div class="pr">📅 ${esc(b.slot || '—')}</div>
        <div class="pr">💰 ${b.price} ${cur}</div>
        <div class="pr">الدفع: <span class="pill">${esc(S.payAr[b.pay_status])}</span></div>
        <div class="pr">الحصة: <span class="pill">${esc(S.bookAr[b.status])}</span></div>
        ${!approved && b.pay_status === 'pending' ? `<p class="muted" style="font-size:12px">حوّلت؟ الإدارة بتراجع الدفع خلال 24 ساعة ⏳</p>` : ''}
        ${b.pay_status === 'rejected' ? '<p style="font-size:12px;color:#dc2626">الدفع مرفوض — تواصل مع الدعم لتصحيح البيانات</p>' : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${live ? `<a class="btn btn-p" style="flex:1" href="${esc(b.meet_link)}" target="_blank">🎥 ادخل الحصة</a>` : ''}
          ${approved && b.teacher_wa ? `<a class="btn btn-w" style="flex:1" href="${waLink(b.teacher_wa)}" target="_blank">💬 واتساب المعلم</a>` : ''}
          ${b.status === 'scheduled' ? `<button class="btn btn-r" onclick="cancelBk(${b.id})">إلغاء</button>` : ''}
          ${b.status === 'done' && approved ? `<button class="btn btn-a" onclick="reviewBk(${b.id},'${esc(b.teacher_name)}')">⭐ قيّم</button>` : ''}
        </div>
      </div>`;
      }).join('') + '</div>';
      if (!list.length) $('bkGrid').innerHTML = `<div class="empty"><span class="big">📭</span>
        <p class="muted">${bkF === 'up' ? 'مفيش حصص قادمة — احجز حصتك الجاية 👇' : 'مفيش حصص سابقة'}</p>
        ${bkF === 'up' ? '<a class="btn btn-p" href="/#teachers">تصفح المعلمين 👨‍🏫</a>' : ''}</div>`;
    };
    paintBk();
    $('fUp').onclick = () => { bkF = 'up'; $('fUp').classList.add('on'); $('fPast').classList.remove('on'); paintBk(); };
    $('fPast').onclick = () => { bkF = 'past'; $('fPast').classList.add('on'); $('fUp').classList.remove('on'); paintBk(); };
  }

  window.cancelBk = async (id) => {
    if (!confirm('تلغي الحجز ده؟')) return;
    const j = await api('/api/s/cancel', 'POST', { id });
    toast(j.ok ? (j.msg || 'تم الإلغاء') : (j.error || 'خطأ'), 4000);
    if (j.ok) showLessons();
  };
  window.reviewBk = async (id, tname) => {
    let stars = 5;
    const { close } = openModal(`
      <h3 class="sec-t">⭐ قيّم ${esc(tname)}</h3>
      <div class="starpick" id="rvStars">${[1, 2, 3, 4, 5].map(i => `<span data-v="${i}">★</span>`).join('')}</div>
      <label class="f">رأيك في الحصة (اختياري)</label>
      <textarea id="rvC" placeholder="اكتب رأيك..."></textarea>
      <button class="btn btn-p btn-big" id="rvGo">إرسال التقييم ✅</button>`);
    const paint = () => document.querySelectorAll('#rvStars span').forEach(s => s.classList.toggle('lit', Number(s.dataset.v) <= stars));
    document.querySelectorAll('#rvStars span').forEach(s => s.onclick = () => { stars = Number(s.dataset.v); paint(); });
    paint();
    $('rvGo').onclick = async () => {
      const j = await api('/api/s/review', 'POST', { booking_id: id, rating: stars, comment: $('rvC').value });
      toast(j.ok ? j.msg : (j.error || 'خطأ'), 3000, j.ok ? 'ok' : 'err');
      if (j.ok) close();
    };
  };

  function showProfile() {
    main.innerHTML = `<div class="card" style="max-width:560px">
      <h3 style="margin-top:0">👤 بياناتي</h3>
      <label class="f">الاسم بالكامل</label><input id="pName" value="${esc(ME.name)}">
      <div class="row2">
        <div><label class="f">موبايل الطالب ${S.req_student_phone === '1' ? '(إجباري *)' : '(اختياري)'}</label><input id="pPhone" value="${esc(ME.phone || '')}"></div>
        <div><label class="f">موبايل ولي الأمر ${S.req_guardian_phone === '1' ? '(إجباري *)' : '(اختياري)'}</label><input id="pGuardian" value="${esc(ME.guardian_phone || '')}"></div>
      </div>
      <div class="row2">
        <div><label class="f">الدولة 🌍</label><select id="pCountry"></select></div>
        <div><label class="f">الصف الدراسي 🎒</label><select id="pGrade"></select></div>
      </div>
      <button class="btn btn-p btn-big" id="pSave">حفظ التعديلات ✅</button>
      <hr style="margin:18px 0;border:none;border-top:1px solid var(--line)">
      <h3>🔐 تغيير كلمة المرور</h3>
      <label class="f">الحالية</label><input id="pwOld" type="password">
      <label class="f">الجديدة (6 حروف على الأقل)</label><input id="pwNew" type="password">
      <button class="btn btn-g btn-big" id="pwGo">تغيير كلمة المرور</button>
    </div>`;
    eyeFor('pwOld'); eyeFor('pwNew');
    $('pCountry').innerHTML = (S.countries || []).map(c => `<option ${c === ME.country ? 'selected' : ''}>${esc(c)}</option>`).join('');
    $('pGrade').innerHTML = '<option value="">—</option>' + (S.grades || []).map(g => `<option ${g === ME.grade ? 'selected' : ''}>${esc(g)}</option>`).join('');
    $('pSave').onclick = async () => {
      const j = await api('/api/s/profile', 'PUT', {
        name: $('pName').value, phone: $('pPhone').value, guardian_phone: $('pGuardian').value,
        country: $('pCountry').value, grade: $('pGrade').value
      });
      toast(j.ok ? 'اتحفظت ✅' : (j.error || 'خطأ'));
      if (j.ok) loadMe();
    };
    $('pwGo').onclick = async () => {
      const j = await api('/api/s/password', 'PUT', { old: $('pwOld').value, next: $('pwNew').value });
      toast(j.ok ? 'اتغيرت ✅' : (j.error || 'خطأ'));
    };
  }

  function showGuide() {
    main.innerHTML = `<div class="card" style="max-width:620px">
      <h3 style="margin-top:0">🎥 إزاي تدخل الحصة؟</h3>
      <div class="legal-body">${esc(S.meet_guide || 'ادخل على رابط الحصة من لوحتك في المعاد المحدد.')}</div>
      <p class="muted">زرار "🎥 ادخل الحصة" بيظهر في كارت الحصة بعد اعتماد الدفع.</p>
    </div>`;
  }
  const wantTab = new URLSearchParams(location.search).get('tab');
  const wantBtn = wantTab && document.querySelector(`#dTabs button[data-t="${wantTab}"]`);
  if (wantBtn) wantBtn.click(); else showLessons();
})();
