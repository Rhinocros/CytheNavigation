/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  // 删除时需携带同名属性（path 等），否则部分浏览器不会清除 cookie
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return NextResponse.json({ ok: true });
}
