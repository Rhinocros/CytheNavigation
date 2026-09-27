/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextResponse } from 'next/server';
import { currentUser, type SessionUser } from './auth';

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return u;
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const u = await requireUser();
  if (u instanceof NextResponse) return u;
  if (u.role !== 'admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return u;
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
