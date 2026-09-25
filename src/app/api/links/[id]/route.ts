import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/api';
import fs from 'node:fs';
import path from 'node:path';
import { THUMB_DIR } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = { id: number; owner_id: number | null };

async function editable(id: number): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  const row = getDb().prepare('SELECT id,owner_id FROM links WHERE id=?').get(id) as Row | undefined;
  return !!row && row.owner_id === user.id;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await editable(Number(id)))) return fail('forbidden', 403);
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
    String(body.icon ?? ''),
    body.has_thumb ? 1 : 0,
    body.scope === 'external' ? 'external' : 'internal',
    Number(body.sort ?? 0),
    Number(id)
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await editable(Number(id)))) return fail('forbidden', 403);
  getDb().prepare('DELETE FROM links WHERE id=?').run(Number(id));
  fs.rmSync(path.join(THUMB_DIR, `${id}.png`), { force: true });
  return NextResponse.json({ ok: true });
}
