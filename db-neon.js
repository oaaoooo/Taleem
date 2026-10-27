// db-neon.js — Production database (Neon Postgres over HTTPS). Node + Workers safe.
import { neon } from '@neondatabase/serverless';

export function createNeonDb(url) {
  const sql = neon(url);

  async function q(strings, ...values) {
    const rows = await sql(strings, ...values);
    return { rows };
  }

  const SCHEMA_V = '1';
  async function init() {
    try {
      const v = await sql`SELECT value FROM settings WHERE key = 'schema_v'`;
      if (v[0] && v[0].value === SCHEMA_V) return;
    } catch { /* fresh DB */ }
    await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`;
    await sql`CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, phone TEXT DEFAULT '', guardian_phone TEXT DEFAULT '',
      country TEXT DEFAULT '', grade TEXT DEFAULT '', password TEXT NOT NULL,
      active INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '',
      subject TEXT DEFAULT '', bio TEXT DEFAULT '', img_id INTEGER DEFAULT 0,
      video_url TEXT DEFAULT '', price_private NUMERIC DEFAULT 0, price_group NUMERIC DEFAULT 0,
      meet_link TEXT DEFAULT '', schedule_text TEXT DEFAULT '',
      commission NUMERIC DEFAULT -1, active INTEGER DEFAULT 1, featured INTEGER DEFAULT 0,
      rating NUMERIC DEFAULT 0, ratings_count INTEGER DEFAULT 0, password TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS teacher_apps (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '',
      subject TEXT DEFAULT '', bio TEXT DEFAULT '',
      price_private NUMERIC DEFAULT 0, price_group NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL, subject TEXT DEFAULT '', grade TEXT DEFAULT '',
      price NUMERIC DEFAULT 0, max_seats INTEGER DEFAULT 8,
      schedule_text TEXT DEFAULT '', meet_link TEXT DEFAULT '', active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE, student_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL,
      kind TEXT DEFAULT 'private', group_id INTEGER DEFAULT 0,
      slot TEXT DEFAULT '', price NUMERIC DEFAULT 0,
      commission_pct NUMERIC DEFAULT 0, teacher_amt NUMERIC DEFAULT 0,
      pay_method TEXT DEFAULT '', pay_proof TEXT DEFAULT '', pay_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'scheduled', meet_link TEXT DEFAULT '', student_note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS group_members (
      id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, student_id INTEGER NOT NULL,
      pay_method TEXT DEFAULT '', pay_proof TEXT DEFAULT '', pay_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(group_id, student_id))`;
    await sql`CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL,
      amount REAL DEFAULT 0, method TEXT DEFAULT '', account TEXT DEFAULT '',
      status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL, booking_id INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 5, comment TEXT DEFAULT '', approved INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY, data TEXT, mime TEXT DEFAULT 'image/jpeg',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`INSERT INTO settings(key,value) VALUES('schema_v',${SCHEMA_V})
      ON CONFLICT(key) DO UPDATE SET value = ${SCHEMA_V}`;
  }

  return { q, init, pgLike: true };
}
