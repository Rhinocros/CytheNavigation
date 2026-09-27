/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { allSettings, getSetting, setSetting } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'allow_register',
  'user_can_add',
  'default_view',
  'site_title',
  'logo_image',
]);

export async function GET() {
  return NextResponse.json({ settings: allSettings() });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('bad body');
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) setSetting(k, String(v));
  }
  return NextResponse.json({ settings: allSettings(), saved: getSetting('site_title') });
}
