/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return fail('unauthorized', 401);
  const rows = getDb().prepare('SELECT id,username,role,disabled,created_at FROM users ORDER BY id').all();
  return NextResponse.json({ users: rows, isAdmin: user.role === 'admin' });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== 'admin') return fail('forbidden', 403);
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) return fail('id required');
  const db = getDb();
  const target = db.prepare('SELECT id,role FROM users WHERE id=?').get(id) as
    | { id: number; role: string }
    | undefined;
  if (!target) return fail('not found', 404);
  if (target.id === user.id) return fail('cannot modify self', 400);
  if (typeof body.password === 'string' && body.password.length >= 6) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = await import('bcryptjs');
    db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(body.password, 10), id);
  }
  if (body.role === 'admin' || body.role === 'user') db.prepare('UPDATE users SET role=? WHERE id=?').run(body.role, id);
  if (typeof body.disabled === 'number') {
    db.prepare('UPDATE users SET disabled=? WHERE id=?').run(body.disabled ? 1 : 0, id);
    if (body.disabled) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== 'admin') return fail('forbidden', 403);
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id || id === user.id) return fail('invalid id', 400);
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
