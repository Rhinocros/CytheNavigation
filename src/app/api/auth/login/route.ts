/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, findUserByToken, clientIp, sessionCookieOptions, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import { getDb, getSetting } from '@/lib/db';
import { fail } from '@/lib/api';
import { rateHit } from '@/lib/rate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 失败次数限速：同一来源对同一账号 15 分钟内最多尝试 10 次，防在线爆破
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return fail('missing_fields');
  const key = `login:${clientIp(req)}:${username.toLowerCase()}`;
  if (!rateHit(key, ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS))
    return fail('too_many_attempts', 429);
  const row = getDb()
    .prepare('SELECT * FROM users WHERE username=?')
    .get(username) as
    | { id: number; pass_hash: string; disabled: number }
    | undefined;
  if (!row || row.disabled || !verifyPassword(password, row.pass_hash))
    return fail('bad_credentials', 401);
  const token = createSession(row.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  const u = findUserByToken(token)!;
  return NextResponse.json({ user: u, siteTitle: getSetting('site_title', '') });
}
