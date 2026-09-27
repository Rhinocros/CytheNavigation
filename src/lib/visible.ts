/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { getDb } from './db';
import type { Group, Link } from './types';
import type { SessionUser } from './auth';

/**
 * 计算对当前用户可见的分组与站点。
 * 规则：
 * - 私有分组仅 owner / 管理员可见；
 * - 未分组（group_id=0）的链接不再无条件公开：有创建者的仅创建者 / 管理员可见，
 *   防止把私有分组里的链接移到未分组即变公开。
 */
export function isLinkVisible(
  l: Pick<Link, 'group_id' | 'owner_id'>,
  gmap: Map<number, Pick<Group, 'visibility' | 'owner_id'>>,
  user: SessionUser | null
): boolean {
  const g = gmap.get(l.group_id);
  if (!g) {
    // 未分组：公开仅限无主条目（预置 / 历史数据）
    return !l.owner_id;
  }
  if (g.visibility === 'public') return true;
  return !!user && (user.role === 'admin' || g.owner_id === user.id);
}

export function visibleData(user: SessionUser | null): { links: Link[]; groups: Group[] } {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM groups ORDER BY sort,id').all() as Group[];
  const links = db.prepare('SELECT * FROM links ORDER BY sort,id').all() as Link[];
  const gmap = new Map(groups.map((g) => [g.id, g]));
  const visibleGroups = groups.filter(
    (g) => g.visibility === 'public' || (user && (user.role === 'admin' || g.owner_id === user.id))
  );
  const vgIds = new Set(visibleGroups.map((g) => g.id));
  const visibleLinks = links.filter((l) => isLinkVisible(l, gmap, user));
  return { links: visibleLinks, groups: visibleGroups.filter((g) => vgIds.has(g.id)) };
}
