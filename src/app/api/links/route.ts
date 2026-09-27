/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canWrite(user: { role: string } | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getSetting('user_can_add', '1') === '1';
}

export async function GET() {
  const user = await currentUser();
  const db = getDb();
  const links = db.prepare('SELECT * FROM links ORDER BY sort,id').all() as (Record<
    string,
    unknown
  > & { group_id: number })[];
  const groups = db.prepare('SELECT * FROM groups ORDER BY sort,id').all() as {
    id: number;
    visibility: string;
    owner_id: number | null;
  }[];
  const gmap = new Map(groups.map((g) => [g.id, g]));
  const visible = links.filter((l) => {
    const g = gmap.get(l.group_id);
    if (!g || g.visibility === 'public') return true;
    return user && (user.role === 'admin' || g.owner_id === user.id);
  });
  return NextResponse.json({ links: visible, groups, canWrite: canWrite(user) });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail('unauthorized', 401);
  if (!canWrite(user)) return fail('permission denied', 403);
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.url) return fail('name and url required');
  const db = getDb();
  const max = (db.prepare('SELECT MAX(sort) m FROM links').get() as { m: number }).m ?? 0;
  const info = db
    .prepare(
      `INSERT INTO links(group_id,name,url,note,icon,has_thumb,scope,sort,owner_id)
       VALUES(?,?,?,?,?,?,?,?,?)`
    )
    .run(
      Number(body.group_id) || 0,
      String(body.name).slice(0, 120),
      String(body.url).slice(0, 500),
      String(body.note ?? '').slice(0, 500),
      String(body.icon ?? ''),
      body.has_thumb ? 1 : 0,
      body.scope === 'external' ? 'external' : 'internal',
      max + 1,
      user.id
    );
  return NextResponse.json({ id: info.lastInsertRowid });
}
