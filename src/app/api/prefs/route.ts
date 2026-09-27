/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserPrefs, setUserPrefs } from '@/lib/db';
import { requireUser } from '@/lib/api';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ prefs: getUserPrefs(user.id) });
}

const ALLOWED = new Set(['theme_mode', 'accent', 'locale', 'view', 'sort_dir', 'collapsed']);

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('bad body');
  const partial: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) partial[k] = String(v);
  }
  setUserPrefs(user.id, partial);
  return NextResponse.json({ prefs: getUserPrefs(user.id) });
}
