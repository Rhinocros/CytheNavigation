/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db';

const CACHE_DIR = path.join(DATA_DIR, 'icons');

export function iconCacheFile(url: string): string {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const host = safeHost(url) || 'local';
  return path.join(CACHE_DIR, crypto.createHash('md5').update(host).digest('hex') + '.img');
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function letterSvg(name: string, colorSeed?: string): string {
  const ch = (name.trim()[0] ?? '?').toUpperCase();
  let h = 210;
  const seed = colorSeed || name;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  const bg = `hsl(${h} 42% 46%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="${bg}"/><text x="32" y="41" font-family="sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
}

async function fetchBuf(u: string, timeoutMs = 4000): Promise<Buffer | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(u, { signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!/image|iconoctet/.test(ct)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100 || buf.length > 2 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

/** Try to discover the favicon URL for a site; returns buffer or null */
export async function fetchSiteIcon(url: string): Promise<{ buf: Buffer; mime: string } | null> {
  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return null;
  }
  const origin = `${base.protocol}//${base.host}`;
  // 1) parse html for <link rel="icon">
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const res = await fetch(origin, { signal: ac.signal });
    clearTimeout(t);
    if (res.ok) {
      const html = (await res.text()).slice(0, 200_000);
      const m =
        html.match(
          /<link[^>]+rel=["'](?:apple-touch-icon|shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i
        ) ||
        html.match(
          /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:apple-touch-icon|shortcut icon|icon)["']/i
        );
      if (m?.[1]) {
        let iu = m[1];
        try {
          iu = new URL(iu, origin).href;
        } catch {
          /* keep raw */
        }
        const buf = await fetchBuf(iu);
        if (buf) return { buf, mime: guessMime(iu, buf) };
      }
    }
  } catch {
    /* fall through */
  }
  // 2) default /favicon.ico
  const buf = await fetchBuf(`${origin}/favicon.ico`);
  if (buf) return { buf, mime: 'image/x-icon' };
  return null;
}

function guessMime(u: string, buf: Buffer): string {
  if (buf.subarray(0, 8).toString('hex').startsWith('89504e47')) return 'image/png';
  if (u.includes('.svg')) return 'image/svg+xml';
  if (buf.subarray(0, 3).toString('hex') === 'ffd8f') return 'image/jpeg';
  if (u.includes('.png')) return 'image/png';
  return 'image/x-icon';
}
