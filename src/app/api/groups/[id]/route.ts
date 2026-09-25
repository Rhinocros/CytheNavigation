import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function editable(id: number): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  const g = getDb().prepare('SELECT owner_id FROM groups WHERE id=?').get(id) as
    | { owner_id: number | null }
    | undefined;
  return !!g && g.owner_id === user.id;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await editable(Number(id)))) return fail('forbidden', 403);
  const body = await req.json().catch(() => null);
  if (!body?.name) return fail('name required');
  getDb()
    .prepare('UPDATE groups SET name=?,color=?,sort=?,visibility=? WHERE id=?')
    .run(
      String(body.name).slice(0, 80),
      String(body.color ?? ''),
      Number(body.sort ?? 0),
      body.visibility === 'private' ? 'private' : 'public',
      Number(id)
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await editable(Number(id)))) return fail('forbidden', 403);
  const db = getDb();
  db.prepare('DELETE FROM groups WHERE id=?').run(Number(id));
  db.prepare('UPDATE links SET group_id=0 WHERE group_id=?').run(Number(id));
  return NextResponse.json({ ok: true });
}
