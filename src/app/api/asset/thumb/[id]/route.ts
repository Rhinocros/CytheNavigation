/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { requireAdmin, fail } from '@/lib/api';
import { rateHit } from '@/lib/rate';
import { captureThumb, thumbFile } from '@/lib/thumb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inflight = new Map<number, Promise<boolean>>();
// 生成触发限速：首屏图片是并发子请求，窗口内允许一定批量，防止被循环刷 id 驱动无头浏览器
const GEN_LIMIT = 30;
const GEN_WINDOW_MS = 60_000;

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0)
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const file = thumbFile(num);
  if (!fs.existsSync(file)) {
    const db = getDb();
    const row = db
      .prepare('SELECT name,url FROM links WHERE id=?')
      .get(num) as { name: string; url: string } | undefined;
    // 站点不存在时直接 404，避免为已删除的条目生成占位图
    if (!row) return new NextResponse(null, { status: 404 });
    // 缓存未命中时，生成会驱动服务端浏览器：仅登录用户可触发，并按 id 限速
    const user = await currentUser();
    if (!user) return placeholderFor(row.name, row.url);
    if (!rateHit(`thumb:${user.id}:${num}`, GEN_LIMIT, GEN_WINDOW_MS))
      return fail('too_many_requests', 429);
    let ok = false;
    try {
      ok = await generate(num, false);
    } catch {
      ok = false;
    }
    if (!ok || !fs.existsSync(file)) return placeholderFor(row.name, row.url);
  }
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' },
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 强制重新生成：仅管理员，且按账号限速
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) return fail('bad id');
  if (!rateHit(`thumb-post:${admin.id}:${num}`, 10, GEN_WINDOW_MS))
    return fail('too_many_requests', 429);
  fs.rmSync(thumbFile(num), { force: true });
  const ok = await generate(num, true);
  return NextResponse.json({ ok });
}

function placeholderFor(name: string, url: string) {
  return new NextResponse(placeholderSvg(name, url), {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** 属性值转义，站点名与地址里的特殊字符不能破坏 SVG 结构 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hostOfUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 40);
  }
}

/**
 * 默认占位图：截图生成失败（目标不可达、Chromium 不可用等）时返回。
 * 背景保持透明，由 .thumb 容器自身的主题渐变提供底色；因为内嵌 <img> 的 SVG 无法感知站点主题类，
 * 所以线条统一用中性灰蓝 #6b7a99 并提到较高不透明度，保证深浅两套主题下都能看清。
 * 图形为“浏览器窗口 + 地址栏”的线框，叠上站点名与主机地址，看上去像一张有意为之的预览卡。
 */
function placeholderSvg(name: string, url: string): string {
  const host = hostOfUrl(url);
  const raw = (name || host).trim();
  // 超长名称截断加省略号，避免文字掉出窗口线框外
  const title = esc(raw.length > 24 ? raw.slice(0, 24) + '…' : raw);
  const addr = esc(host.slice(0, 42));
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img">' +
    '<defs>' +
    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#5b7cfa" stop-opacity=".14"/>' +
    '<stop offset="1" stop-color="#9b5bfa" stop-opacity=".09"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect width="640" height="360" fill="url(#g)"/>' +
    '<g stroke="#6b7a99" stroke-opacity=".85" fill="none" stroke-width="2" stroke-linecap="round">' +
    '<rect x="96" y="66" width="448" height="228" rx="14"/>' +
    '<path d="M96 108 H544"/>' +
    '</g>' +
    '<g fill="#6b7a99" fill-opacity=".8">' +
    '<circle cx="122" cy="87" r="5"/><circle cx="140" cy="87" r="5"/><circle cx="158" cy="87" r="5"/>' +
    '</g>' +
    '<rect x="180" y="76" width="340" height="22" rx="11" fill="#6b7a99" fill-opacity=".16"/>' +
    '<text x="200" y="92" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif" font-size="13" fill="#6b7a99">' +
    addr +
    '</text>' +
    '<g stroke="#6b7a99" stroke-opacity=".7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="272" y="146" width="96" height="72" rx="10"/>' +
    '<circle cx="298" cy="170" r="8"/>' +
    // 折线各点均落在上方矩形（x 272~368 / y 146~218）内侧，不能伸出图标外框
    '<path d="M280 208 l22-20 16 14 14-10 26 16"/>' +
    '</g>' +
    '<text x="320" y="258" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif" font-size="16" font-weight="600" fill="#6b7a99">' +
    title +
    '</text>' +
    '</svg>'
  );
}
