/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, createUser, findUserByToken, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import { getDb, getSetting } from '@/lib/db';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return fail('missing_fields');
  const row = getDb()
    .prepare('SELECT * FROM users WHERE username=?')
    .get(username) as
    | { id: number; pass_hash: string; disabled: number }
    | undefined;
  if (!row || row.disabled || !verifyPassword(password, row.pass_hash))
    return fail('bad_credentials', 401);
  const token = createSession(row.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, path: '/', maxAge: 30 * 24 * 3600 });
  const u = findUserByToken(token)!;
  return NextResponse.json({ user: u, siteTitle: getSetting('site_title', '') });
}
