/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getSetting, setSetting } from '@/lib/db';
import { requireAdmin, fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOGO_DIR = path.join(DATA_DIR, 'logo');
const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const MAX_BYTES = 2 * 1024 * 1024;

function logoFile(): string | null {
  const name = getSetting('logo_image');
  if (!name) return null;
  const file = path.join(LOGO_DIR, path.basename(name));
  return fs.existsSync(file) ? file : null;
}

/** Serve the custom logo; fall back to the bundled public/logo.png when none is set. */
export async function GET() {
  const file = logoFile() ?? path.join(process.cwd(), 'public', 'logo.png');
  if (!fs.existsSync(file)) return fail('not_found', 404);
  const buf = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': EXT_MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    },
  });
}

/** Upload a new site logo (multipart form-data, field "file"). Admin only. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('missing_file');
  if (file.size > MAX_BYTES) return fail('too_large', 413);
  const ext = path.extname(file.name || '').toLowerCase();
  if (!EXT_MIME[ext]) return fail('unsupported_type');
  fs.mkdirSync(LOGO_DIR, { recursive: true });
  // remove previous logo files（逐文件删除，不用 recursive 整目录）
  try {
    for (const f of fs.readdirSync(LOGO_DIR))
      fs.rmSync(path.join(LOGO_DIR, f), { force: true, recursive: false });
  } catch {
    /* dir may not exist yet */
  }
  const name = `logo-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(LOGO_DIR, name), Buffer.from(await file.arrayBuffer()));
  setSetting('logo_image', name);
  return NextResponse.json({ ok: true, name, logo: `/api/asset/logo?v=${Date.now()}` });
}

/** Remove the custom logo and restore the built-in one. Admin only. */
export async function DELETE() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    for (const f of fs.readdirSync(LOGO_DIR))
      fs.rmSync(path.join(LOGO_DIR, f), { force: true, recursive: false });
  } catch {
    /* ignore */
  }
  setSetting('logo_image', '');
  return NextResponse.json({ ok: true });
}
