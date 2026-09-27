/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDb, getSetting } from './db';

export const SESSION_COOKIE = 'cythe_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
/** 会话 token 固定为 64 位十六进制（crypto.randomBytes(32)）；用于在边缘层快速拒绝伪造值 */
export const TOKEN_RE = /^[0-9a-f]{64}$/;

/**
 * 会话 cookie 统一选项：
 * - httpOnly + sameSite=lax：阻断 JS 读取与跨站表单/子请求携带，缓解 CSRF；
 * - secure：默认关闭以兼容本机 http 开发，反向代理终结 TLS 后部署时设 COOKIE_SECURE=1 开启。
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: /^(1|true|on)$/i.test(process.env.COOKIE_SECURE ?? ''),
    path: '/',
    maxAge: 30 * 24 * 3600,
  };
}

export type SessionUser = {
  id: number;
  username: string;
  role: 'admin' | 'user';
};

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw: string, hash: string): boolean {
  return bcrypt.compareSync(pw, hash);
}

export function createUser(username: string, password: string, role: 'admin' | 'user') {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO users(username,pass_hash,role) VALUES(?,?,?)')
    .run(username, hashPassword(password), role);
  return Number(info.lastInsertRowid);
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)')
    .run(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserByToken(token);
}

export function findUserByToken(token: string): SessionUser | null {
  if (!TOKEN_RE.test(token)) return null; // 伪造格式直接短路，不进库
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const row = db
    .prepare(
      `SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token=? AND u.disabled=0`
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export function destroySession(token: string) {
  getDb().prepare('DELETE FROM sessions WHERE token=?').run(token);
}

/** Bootstrap: env ADMIN_USERNAME/ADMIN_PASSWORD, or first registered user becomes admin */
export function ensureAdmin() {
  if (/^(1|true|on)$/i.test(process.env.DISABLE_FIRST_ADMIN ?? '')) return;
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c;
  if (count > 0) return;
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (u && p) createUser(u, p, 'admin');
}

export function hasAnyUser(): boolean {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c > 0;
}

export function canRegister(): boolean {
  if (!hasAnyUser()) return !/^(1|true|on)$/i.test(process.env.DISABLE_FIRST_ADMIN ?? ''); // 空库引导；可用环境变量彻底关闭
  return getSetting('allow_register', '1') === '1';
}

/**
 * 判断主机名是否属于受限地址（回环 / 私网 / 链路本地 / 组播 / 云元数据等）。
 * 覆盖 IPv4（含十进制/十六进制等整数写法）与 IPv6（含内嵌 IPv4）；
 * 无法解析的畸形地址按受限处理（fail-closed）。
 * 注意：仅按字面 IP 判断，不解析域名 —— 域名指向内网的 DNS 重绑定场景需在实际请求层再校验。
 */
export function isBlockedHost(host: string): boolean {
  let h = host.toLowerCase().trim();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (!h) return true;
  if (
    h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') ||
    h === 'metadata.google.internal' || h === '0'
  )
    return true;
  // IPv4 字面量（含 2130706433 / 0x7f.0.0.1 等整数写法）
  let octets: number[] | null = null;
  if (/^\d+$/.test(h)) {
    const n = Number(h);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return true;
    octets = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  } else if (/^[0-9a-fx.]+$/i.test(h) && h.includes('.')) {
    const parts = h.split('.');
    if (parts.length === 4 && parts.every((p) => p !== '' && /^[0-9a-fx]+$/i.test(p))) {
      const nums = parts.map((p) => (/^0[xX]/.test(p) ? parseInt(p, 16) : parseInt(p, 10)));
      if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
      octets = nums;
    }
  }
  if (octets) {
    const [a, b] = octets;
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 || // 本机 / 私网 / 回环 / 组播及保留
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // 链路本地 + 云元数据 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) || // 192.0.0.0/24（含协议保留）
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) // 基准测试
    );
  }
  if (h.includes(':')) {
    const ip = h.toLowerCase();
    if (ip === '::' || ip === '::1') return true;
    const mapped = ip.match(/(\d+\.\d+\.\d+\.\d+)$/); // ::ffff:192.168.0.1 等内嵌 IPv4
    if (mapped) return isBlockedHost(mapped[1]);
    return /^f[cd]|^fe80/i.test(ip); // ULA fc00::/7 + 链路本地 fe80::/10
  }
  return true; // 未知形态一律拒绝
}

/**
 * LAN 场景放宽版：导航目标本身就是内网设备，RFC1918（10/8、172.16/12、192.168/16）与 CGNAT（100.64/10，Tailscale 等）放行；
 * 仍拦截服务器自身与云元数据等不应被服务端主动访问的段：回环、0.0.0.0/8、链路本地 169.254/16、组播/保留、*.local。
 */
export function isLanProtectedHost(host: string): boolean {
  let h = host.toLowerCase().trim();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal'))
    return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if ([a, b, Number(m[3]), Number(m[4])].some((n) => !Number.isFinite(n) || n > 255)) return true;
    return (
      a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254)
    );
  }
  if (h.includes(':')) {
    const ip = h.toLowerCase();
    if (ip === '::' || ip === '::1') return true;
    const mapped = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isLanProtectedHost(mapped[1]);
    return /^fe80/i.test(ip); // 链路本地
  }
  return false; // 普通域名（含内网域名）：由调用方结合白名单决定是否放行
}

export function isPrivateHost(url: string): boolean {
  try {
    return isBlockedHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

/** 取客户端 IP（配合可信反代使用，仅用作限速键） */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}
