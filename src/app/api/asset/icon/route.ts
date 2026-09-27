/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { fetchSiteIcon, iconCacheFile, letterSvg } from '@/lib/favicon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** locate cached icon by hash prefix (actual file has real extension) */
function findCached(file: string): string | null {
  const dir = path.dirname(file);
  const base = path.basename(file, '.img');
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(base + '.')) return path.join(dir, f);
    }
  } catch {
    /* dir may not exist */
  }
  return null;
}

function serve(buf: Buffer, mime: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'content-type': mime, 'cache-control': 'public, max-age=86400' },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') ?? '';
  const name = searchParams.get('name') ?? url;
  const cacheKey = iconCacheFile(url || name);
  const cached = findCached(cacheKey);
  if (cached) {
    return serve(fs.readFileSync(cached), EXT_MIME[path.extname(cached)] ?? 'image/png');
  }
  const hit = await fetchSiteIcon(url);
  if (hit) {
    const out = cacheKey.replace(/\.img$/, MIME_EXT[hit.mime] ?? '.png');
    try {
      fs.writeFileSync(out, hit.buf);
    } catch {
      /* best-effort cache */
    }
    return serve(hit.buf, hit.mime);
  }
  return new NextResponse(letterSvg(name, url), {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  // force refresh: drop cache files, then re-fetch
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') ?? '';
  const cacheKey = iconCacheFile(url || req.headers.get('x-name') || url);
  const dir = path.dirname(cacheKey);
  const base = path.basename(cacheKey, '.img');
  try {
    for (const f of fs.readdirSync(dir)) if (f.startsWith(base + '.')) fs.rmSync(path.join(dir, f));
  } catch {
    /* ignore */
  }
  return GET(req);
}
