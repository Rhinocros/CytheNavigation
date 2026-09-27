/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { requireAdmin, fail } from '@/lib/api';
import type { Trust } from '@/lib/favicon';
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

function letter(name: string, url: string) {
  // 名称仅来自查询参数，限长并交由 letterSvg 转义，避免超长内容与 SVG 结构破坏
  return new NextResponse(letterSvg(String(name || '').slice(0, 64), url.slice(0, 512)), {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' },
  });
}

/** 目标是否已录入本站（存在于 links 表）：作为普通用户强制刷新时的权限依据 */
function isKnownTarget(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    if (!host) return false;
    const db = getDb();
    const hit = db.prepare('SELECT 1 FROM links WHERE url=? LIMIT 1').get(url);
    if (hit) return true;
    // 同主机的已录入条目也视为可信（图标缓存本就按主机聚合）
    const like = db
      .prepare('SELECT 1 FROM links WHERE url LIKE ? LIMIT 1')
      .get(`${new URL(url).protocol}//${host}%`);
    return !!like;
  } catch {
    return false;
  }
}

function dropCache(cacheKey: string) {
  const dir = path.dirname(cacheKey);
  const base = path.basename(cacheKey, '.img');
  try {
    for (const f of fs.readdirSync(dir)) if (f.startsWith(base + '.')) fs.rmSync(path.join(dir, f));
  } catch {
    /* ignore */
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') ?? '';
  const name = searchParams.get('name') ?? url;
  const refresh = searchParams.get('refresh') === '1';
  const cacheKey = iconCacheFile(url || name);
  const cached = findCached(cacheKey);
  const user = await currentUser();

  // 强制刷新仅登录用户可用；管理员可刷新任意目标，普通用户限已录入站点或安全目标
  if (refresh) {
    if (!user) return fail('unauthorized', 401);
    if (user.role !== 'admin' && !isKnownTarget(url)) return fail('forbidden', 403);
    dropCache(cacheKey);
  } else if (cached) {
    return serve(fs.readFileSync(cached), EXT_MIME[path.extname(cached)] ?? 'image/png');
  }

  // 未登录：绝不由服务端发起外部请求，只回退到字母占位图（缓存命中的静态图仍可直接展示）
  if (!user) {
    if (cached) return serve(fs.readFileSync(cached), EXT_MIME[path.extname(cached)] ?? 'image/png');
    return letter(name, url);
  }

  // 已登录：按角色信任级抓取（管理员可访问内网设备；普通用户禁回环/元数据等服务器自身地址）
  const trust: Trust = user.role === 'admin' ? 'admin' : 'user';
  const hit = await fetchSiteIcon(url, trust);
  if (hit) {
    const out = cacheKey.replace(/\.img$/, MIME_EXT[hit.mime] ?? '.png');
    try {
      fs.writeFileSync(out, hit.buf);
    } catch {
      /* best-effort cache */
    }
    return serve(hit.buf, hit.mime);
  }
  return letter(name, url);
}

export async function POST(req: NextRequest) {
  // force refresh: drop cache files, then re-fetch（仅管理员，防止匿名者驱动服务端抓取）
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') ?? '';
  const cacheKey = iconCacheFile(url || req.headers.get('x-name') || url);
  dropCache(cacheKey);
  return GET(req);
}
