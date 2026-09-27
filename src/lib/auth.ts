/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDb, getSetting } from './db';

export const SESSION_COOKIE = 'cythe_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = {
  id: number;
  username: string;
  role: 'admin' | 'user';
};

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw: string, hash: string): boolean {
  return bcrypt.compareSync(pw, hash);
}

export function createUser(username: string, password: string, role: 'admin' | 'user') {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO users(username,pass_hash,role) VALUES(?,?,?)')
    .run(username, hashPassword(password), role);
  return Number(info.lastInsertRowid);
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)')
    .run(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserByToken(token);
}

export function findUserByToken(token: string): SessionUser | null {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const row = db
    .prepare(
      `SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token=? AND u.disabled=0`
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export function destroySession(token: string) {
  getDb().prepare('DELETE FROM sessions WHERE token=?').run(token);
}

/** Bootstrap: env ADMIN_USERNAME/ADMIN_PASSWORD, or first registered user becomes admin */
export function ensureAdmin() {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c;
  if (count > 0) return;
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (u && p) createUser(u, p, 'admin');
}

export function hasAnyUser(): boolean {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c > 0;
}

export function canRegister(): boolean {
  if (!hasAnyUser()) return true; // bootstrap: first user becomes admin
  return getSetting('allow_register', '1') === '1';
}

export function isPrivateHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return (
      h === 'localhost' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(h) &&
      (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        /^127\./.test(h))
    );
  } catch {
    return false;
  }
}
