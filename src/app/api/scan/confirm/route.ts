import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, fail } from '@/lib/api';
import { hostPortOf, SCAN_GROUP_COLOR, SCAN_GROUP_NAME } from '@/lib/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PreviewItem = { name: string; url: string; note: string };

/**
 * POST：将用户勾选确认的扫描结果写入单独的「内网扫描」分组。
 * 仅添加前端明确选中的条目；以 host:port 去重，避免冗余。
 * 返回创建后的分组与新增链接行，供前端立即更新本地状态（无需切页刷新）。
 */
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.items) ? body.items : null;
  if (!raw) return fail('items required');
  if (raw.length === 0) return fail('no items selected', 422);
  if (raw.length > 500) return fail('too many items', 422);

  // 清洗输入
  const items: PreviewItem[] = (raw as Record<string, unknown>[])
    .map((x) => ({
      name: String(x?.name ?? '').slice(0, 120),
      url: String(x?.url ?? '').slice(0, 500),
      note: String(x?.note ?? '').slice(0, 500),
    }))
    .filter((x) => x.name && x.url);
  if (items.length === 0) return fail('invalid items');

  const db = getDb();

  // 单独的扫描分组（不存在则创建）
  let group = db
    .prepare('SELECT * FROM groups WHERE name=? LIMIT 1')
    .get(SCAN_GROUP_NAME) as
    | { id: number; name: string; color: string; sort: number; visibility: string; owner_id: number | null }
    | undefined;
  if (!group) {
    const max = (db.prepare('SELECT MAX(sort) m FROM groups').get() as { m: number }).m ?? 0;
    const info = db
      .prepare('INSERT INTO groups(name,color,sort,visibility,owner_id) VALUES(?,?,?,?,?)')
      .run(SCAN_GROUP_NAME, SCAN_GROUP_COLOR, max + 1, 'public', null);
    group = db
      .prepare('SELECT * FROM groups WHERE id=?')
      .get(Number(info.lastInsertRowid)) as typeof group;
  }
  if (!group) return fail('group create failed', 500);

  // 以 host:port 去重
  const existing = db
    .prepare('SELECT url FROM links WHERE group_id=?')
    .all(group.id) as { url: string }[];
  const seen = new Set(existing.map((l) => hostPortOf(l.url)));

  let sort = (db.prepare('SELECT MAX(sort) m FROM links').get() as { m: number }).m ?? 0;
  const createdLinks: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const it of items) {
    const key = hostPortOf(it.url);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    sort += 1;
    const info = db
      .prepare(
        `INSERT INTO links(group_id,name,url,note,icon,has_thumb,scope,sort,owner_id)
         VALUES(?,?,?,?,?,?,?,?,?)`
      )
      .run(group.id, it.name, it.url, it.note, '', 0, 'internal', sort, user.id);
    const row = db
      .prepare('SELECT * FROM links WHERE id=?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;
    createdLinks.push(row);
  }

  return NextResponse.json({
    created: createdLinks.length,
    skipped,
    group,
    links: createdLinks,
  });
}
