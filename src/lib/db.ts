/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbs');

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  owner_id INTEGER
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  has_thumb INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'internal',
  sort INTEGER NOT NULL DEFAULT 0,
  owner_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, link_id)
);
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id INTEGER PRIMARY KEY,
  theme_mode TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT '',
  view TEXT NOT NULL DEFAULT '',
  sort_dir TEXT NOT NULL DEFAULT 'asc',
  collapsed TEXT NOT NULL DEFAULT '[]'
);
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('allow_register','1'),
  ('user_can_add','1'),
  ('default_view','grid'),
  ('site_title','Cythe | 循息导航');
`;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, 'cythe.db'));
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function getSetting(key: string, fallback = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key=?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
}

export function allSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key,value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* ---------- user prefs (per-account) ---------- */
export type UserPrefs = {
  theme_mode: string;
  accent: string;
  locale: string;
  view: string;
  sort_dir: string;
  collapsed: string;
};

export function getUserPrefs(userId: number): UserPrefs | null {
  const row = getDb()
    .prepare(
      'SELECT theme_mode,accent,locale,view,sort_dir,collapsed FROM user_prefs WHERE user_id=?'
    )
    .get(userId) as UserPrefs | undefined;
  return row ?? null;
}

const PREF_COLS = new Set(['theme_mode', 'accent', 'locale', 'view', 'sort_dir', 'collapsed']);

export function setUserPrefs(userId: number, partial: Record<string, string>) {
  const db = getDb();
  db.prepare(
    'INSERT INTO user_prefs(user_id) VALUES(?) ON CONFLICT(user_id) DO NOTHING'
  ).run(userId);
  for (const [k, v] of Object.entries(partial)) {
    if (!PREF_COLS.has(k)) continue;
    db.prepare(`UPDATE user_prefs SET ${k}=? WHERE user_id=?`).run(String(v), userId);
  }
}

export function getUserFavorites(userId: number): number[] {
  const rows = getDb()
    .prepare('SELECT link_id FROM favorites WHERE user_id=?')
    .all(userId) as { link_id: number }[];
  return rows.map((r) => r.link_id);
}
