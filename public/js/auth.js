// auth.js — login + student register
(async () => {
  await shell('', `<div class="card" style="max-width:520px;margin:0 auto">
    <div class="tabs" style="justify-content:center">
      <button id="tabLogin" class="on">🔑 تسجيل الدخول</button>
      <button id="tabReg">➕ حساب طالب جديد</button>
    </div>
    <div id="paneLogin">
      <label class="f">أنا داخل كـ 👤</label>
      <select id="liRole"><option value="student">🎓 طالب</option><option value="teacher">👨‍🏫 معلم</option></select>
      <label class="f">رقم الموبايل 📱</label>
      <input id="liPhone" inputmode="tel" placeholder="رقم الموبايل المسجل">
      <label class="f">كلمة المرور 🔐</label>
      <input id="liPw" type="password" placeholder="كلمة المرور">
      <label style="display:flex;gap:6px;font-size:13px;margin-top:10px">
        <input type="checkbox" id="liRem" checked style="width:auto"> تذكرني على هذا الجهاز ✅
      </label>
      <button class="btn btn-p btn-big" id="liGo">دخول 🚀</button>
      <div style="text-align:center;margin-top:10px"><a href="javascript:void(0)" id="forgotLink">نسيت كلمة المرور؟ 🤔</a></div>
    </div>
    <div id="paneReg" style="display:none">
      <label class="f">اسم الطالب بالكامل 👦</label>
      <input id="rgName" placeholder="مثال: أحمد محمد علي">
      <div class="row2">
        <div><label class="f">موبايل الطالب 📱 <span id="rgPhReq"></span></label><input id="rgPhone" inputmode="tel" placeholder="01xxxxxxxxx"></div>
        <div><label class="f">موبايل ولي الأمر 👨‍👩‍👦 <span id="rgGhReq"></span></label><input id="rgGuardian" inputmode="tel" placeholder="01xxxxxxxxx"></div>
      </div>
      <div class="row2">
        <div><label class="f">الدولة 🌍</label><select id="rgCountry"></select></div>
        <div><label class="f">الصف الدراسي 🎒</label><select id="rgGrade"></select></div>
      </div>
      <label class="f">كلمة المرور 🔐</label>
      <input id="rgPw" type="password" placeholder="6 حروف على الأقل">
      <label style="display:flex;gap:6px;font-size:13px;margin-top:10px">
        <input type="checkbox" id="rgAccept" style="width:auto"> أوافق على
        <a href="/page.html?k=terms" target="_blank">شروط الاستخدام</a> و
        <a href="/page.html?k=privacy" target="_blank">سياسة الخصوصية</a>
      </label>
      <button class="btn btn-p btn-big" id="rgGo">إنشاء الحساب 🎉</button>
    </div>
  </div>`);

  const main = document.querySelector('.main');
  const next = new URLSearchParams(location.search).get('next') || '';
  const goNext = (role) => {
    if (next) { location.href = next; return; }
    location.href = role === 'teacher' ? '/tutor.html' : '/student.html';
  };
  if (ME) { goNext(ME.role); return; }

  // tabs
  $('tabLogin').onclick = () => { $('tabLogin').classList.add('on'); $('tabReg').classList.remove('on'); $('paneLogin').style.display = ''; $('paneReg').style.display = 'none'; };
  $('tabReg').onclick = () => { $('tabReg').classList.add('on'); $('tabLogin').classList.remove('on'); $('paneReg').style.display = ''; $('paneLogin').style.display = 'none'; };

  // register selects from settings
  $('rgCountry').innerHTML = '<option value="">اختار الدولة...</option>' + (S.countries || []).map(c => `<option>${esc(c)}</option>`).join('');
  $('rgGrade').innerHTML = '<option value="">اختار الصف...</option>' + (S.grades || []).map(g => `<option>${esc(g)}</option>`).join('');
  $('rgPhReq').textContent = S.req_student_phone === '1' ? '(إجباري *)' : '(اختياري)';
  $('rgGhReq').textContent = S.req_guardian_phone === '1' ? '(إجباري *)' : '(اختياري)';

  $('liGo').onclick = async () => {
    const btn = $('liGo');
    btn.disabled = true; btn.textContent = 'جاري الدخول... ⏳';
    const j = await api('/api/login', 'POST', {
      role: $('liRole').value, phone: $('liPhone').value,
      password: $('liPw').value, remember: $('liRem').checked
    });
    if (!j.ok) { toast(j.error || 'خطأ'); btn.disabled = false; btn.textContent = 'دخول 🚀'; return; }
    goNext(j.role);
  };
  $('rgGo').onclick = async () => {
    const btn = $('rgGo');
    btn.disabled = true; btn.textContent = 'جاري إنشاء الحساب... ⏳';
    const j = await api('/api/register', 'POST', {
      name: $('rgName').value, phone: $('rgPhone').value, guardian_phone: $('rgGuardian').value,
      country: $('rgCountry').value, grade: $('rgGrade').value,
      password: $('rgPw').value, accept: $('rgAccept').checked
    });
    if (!j.ok) { toast(j.error || 'خطأ'); btn.disabled = false; btn.textContent = 'إنشاء الحساب 🎉'; return; }
    toast('اتعمل حسابك بنجاح 🎉');
    setTimeout(() => goNext('student'), 600);
  };
  $('forgotLink').onclick = () => {
    const old = document.querySelector('.modal');
    if (old) old.remove();
    const d = document.createElement('div');
    d.className = 'modal show';
    const wa = (S.admin_whatsapp || '').replace(/\D/g, '');
    d.innerHTML = `<div class="mbox">
      <button class="mclose" id="fgX">✕</button>
      <h3 style="margin-top:0">🔑 استعادة كلمة المرور</h3>
      <p class="muted">اكتب رقم موبايلك المسجل وهنوصلك بالإدارة على واتساب تبعتلك باسورد جديد</p>
      <label class="f">أنا</label>
      <select id="fgRole"><option value="student">🎓 طالب</option><option value="teacher">👨‍🏫 معلم</option></select>
      <label class="f">رقم الموبايل المسجل 📱</label>
      <input id="fgPhone" inputmode="tel" placeholder="الرقم اللي سجلت بيه">
      ${wa ? '<button class="btn btn-w btn-big" id="fgGo">إرسال طلب الاستعادة واتساب 💬</button>'
        : '<p style="color:#dc2626">رقم واتساب الدعم غير مسجل حاليًا — حاول لاحقًا</p>'}
    </div>`;
    document.body.appendChild(d);
    $('fgX').onclick = () => d.remove();
    d.addEventListener('click', (e) => { if (e.target === d) d.remove(); });
    $('fgRole').value = $('liRole').value;
    $('fgPhone').value = $('liPhone').value;
    if ($('fgGo')) $('fgGo').onclick = () => {
      const ph = $('fgPhone').value.replace(/\D/g, '');
      if (ph.length < 7) { toast('اكتب رقم الموبايل المسجل صح'); return; }
      const who = $('fgRole').value === 'teacher' ? 'معلم' : 'طالب';
      const msg = `سلام عليكم 🙏 نسيت كلمة المرور — حساب ${who} — رقمي المسجل: ${ph} — اسم المنصة: ${S.academy_name}`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
      d.remove();
      toast('اتفتح واتساب — ابعت الرسالة والإدارة هترد عليك بباسورد جديد 🙏', 4000);
    };
  };
})();
