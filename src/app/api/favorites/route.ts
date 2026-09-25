import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/api';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Toggle a favorite for the current user; returns the new state. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const linkId = Number(body?.link_id);
  if (!Number.isInteger(linkId) || linkId <= 0) return fail('bad link_id');
  const db = getDb();
  const exists = db
    .prepare('SELECT 1 FROM links WHERE id=?')
    .get(linkId);
  if (!exists) return fail('not_found', 404);
  const fav = db
    .prepare('SELECT 1 FROM favorites WHERE user_id=? AND link_id=?')
    .get(user.id, linkId);
  if (fav) {
    db.prepare('DELETE FROM favorites WHERE user_id=? AND link_id=?').run(user.id, linkId);
    return NextResponse.json({ favorite: false });
  }
  db.prepare('INSERT INTO favorites(user_id,link_id) VALUES(?,?)').run(user.id, linkId);
  return NextResponse.json({ favorite: true });
}
