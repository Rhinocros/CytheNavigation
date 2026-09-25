import { getDb } from './db';
import type { Group, Link } from './types';
import type { SessionUser } from './auth';

export function visibleData(user: SessionUser | null): { links: Link[]; groups: Group[] } {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM groups ORDER BY sort,id').all() as Group[];
  const links = db.prepare('SELECT * FROM links ORDER BY sort,id').all() as Link[];
  const gmap = new Map(groups.map((g) => [g.id, g]));
  const visibleGroups = groups.filter(
    (g) => g.visibility === 'public' || (user && (user.role === 'admin' || g.owner_id === user.id))
  );
  const vgIds = new Set(visibleGroups.map((g) => g.id));
  const visibleLinks = links.filter((l) => {
    const g = gmap.get(l.group_id);
    if (!g) return true; // ungrouped
    if (g.visibility === 'public') return true;
    return !!user && (user.role === 'admin' || g.owner_id === user.id);
  });
  return { links: visibleLinks, groups: visibleGroups.filter((g) => vgIds.has(g.id)) };
}
