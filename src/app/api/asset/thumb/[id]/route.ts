/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import { getDb } from '@/lib/db';
import { captureThumb, thumbFile } from '@/lib/thumb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inflight = new Map<number, Promise<boolean>>();

async function generate(id: number, force: boolean): Promise<boolean> {
  const file = thumbFile(id);
  if (!force && fs.existsSync(file)) return true;
  const row = getDb().prepare('SELECT url FROM links WHERE id=?').get(id) as
    | { url: string }
    | undefined;
  if (!row) return false;
  let p = inflight.get(id);
  if (!p || force) {
    p = captureThumb(row.url, id);
    inflight.set(id, p);
  }
  const ok = await p;
  inflight.delete(id);
  if (ok) getDb().prepare('UPDATE links SET has_thumb=1 WHERE id=?').run(id);
  return ok;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!num) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const file = thumbFile(num);
  if (!fs.existsSync(file)) {
    let ok = false;
    try {
      ok = await generate(num, false);
    } catch {
      ok = false;
    }
    if (!ok || !fs.existsSync(file))
      return new NextResponse(placeholderSvg(), {
        headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' },
      });
  }
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' },
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  fs.rmSync(thumbFile(num), { force: true });
  const ok = await generate(num, true);
  return NextResponse.json({ ok });
}

function placeholderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="none"/><g fill="#5b7cfa" opacity="0.55"><rect x="20" y="18" width="600" height="26" rx="6" opacity="0.25"/><rect x="20" y="62" width="180" height="252" rx="8" opacity="0.15"/><rect x="220" y="62" width="400" height="14" rx="4" opacity="0.3"/><rect x="220" y="86" width="360" height="14" rx="4" opacity="0.2"/><rect x="220" y="110" width="380" height="14" rx="4" opacity="0.2"/><rect x="220" y="150" width="240" height="60" rx="8" opacity="0.15"/></g></svg>`;
}
