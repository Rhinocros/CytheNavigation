/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';
import fs from 'node:fs';
import { thumbFile } from '@/lib/thumb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = { id: number; owner_id: number | null };

/**
 * 可编辑判定：管理员全量；普通用户仅限自己创建的条目。
 * 否则任何人可通过编辑把他人（甚至管理员）的条目劫持为己有。
 */
async function editable(id: number): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  const row = getDb().prepare('SELECT id,owner_id FROM links WHERE id=?').get(id) as Row | undefined;
  return !!row && row.owner_id === user.id;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) return fail('bad id');
  if (!(await editable(num))) return fail('forbidden', 403);
  const body = await req.json().catch(() => null);
  if (!body) return fail('bad body');
  const db = getDb();
  db.prepare(
    `UPDATE links SET group_id=?,name=?,url=?,note=?,icon=?,has_thumb=?,scope=?,sort=? WHERE id=?`
  ).run(
    Number(body.group_id ?? 0),
    String(body.name ?? '').slice(0, 120),
    String(body.url ?? '').slice(0, 500),
    String(body.note ?? '').slice(0, 500),
    String(body.icon ?? '').slice(0, 500),
    body.has_thumb ? 1 : 0,
    body.scope === 'external' ? 'external' : 'internal',
    Number(body.sort ?? 0),
    num
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) return fail('bad id');
  if (!(await editable(num))) return fail('forbidden', 403);
  getDb().prepare('DELETE FROM links WHERE id=?').run(num);
  // 一并清除收藏记录，避免留下指向已删除站点的孤儿数据
  getDb().prepare('DELETE FROM favorites WHERE link_id=?').run(num);
  fs.rmSync(thumbFile(num), { force: true });
  return NextResponse.json({ ok: true });
}
