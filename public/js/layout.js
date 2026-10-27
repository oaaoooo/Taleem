// layout.js — shared shell: bootstrap, header, sidebar, footer, helpers
let S = null, ME = null;
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v === null || v === undefined ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function api(url, method = 'GET', body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json().catch(() => ({ ok: false, error: 'خطأ في الاتصال' }));
}
function toast(msg, ms = 2800) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}
async function loadBootstrap() {
  try {
    const cached = JSON.parse(sessionStorage.getItem('tl_boot') || 'null');
    if (cached && Date.now() - cached.at < 60000) { S = cached.s; return S; }
  } catch { /* ignore */ }
  const j = await api('/api/bootstrap');
  if (j.ok) {
    S = j.s;
    try { sessionStorage.setItem('tl_boot', JSON.stringify({ at: Date.now(), s: S })); } catch { /* ignore */ }
  }
  return S;
}
async function loadMe() {
  const j = await api('/api/me');
  ME = j.ok ? { role: j.role, ...j.user } : null;
  return ME;
}
function starsHtml(rating, count) {
  const r = Math.round(Number(rating) || 0);
  return `<span class="stars">${'★'.repeat(r)}${'☆'.repeat(5 - r)}</span> <small class="muted">(${count || 0})</small>`;
}
function imgSrc(id) { return id ? '/img/' + id : '/images/avatar.svg'; }

async function shell(active, mainHtml, opts = {}) {
  await loadBootstrap();
  await loadMe();
  const name = esc(S ? S.academy_name : 'الأكاديمية');
  document.title = name;
  const dashLink = !ME ? ''
    : ME.role === 'student' ? '<a href="/student.html">🎓 لوحتي</a>'
    : ME.role === 'teacher' ? '<a href="/tutor.html">👨‍🏫 لوحة المعلم</a>'
    : '';
  const authBtn = !ME
    ? '<a class="btn btn-a" style="padding:7px 14px" href="/auth.html">دخول / حساب جديد</a>'
    : `<span class="u">أهلًا ${esc(ME.name)}</span> <button class="btn btn-g" style="padding:7px 14px" id="logoutBtn">خروج</button>`;
  const sideHtml = `<aside class="sidebar">
        <a href="/" data-a="home">🏠 الرئيسية</a>
        <a href="/#teachers" data-a="teachers">👨‍🏫 المعلمون</a>
        <a href="/#groups" data-a="groups">👥 المجموعات</a>
        <a href="/join.html" data-a="join">➕ انضم كمعلم</a>
        ${dashLink}
        <div class="sec">روابط مهمة</div>
        <a href="/page.html?k=terms">📜 شروط الاستخدام</a>
        <a href="/page.html?k=privacy">🔒 سياسة الخصوصية</a>
        <a href="/page.html?k=student">🎒 واجبات الطالب</a>
        <a href="/page.html?k=teacher">👨‍🏫 شروط المعلم</a>
      </aside>`;
  document.body.innerHTML = `
    <div class="topbar">
      <a class="brand" href="/">🎓 ${name}</a>
      <span class="sp"></span>${authBtn}
    </div>
    ${S && S.announcement ? `<div class="announce">${esc(S.announcement)}</div>` : ''}
    <div class="shell">
      ${opts.noSide ? '' : sideHtml}
      <main class="main">${mainHtml}</main>
    </div>
    <div class="footer">
      <a href="/page.html?k=terms">شروط الاستخدام</a> •
      <a href="/page.html?k=privacy">سياسة الخصوصية</a> •
      ${S && S.admin_whatsapp ? `<a href="https://wa.me/${esc(S.admin_whatsapp)}" target="_blank">💬 واتساب الدعم</a> •` : ''}
      <span>${name} © 2026</span>
    </div>
    <div class="toast"></div>`;
  document.querySelectorAll('.sidebar a[data-a]').forEach(a => {
    if (a.dataset.a === active) a.classList.add('on');
  });
  const lo = $('logoutBtn');
  if (lo) lo.onclick = async () => { await api('/api/logout', 'POST'); location.href = '/'; };
}

// compress + resize image client-side (free, keeps DB tiny)
function compressImage(file, maxDim = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      const sc = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * sc); h = Math.round(h * sc);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function waLink(num) {
  const n = String(num || '').replace(/\D/g, '');
  return n ? `https://wa.me/${n}` : '';
}
