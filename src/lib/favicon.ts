/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db';
import { isBlockedHost, isLanProtectedHost } from './auth';

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
  // 属性值转义：外部传入的名称与地址不能破坏 SVG 结构
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ch = esc((name.trim()[0] ?? '?').toUpperCase());
  let h = 210;
  const seed = colorSeed || name;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  const bg = `hsl(${h} 42% 46%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="${bg}"/><text x="32" y="41" font-family="sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
}

async function fetchBuf(u: string, trusted: Trust, timeoutMs = 4000): Promise<Buffer | null> {
  try {
    const guard = guardTarget(u, trusted);
    if (!guard.ok) return null;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    // 不自动重定向：每一跳都重新校验目标，防止用 302 绕过主机检查
    const res = await fetch(u, { signal: ac.signal, redirect: 'manual' });
    clearTimeout(t);
    const followed = await followSafe(res, u, 3, (h) => guardHop(h, trusted));
    if (!followed) return null;
    if (!followed.ok) return null;
    const ct = followed.headers.get('content-type') ?? '';
    if (!/image|iconoctet/.test(ct)) return null;
    const buf = Buffer.from(await followed.arrayBuffer());
    if (buf.length < 100 || buf.length > 2 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

/** 信任级别：public=匿名请求者；user=已登录普通用户；admin=管理员（可访问内网设备与 *.local） */
export type Trust = 'public' | 'user' | 'admin';

/** 协议与主机校验：非管理员一律禁止访问服务器自身/元数据地址，匿名者额外禁止全部保留段 */
function guardTarget(u: string, trusted: Trust): { ok: boolean; url?: URL } {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false };
  const host = url.hostname;
  const blockMetadata = (h: string): boolean => {
    // 云元数据 / 链路本地：所有角色一律拦截（含十进制整数与 IPv6 内嵌 IPv4 写法）
    if (/^169\.254\./i.test(h)) return true;
    if (/^\d+$/.test(h)) {
      const n = Number(h);
      if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return true;
      if (((n >>> 24) & 255) === 169) return true;
    }
    const ip = h.toLowerCase();
    if (ip.includes(':')) {
      if (ip === '::' || ip === '::1') return true;
      const mapped = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped && /^169\.254\./i.test(mapped[1])) return true;
      if (/^fe80/i.test(ip)) return true;
    }
    return false;
  };
  if (trusted === 'admin') {
    // 导航目标本身就是内网设备；管理员仅禁元数据/链路本地与 mDNS 主机名（服务端 fetch 无法解析）
    if (blockMetadata(host)) return { ok: false };
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))
      return { ok: false };
  } else if (trusted === 'user') {
    // 已登录普通用户：LAN 工具允许内网目标，但禁止回环/链路本地等服务器自身地址
    if (isLanProtectedHost(host)) return { ok: false };
  } else {
    if (isBlockedHost(host)) return { ok: false };
  }
  return { ok: true, url };
}

function guardHop(u: string, trusted: Trust): boolean {
  return guardTarget(u, trusted).ok;
}

/** 手动跟随重定向，逐跳复验；超过次数或任意一跳违规则放弃 */
async function followSafe(
  res: Response,
  from: string,
  remaining: number,
  check: (href: string) => boolean
): Promise<Response | null> {
  let cur = res;
  let hops = remaining;
  while (hops-- > 0 && [301, 302, 303, 307, 308].includes(cur.status)) {
    const loc = cur.headers.get('location');
    if (!loc) return null;
    let next: URL;
    try {
      next = new URL(loc, from);
    } catch {
      return null;
    }
    if (!check(next.href)) return null;
    from = next.href;
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 4000);
      cur = await fetch(from, { signal: ac.signal, redirect: 'manual' });
      clearTimeout(t);
    } catch {
      return null;
    }
  }
  return cur;
}

/**
 * Try to discover the favicon URL for a site; returns buffer or null.
 * trusted：请求者是否为已登录用户（未登录时禁止探测内网/保留地址）。
 */
export async function fetchSiteIcon(
  url: string,
  trusted: Trust = 'user'
): Promise<{ buf: Buffer; mime: string } | null> {
  const guard = guardTarget(url, trusted);
  if (!guard.ok || !guard.url) return null;
  const base = guard.url;
  const hopCheck = (h: string) => guardHop(h, trusted);
  const origin = `${base.protocol}//${base.host}`;
  // 1) parse html for <link rel="icon">
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const res = await fetch(origin, { signal: ac.signal, redirect: 'manual' });
    clearTimeout(t);
    const followed = await followSafe(res, origin, 3, hopCheck);
    if (followed?.ok) {
      const html = (await followed.text()).slice(0, 200_000);
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
        if (hopCheck(iu)) {
          const buf = await fetchBuf(iu, trusted);
          if (buf) return { buf, mime: guessMime(iu, buf) };
        }
      }
    }
  } catch {
    /* fall through */
  }
  // 2) default /favicon.ico
  const icoUrl = `${origin}/favicon.ico`;
  if (hopCheck(icoUrl)) {
    const buf = await fetchBuf(icoUrl, trusted);
    if (buf) return { buf, mime: 'image/x-icon' };
  }
  return null;
}

function guessMime(u: string, buf: Buffer): string {
  if (buf.subarray(0, 8).toString('hex').startsWith('89504e47')) return 'image/png';
  if (u.includes('.svg')) return 'image/svg+xml';
  if (buf.subarray(0, 3).toString('hex') === 'ffd8f') return 'image/jpeg';
  if (u.includes('.png')) return 'image/png';
  return 'image/x-icon';
}
