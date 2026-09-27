/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/api';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await requireUser();
  if (u instanceof NextResponse) return u;
  const db = getDb();
  return NextResponse.json({
    exported_at: new Date().toISOString(),
    settings: Object.fromEntries(
      (db.prepare('SELECT key,value FROM settings').all() as { key: string; value: string }[]).map(
        (r) => [r.key, r.value]
      )
    ),
    groups: db.prepare('SELECT * FROM groups ORDER BY sort,id').all(),
    links: db.prepare('SELECT * FROM links ORDER BY sort,id').all(),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireUser();
  if (admin instanceof NextResponse) return admin;
  if (admin.role !== 'admin') return fail('forbidden', 403);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.links) || !Array.isArray(body.groups))
    return fail('invalid backup file');
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM links').run();
    db.prepare('DELETE FROM groups').run();
    for (const g of body.groups)
      db.prepare(
        'INSERT INTO groups(id,name,color,sort,visibility,owner_id) VALUES(?,?,?,?,?,?)'
      ).run(g.id ?? null, String(g.name), String(g.color ?? ''), Number(g.sort ?? 0), g.visibility === 'private' ? 'private' : 'public', g.owner_id ?? null);
    for (const l of body.links)
      db.prepare(
        `INSERT INTO links(id,group_id,name,url,note,icon,has_thumb,scope,sort,owner_id,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        l.id ?? null,
        Number(l.group_id ?? 0),
        String(l.name),
        String(l.url),
        String(l.note ?? ''),
        String(l.icon ?? ''),
        Number(l.has_thumb ?? 0),
        l.scope === 'external' ? 'external' : 'internal',
        Number(l.sort ?? 0),
        l.owner_id ?? null,
        String(l.created_at ?? new Date().toISOString())
      );
    for (const [k, v] of Object.entries(body.settings ?? {}))
      if (['allow_register', 'user_can_add', 'default_view', 'site_title'].includes(k))
        db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
  });
  tx();
  return NextResponse.json({ ok: true });
}
