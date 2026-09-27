/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { canRegister, clientIp, createSession, createUser, hasAnyUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { fail } from '@/lib/api';
import { getDb } from '@/lib/db';
import { rateHit } from '@/lib/rate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 注册频率限速：同一来源每小时最多 5 个账号，防批量注册/抢占首管理员
const REG_LIMIT = 5;
const REG_WINDOW_MS = 60 * 60_000;

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || !/^[\w.-]{2,32}$/.test(username))
    return fail('invalid_username');
  if (typeof password !== 'string' || password.length < 6)
    return fail('password_too_short');
  if (!rateHit(`register:${clientIp(req)}`, REG_LIMIT, REG_WINDOW_MS))
    return fail('too_many_attempts', 429);
  if (!canRegister()) return fail('registration_disabled', 403);
  const db = getDb();
  // 建号与首管理员判定放入同一事务：串行化并发注册，避免竞争出多个 admin
  let id: number | null = null;
  let role: 'user' | 'admin' = 'user';
  try {
    const info = db.transaction(() => {
      const r: 'user' | 'admin' = hasAnyUser() ? 'user' : 'admin';
      const newId = createUser(username, password, r);
      return { newId, r };
    })();
    id = info.newId;
    role = info.r;
  } catch {
    return fail('username_exists', 409);
  }
  if (id === null) return fail('username_exists', 409);
  const token = createSession(id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ user: { id, username, role } });
}
