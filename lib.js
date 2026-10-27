// lib.js — Pure shared helpers (Node + Cloudflare Workers). No Node-only imports!
const te = new TextEncoder(), td = new TextDecoder();

export const COUNTRIES = [
  'مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان',
  'الأردن', 'فلسطين', 'لبنان', 'سوريا', 'العراق', 'اليمن',
  'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'موريتانيا', 'السودان',
  'تركيا', 'أمريكا', 'كندا', 'بريطانيا', 'فرنسا', 'ألمانيا', 'أخرى'
];

export const PAY_AR = { pending: '⏳ بانتظار المراجعة', approved: '✅ مدفوع', rejected: '❌ مرفوض' };
export const BOOK_AR = {
  scheduled: '📅 مجدولة', done: '✔ تمت', cancelled: '❌ ملغية',
  missed_teacher: '⚠️ المدرس ماحضرش', missed_student: '⚠️ الطالب ماحضرش'
};
export const KIND_AR = { private: '👤 برايفت', group: '👥 مجموعة' };
export const WD_AR = { pending: '⏳ معلق', paid: '✅ تم التحويل', rejected: '❌ مرفوض' };

export function normalizePhone(phone) {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let p = String(phone || '').trim();
  p = p.replace(/[٠-٩]/g, d => ar.indexOf(d));
  p = p.replace(/[\s-]/g, '');
  return p;
}

export function cairoDayRange() {
  const now = new Date();
  const cairoWall = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const shift = cairoWall.getTime() - now.getTime();
  const start = new Date(cairoWall); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [new Date(start.getTime() - shift).toISOString(), new Date(end.getTime() - shift).toISOString()];
}

// ---------- WebCrypto: hashing + signed tokens (free & secure, no libs) ----------
function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function b64urlToBytes(b64url) {
  const b = b64url.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hashPassword(password, pepper) {
  const salt = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await sha256Hex(`${salt}:${password}:${pepper}`);
  return `v1$${salt}$${hash}`;
}
export async function verifyPassword(password, pepper, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 3 || parts[0] !== 'v1') return false;
    const calc = await sha256Hex(`${parts[1]}:${password}:${pepper}`);
    return timingSafeEq(calc, parts[2]);
  } catch { return false; }
}
function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function hmacB64url(data, secret) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(data));
  return b64urlFromBytes(new Uint8Array(sig));
}
export async function signToken(payload, secret) {
  const body = b64urlFromBytes(te.encode(JSON.stringify(payload)));
  return `${body}.${await hmacB64url(body, secret)}`;
}
export async function verifyToken(token, secret) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const good = await hmacB64url(body, secret);
    if (!timingSafeEq(good, sig)) return null;
    const p = JSON.parse(td.decode(b64urlToBytes(body)));
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}
export function bytesToBase64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
