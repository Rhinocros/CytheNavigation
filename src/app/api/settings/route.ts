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

/** 公开可读的键白名单：新增设置默认不对外，只有确认无敏感信息的才加入 */
const PUBLIC_KEYS = new Set([
  'allow_register',
  'default_view',
  'site_title',
  'logo_image',
  'bg_image',
]);

export async function GET() {
  const all = allSettings();
  const settings: Record<string, string> = {};
  for (const k of PUBLIC_KEYS) if (k in all) settings[k] = all[k];
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('bad body');
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) setSetting(k, String(v));
  }
  const all = allSettings();
  const saved: Record<string, string> = {};
  for (const k of PUBLIC_KEYS) if (k in all) saved[k] = all[k];
  return NextResponse.json({ settings: saved, title: getSetting('site_title') });
}
