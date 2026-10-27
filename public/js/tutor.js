// tutor.js — teacher panel
(async () => {
  await shell('', `<div class="admin-layout"><aside class="admin-side" id="tTabs">
      <button data-t="books" class="on">📅 حجوزاتي</button>
      <button data-t="groups">👥 مجموعاتي</button>
      <button data-t="money">💰 أرباحي والسحب</button>
      <button data-t="page">📝 صفحتي وأسعاري</button>
      <button data-t="pw">🔐 كلمة المرور</button>
    </aside><div class="admin-main" id="tBody"></div></div>`, { noSide: true, title: 'لوحة المعلم' });
  if (!ME || ME.role !== 'teacher') { location.href = '/auth.html?next=/tutor.html'; return; }
  const main = $('tBody');
  document.querySelectorAll('#tTabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#tTabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    ({ books: showBooks, groups: showGroups, money: showMoney, page: showPage, pw: showPw })[b.dataset.t]();
  });
  const cur = () => esc(S.currency || '');

  async function showBooks() {
    main.innerHTML = '<div class="card"><p class="muted">جاري التحميل...</p></div>';
    const j = await api('/api/t/bookings');
    if (!j.ok) return;
    if (!j.bookings.length) {
      main.innerHTML = '<div class="card"><div class="empty"><span class="big">📭</span><p class="muted">مفيش حجوزات لسه — شارك صفحتك مع طلابك 👇</p><button class="btn btn-w" onclick="shareMyPage()">مشاركة صفحتي 💬</button></div></div>';
      return;
    }
    const nSch = j.bookings.filter(b => b.status === 'scheduled').length;
    const nDone = j.bookings.filter(b => b.status === 'done').length;
    const nPen = j.bookings.filter(b => b.pay_status === 'pending').length;
    const sumOk = Math.round(j.bookings.filter(b => b.pay_status === 'approved').reduce((a, b) => a + Number(b.teacher_amt || 0), 0) * 100) / 100;
    const tabBtn = document.querySelector('#tTabs button[data-t="books"]');
    if (tabBtn) tabBtn.innerHTML = `📅 حجوزاتي${nPen ? ` <span class="bdg">${nPen}</span>` : ''}`;
    main.innerHTML = `<div class="stat-grid">
        <div class="stat"><span class="ic">📅</span><span class="lb">مجدولة</span><div class="vl">${nSch}</div></div>
        <div class="stat"><span class="ic">✔</span><span class="lb">مكتملة</span><div class="vl">${nDone}</div></div>
        <div class="stat"><span class="ic">⏳</span><span class="lb">دفع معلق</span><div class="vl">${nPen}</div></div>
        <div class="stat"><span class="ic">💰</span><span class="lb">مستحق معتمد</span><div class="vl">${sumOk}</div></div>
      </div>
      <div class="card"><div class="filters"><div class="seg" id="bkSeg">
        <button data-f="" class="on">الكل</button><button data-f="scheduled">📅 مجدولة</button>
        <button data-f="done">✔ تمت</button><button data-f="cancelled">❌ ملغية</button>
      </div></div>
      <div class="table-wrap"><table class="resp">
      <tr><th>الكود</th><th>الطالب والتواصل</th><th>النوع/المعاد</th><th>الدفع</th><th>الحالة</th><th>إجراءات</th></tr>
      <tbody id="bkRows"></tbody></table></div></div>`;
    const rowHtml = (b) => `<tr>
        <td data-l="الكود"><b dir="ltr">${esc(b.code)}</b></td>
        <td data-l="الطالب والتواصل"><b>${esc(b.student_name)}</b><br>
          ${b.student_phone ? `📱 <a dir="ltr" href="tel:${esc(b.student_phone)}">${esc(b.student_phone)}</a><br>` : ''}
          ${b.guardian_phone ? `👨‍👩‍👦 <a dir="ltr" href="${waLink(b.guardian_phone)}" target="_blank">${esc(b.guardian_phone)}</a> 💬<br>` : ''}
          <small class="muted">${esc(b.country || '')}</small></td>
        <td data-l="النوع/المعاد">${esc(S.kindAr[b.kind])}${b.group_title ? '<br>' + esc(b.group_title) : ''}<br><small>${esc(b.slot || '')}</small></td>
        <td data-l="الدفع"><span class="pill">${esc(S.payAr[b.pay_status])}</span><br><small>${b.price} ${cur()} (ليك ${b.teacher_amt})</small></td>
        <td data-l="الحالة"><span class="pill">${esc(S.bookAr[b.status])}</span>
          ${b.status === 'scheduled' && b.meet_link ? `<br><a href="${esc(b.meet_link)}" target="_blank">🎥 ابدأ الحصة</a>` : ''}</td>
        <td data-l="إجراءات">${b.status === 'scheduled' ? `
          <button class="btn-mini btn-p" style="background:#dcfce7" onclick="bkSt(${b.id},'done')">✔ تمت</button>
          <button class="btn-mini btn-g" onclick="bkSt(${b.id},'missed_student')">⚠️ الطالب غاب</button>
          <button class="btn-mini btn-r" style="background:#fee2e2" onclick="bkSt(${b.id},'cancelled')">إلغاء</button>` : '—'}</td>
      </tr>`;
    const paintT = (f) => {
      const list = j.bookings.filter(b => !f || b.status === f);
      $('bkRows').innerHTML = list.map(rowHtml).join('') || '<tr><td colspan="6" class="muted no-l" style="text-align:center">مفيش حجوزات بالحالة دي</td></tr>';
    };
    paintT('');
    document.querySelectorAll('#bkSeg button').forEach(x => x.onclick = () => {
      document.querySelectorAll('#bkSeg button').forEach(y => y.classList.remove('on'));
      x.classList.add('on');
      paintT(x.dataset.f);
    });
  }
  window.shareMyPage = () => {
    const url = location.origin + '/teacher.html?id=' + ME.id;
    const msg = `احجز حصتك مع ${ME.name} (${ME.subject}) على ${S.academy_name} 🎓\n${url}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  };
  window.bkSt = async (id, status) => {
    const msgs = { done: 'تأكيد إتمام الحصة؟', missed_student: 'الطالب محضرش؟', cancelled: 'تلغي الحجز ده؟' };
    if (!confirm(msgs[status])) return;
    const j = await api('/api/t/booking-status', 'POST', { id, status });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showBooks();
  };

  async function showGroups() {
    const j = await api('/api/t/groups');
    const gs = j.ok ? j.groups : [];
    main.innerHTML = `<div class="card"><h3 style="margin-top:0">➕ مجموعة جديدة</h3>
      <div class="row2">
        <div><label class="f">اسم المجموعة</label><input id="gTitle" placeholder="مثال: نحو 3 ثانوي — مجموعة السبت"></div>
        <div><label class="f">الصف</label><select id="gGrade"><option value="">—</option>${(S.grades || []).map(g => `<option>${esc(g)}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div><label class="f">السعر للطالب (${cur()})</label><input id="gPrice" type="number" min="0" value="${ME.price_group || 0}"></div>
        <div><label class="f">عدد المقاعد</label><input id="gSeats" type="number" min="2" max="50" value="8"></div>
      </div>
      <label class="f">الجدول (المواعيد الثابتة)</label><input id="gSched" placeholder="مثال: السبت والأربعاء 5 مساءً">
      <label class="f">رابط الاجتماع (زووم/ميت) — لو فاضي هيستخدم رابطك الافتراضي</label><input id="gMeet" dir="ltr" placeholder="https://...">
      <button class="btn btn-p" id="gGo" style="margin-top:10px">إنشاء المجموعة ✅</button>
    </div>
    <div class="card"><h3 style="margin-top:0">👥 مجموعاتي (${gs.length})</h3>
      ${gs.map(g => `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">
        <b>${esc(g.title)}</b> <span class="pill">${g.active ? '✅ نشطة' : '⏸ متوقفة'}</span>
        <span class="pill">👥 ${g.members}/${g.max_seats}</span> <span class="pill">💰 ${g.price} ${cur()}</span>
        <div class="muted" style="font-size:12px">📅 ${esc(g.schedule_text || '—')}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-mini btn-b" style="background:#dbeafe" onclick="gMembers(${g.id},'${esc(g.title)}')">الأعضاء</button>
          <button class="btn-mini btn-g" onclick="gToggle(${g.id},${g.active ? 0 : 1},${g.price},'${esc(g.title)}','${esc(g.grade || '')}',${g.max_seats},'${esc(g.schedule_text || '')}','${esc(g.meet_link || '')}')">${g.active ? 'إيقاف ⏸' : 'تشغيل ▶'}</button>
        </div><div id="gm${g.id}"></div>
      </div>`).join('') || '<p class="muted">مفيش مجموعات لسه</p>'}
    </div>`;
    $('gGo').onclick = async () => {
      const j2 = await api('/api/t/groups', 'POST', {
        title: $('gTitle').value, grade: $('gGrade').value, price: $('gPrice').value,
        max_seats: $('gSeats').value, schedule_text: $('gSched').value, meet_link: $('gMeet').value
      });
      toast(j2.ok ? 'اتعملت ✅' : (j2.error || 'خطأ'));
      if (j2.ok) showGroups();
    };
  }
  window.gMembers = async (id, title) => {
    const box = $('gm' + id);
    box.innerHTML = '<p class="muted">جاري التحميل...</p>';
    const j = await api('/api/t/group-members/' + id);
    if (!j.ok) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="table-wrap"><table class="resp" style="margin-top:8px">
      <tr><th>الطالب</th><th>التواصل</th><th>الدفع</th></tr>
      ${j.members.map(m => `<tr><td data-l="الطالب">${esc(m.name)}</td>
        <td data-l="التواصل">${m.phone ? `<a dir="ltr" href="tel:${esc(m.phone)}">${esc(m.phone)}</a> ` : ''}${m.guardian_phone ? `<a dir="ltr" href="${waLink(m.guardian_phone)}" target="_blank">${esc(m.guardian_phone)}</a> 💬` : ''}</td>
        <td data-l="الدفع"><span class="pill">${esc(S.payAr[m.pay_status])}</span></td></tr>`).join('') || '<tr><td colspan="3" class="muted no-l">مفيش أعضاء</td></tr>'}</table></div>`;
  };
  window.gToggle = async (id, active, price, title, grade, seats, sched, meet) => {
    const j = await api('/api/t/groups/' + id, 'PUT', { title, grade, price, max_seats: seats, schedule_text: sched, meet_link: meet, active });
    toast(j.ok ? 'تم ✅' : (j.error || 'خطأ'));
    if (j.ok) showGroups();
  };

  async function showMoney() {
    const [j, mj] = await Promise.all([api('/api/t/earnings'), api('/api/t/monthly')]);
    if (!j.ok) return;
    const MN = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const mos = (mj.ok && mj.months) || [];
    const mx = Math.max(1, ...mos.map(x => x.sum));
    const chart = mos.length ? `<div class="card"><h3 class="sec-t">📊 أرباح آخر 6 شهور (حصص مكتملة)</h3><div class="bars">${
      mos.map(x => `<div class="bar"><span class="val">${x.sum}</span><div class="fill" style="height:${Math.max(3, Math.round(x.sum / mx * 100))}%"></div><span class="cap">${MN[Number(x.mo.split('-')[1]) - 1]}</span></div>`).join('')
    }</div><p class="hint">بـ ${cur()}</p></div>` : '';
    main.innerHTML = `<div class="card"><h3 style="margin-top:0">💰 أرباحي</h3>
      <div class="steps">
        <div class="step"><span class="n">💵</span>إجمالي المستحق<br><b>${j.earned} ${cur()}</b></div>
        <div class="step"><span class="n">✅</span>متاح للسحب<br><b>${j.withdrawable} ${cur()}</b></div>
        <div class="step"><span class="n">⏳</span>معلق/قيد الصرف<br><b>${j.reserved} ${cur()}</b></div>
      </div>
      <p class="muted">الصرف ${esc(j.withdraw_cycle || '')} — الحد الأدنى ${j.withdraw_min} ${cur()} — السحب متاح عن الحصص المكتملة فقط</p>
    </div>
    ${chart}
    <div class="card"><h3 style="margin-top:0">📤 طلب سحب جديد</h3>
      <div class="row2">
        <div><label class="f">المبلغ (${cur()})</label><input id="wAmt" type="number" min="0"></div>
        <div><label class="f">الطريقة</label><input id="wMethod" placeholder="فودافون كاش / انستاباي / ..."></div>
      </div>
      <label class="f">بيانات الاستلام (رقم المحفظة/الحساب)</label><input id="wAcc" dir="ltr">
      <button class="btn btn-p" id="wGo" style="margin-top:10px">إرسال الطلب 📩</button>
    </div>
    <div class="card"><h3 style="margin-top:0">📋 طلبات السحب</h3>
      <div class="table-wrap"><table class="resp"><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th></tr>
      ${j.withdrawals.map(w => `<tr><td data-l="التاريخ">${esc(String(w.created_at || '').slice(0, 10))}</td><td data-l="المبلغ">${w.amount} ${cur()}</td>
        <td data-l="الطريقة">${esc(w.method)}<br><small dir="ltr">${esc(w.account)}</small></td><td data-l="الحالة"><span class="pill">${esc(S.wdAr[w.status])}</span></td></tr>`).join('') || '<tr><td colspan="4" class="muted no-l">مفيش طلبات</td></tr>'}</table></div>
    </div>`;
    $('wGo').onclick = async () => {
      const r = await api('/api/t/withdraw', 'POST', { amount: $('wAmt').value, method: $('wMethod').value, account: $('wAcc').value });
      toast(r.ok ? r.msg : (r.error || 'خطأ'), 3500);
      if (r.ok) showMoney();
    };
  }

  function showPage() {
    main.innerHTML = `<div class="card" style="max-width:620px"><h3 style="margin-top:0">📝 صفحتي وأسعاري</h3>
      <div style="text-align:center"><img src="${imgSrc(ME.img_id)}" style="width:100px;height:100px;border-radius:50%;object-fit:cover">
      <div><label class="f">الصورة الشخصية 📷</label><input type="file" id="tAvatar" accept="image/*"></div></div>
      <label class="f">نبذة عنك وخبرتك</label><textarea id="tBio">${esc(ME.bio || '')}</textarea>
      <div class="row2">
        <div><label class="f">سعر البرايفت (${cur()}) ${S.enable_private !== '1' ? '(متوقف)' : ''}</label><input id="tPp" type="number" min="0" value="${ME.price_private || 0}"></div>
        <div><label class="f">سعر المجموعة (${cur()}) ${S.enable_groups !== '1' ? '(متوقف)' : ''}</label><input id="tPg" type="number" min="0" value="${ME.price_group || 0}"></div>
      </div>
      <label class="f">رابط الاجتماع الافتراضي 🎥 (زووم/ميت)</label><input id="tMeet" dir="ltr" value="${esc(ME.meet_link || '')}" placeholder="https://...">
      <label class="f">مواعيدك المتاحة 📅</label><input id="tSched" value="${esc(ME.schedule_text || '')}" placeholder="مثال: السبت–الخميس 4–9 مساءً">
      <label class="f">واتساب التواصل 💬</label><input id="tWa" value="${esc(ME.whatsapp || '')}">
      <label class="f">فيديو تعريفي (رابط يوتيوب — اختياري) 🎬</label><input id="tVid" dir="ltr" value="${esc(ME.video_url || '')}">
      <button class="btn btn-p btn-big" id="tSave">حفظ ✅</button>
      <div class="share-row">
        <button class="btn btn-w" onclick="shareMyPage()">مشاركة صفحتي واتساب 💬</button>
        <button class="btn btn-b" id="copyPage">📋 نسخ رابط صفحتي</button>
      </div>
      <p class="hint">👁 <a href="/teacher.html?id=${ME.id}" target="_blank">معاينة صفحتي كما يراها الطلاب</a></p>
    </div>`;
    $('copyPage').onclick = async () => {
      try { await navigator.clipboard.writeText(location.origin + '/teacher.html?id=' + ME.id); toast('اتنسخ الرابط 📋', 2000, 'ok'); }
      catch { toast('انسخ الرابط يدويًا من المعاينة', 3000, 'err'); }
    };
    $('tAvatar').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const du = await compressImage(f);
        const j = await api('/api/t/image', 'POST', { data: du.split(',')[1], mime: 'image/jpeg' });
        toast(j.ok ? 'اترفعت الصورة ✅' : (j.error || 'خطأ'));
        if (j.ok) { ME.img_id = j.img_id; showPage(); }
      } catch { toast('الصورة مش صالحة'); }
    };
    $('tSave').onclick = async () => {
      const j = await api('/api/t/profile', 'PUT', {
        bio: $('tBio').value, price_private: $('tPp').value, price_group: $('tPg').value,
        meet_link: $('tMeet').value, schedule_text: $('tSched').value,
        whatsapp: $('tWa').value, video_url: $('tVid').value
      });
      toast(j.ok ? 'اتحفظ ✅' : (j.error || 'خطأ'));
      if (j.ok) loadMe();
    };
  }

  function showPw() {
    main.innerHTML = `<div class="card" style="max-width:480px"><h3 style="margin-top:0">🔐 تغيير كلمة المرور</h3>
      <label class="f">الحالية</label><input id="pwOld" type="password">
      <label class="f">الجديدة</label><input id="pwNew" type="password">
      <button class="btn btn-p btn-big" id="pwGo">تغيير</button></div>`;
    eyeFor('pwOld'); eyeFor('pwNew');
    $('pwGo').onclick = async () => {
      const j = await api('/api/t/password', 'PUT', { old: $('pwOld').value, next: $('pwNew').value });
      toast(j.ok ? 'اتغيرت ✅' : (j.error || 'خطأ'));
    };
  }
  const wantTab = new URLSearchParams(location.search).get('tab');
  const wantBtn = wantTab && document.querySelector(`#tTabs button[data-t="${wantTab}"]`);
  if (wantBtn) wantBtn.click(); else showBooks();
})();
