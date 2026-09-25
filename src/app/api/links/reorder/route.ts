import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Persist drag-and-drop order: body { ids: number[] } → sort = index */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail('unauthorized', 401);
  if (user.role !== 'admin' && getSetting('user_can_add', '1') !== '1') {
    return fail('forbidden', 403);
  }
  const body = await req.json().catch(() => null);
  const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
  if (!ids.length) return fail('bad ids');
  const db = getDb();
  const stmt = db.prepare('UPDATE links SET sort=? WHERE id=?');
  db.transaction(() => {
    ids.forEach((id, i) => stmt.run(i + 1, id));
  })();
  return NextResponse.json({ ok: true });
}
