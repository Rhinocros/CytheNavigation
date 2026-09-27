/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */

/**
 * 进程内滑动窗口限速器（单实例部署够用；多实例需换共享存储）。
 * 用于登录爆破防护与缩略图生成触发限流，防止无界 Map 占用内存设有键数量上限。
 */
type Entry = { hits: number[] };

const store = new Map<string, Entry>();
const MAX_KEYS = 10_000;

function prune(now: number, windowMs: number) {
  for (const [key, e] of store) {
    e.hits = e.hits.filter((t) => now - t < windowMs);
    if (e.hits.length === 0) store.delete(key);
  }
}

/** 记录一次命中；返回是否仍允许（窗口内未超上限） */
export function rateHit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (store.size >= MAX_KEYS) prune(now, windowMs);
  let e = store.get(key);
  if (!e) {
    // 达到上限且剪枝后仍满：本轮直接拒绝，避免内存无界增长
    if (store.size >= MAX_KEYS) return false;
    e = { hits: [] };
    store.set(key, e);
  }
  e.hits = e.hits.filter((t) => now - t < windowMs);
  if (e.hits.length >= limit) return false;
  e.hits.push(now);
  return true;
}
