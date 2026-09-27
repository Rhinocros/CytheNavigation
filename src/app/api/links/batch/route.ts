/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, THUMB_DIR } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = { id: number; owner_id: number | null };

/**
 * POST：站点批量操作。body = { action: 'delete' | 'move', ids: number[], group_id?: number }
 * 权限与单条接口保持一致：管理员可操作全部站点，普通用户仅限自己创建的站点。
 * 整批写入放在一个事务中；无权限或已不存在的条目直接跳过并在返回值中报告数量。
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail('unauthorized', 401);
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? '');
  if (action !== 'delete' && action !== 'move') return fail('unsupported action');
  const rawIds = Array.isArray(body?.ids) ? body.ids : null;
  if (!rawIds || rawIds.length === 0) return fail('no items selected', 422);
  if (rawIds.length > 500) return fail('too many items', 422);
  const ids = [
    ...new Set(
      (rawIds as unknown[]).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
  if (ids.length === 0) return fail('invalid ids');

  const db = getDb();
  const rows = db
    .prepare(`SELECT id, owner_id FROM links WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as Row[];
  const targets = (user.role === 'admin' ? rows : rows.filter((r) => r.owner_id === user.id)).map(
    (r) => r.id
  );
  // 跳过的条目 = 不存在 + 不属于当前用户
  const skipped = ids.length - targets.length;
  if (targets.length === 0) return fail('no editable items', 422);

  let groupId = 0;
  if (action === 'move') {
    groupId = Number(body?.group_id ?? 0) || 0;
    if (groupId !== 0 && !db.prepare('SELECT id FROM groups WHERE id=?').get(groupId)) {
      return fail('group not found', 422);
    }
  }

  db.transaction(() => {
    for (const id of targets) {
      if (action === 'delete') {
        // 收藏与站点表一起清理，避免留下孤儿记录
        db.prepare('DELETE FROM favorites WHERE link_id=?').run(id);
        db.prepare('DELETE FROM links WHERE id=?').run(id);
      } else {
        db.prepare('UPDATE links SET group_id=? WHERE id=?').run(groupId, id);
      }
    }
  })();

  if (action === 'delete') {
    for (const id of targets) fs.rmSync(path.join(THUMB_DIR, `${id}.png`), { force: true });
  }

  return NextResponse.json({ ok: true, action, affected: targets.length, skipped });
}
