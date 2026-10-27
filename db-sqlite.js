// db-sqlite.js — Local dev database (Node only). NEVER imported by worker.js
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DDL_SQLITE = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT DEFAULT '', guardian_phone TEXT DEFAULT '',
    country TEXT DEFAULT '', grade TEXT DEFAULT '', password TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '',
    subject TEXT DEFAULT '', bio TEXT DEFAULT '', img_id INTEGER DEFAULT 0,
    video_url TEXT DEFAULT '', price_private REAL DEFAULT 0, price_group REAL DEFAULT 0,
    meet_link TEXT DEFAULT '', schedule_text TEXT DEFAULT '',
    commission REAL DEFAULT -1, active INTEGER DEFAULT 1, featured INTEGER DEFAULT 0,
    rating REAL DEFAULT 0, ratings_count INTEGER DEFAULT 0, password TEXT DEFAULT '',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS teacher_apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '',
    subject TEXT DEFAULT '', bio TEXT DEFAULT '',
    price_private REAL DEFAULT 0, price_group REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL, subject TEXT DEFAULT '', grade TEXT DEFAULT '',
    price REAL DEFAULT 0, max_seats INTEGER DEFAULT 8,
    schedule_text TEXT DEFAULT '', meet_link TEXT DEFAULT '', active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE, student_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL,
    kind TEXT DEFAULT 'private', group_id INTEGER DEFAULT 0,
    slot TEXT DEFAULT '', price REAL DEFAULT 0,
    commission_pct REAL DEFAULT 0, teacher_amt REAL DEFAULT 0,
    pay_method TEXT DEFAULT '', pay_proof TEXT DEFAULT '', pay_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'scheduled', meet_link TEXT DEFAULT '', student_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, student_id INTEGER NOT NULL,
    pay_method TEXT DEFAULT '', pay_proof TEXT DEFAULT '', pay_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(group_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL,
    amount REAL DEFAULT 0, method TEXT DEFAULT '', account TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL, booking_id INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 5, comment TEXT DEFAULT '', approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, mime TEXT DEFAULT 'image/jpeg',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
];

export function createSqliteDb() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, 'taleem.db'));
  db.pragma('journal_mode = WAL');

  async function q(strings, ...values) {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `?${strings[i + 1]}`;
    const stmt = db.prepare(text);
    if (/^\s*select/i.test(text)) return { rows: stmt.all(...values) };
    if (/returning\s+id/i.test(text)) {
      const row = stmt.get(...values);
      return { rows: row ? [row] : [] };
    }
    stmt.run(...values);
    return { rows: [] };
  }

  const SCHEMA_V = '1';
  async function init() {
    try {
      const r = db.prepare(`SELECT value FROM settings WHERE key = 'schema_v'`).get();
      if (r && r.value === SCHEMA_V) return;
    } catch { /* fresh DB */ }
    for (const stmt of DDL_SQLITE) db.exec(stmt);
    db.prepare(`INSERT INTO settings(key,value) VALUES('schema_v',?) ON CONFLICT(key) DO UPDATE SET value=?`).run(SCHEMA_V, SCHEMA_V);
  }

  return { q, init, pgLike: false };
}
