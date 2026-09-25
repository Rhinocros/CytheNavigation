import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail('unauthorized', 401);
  const body = await req.json().catch(() => null);
  if (!body?.name) return fail('name required');
  const db = getDb();
  const max = (db.prepare('SELECT MAX(sort) m FROM groups').get() as { m: number }).m ?? 0;
  const visibility = body.visibility === 'private' ? 'private' : 'public';
  const info = db
    .prepare('INSERT INTO groups(name,color,sort,visibility,owner_id) VALUES(?,?,?,?,?)')
    .run(
      String(body.name).slice(0, 80),
      String(body.color ?? ''),
      max + 1,
      visibility,
      visibility === 'private' ? user.id : null
    );
  return NextResponse.json({ id: info.lastInsertRowid });
}
