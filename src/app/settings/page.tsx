/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { allSettings, getDb } from '@/lib/db';
import { SettingsUI, type UserRow } from '@/components/settings-ui';
import type { Group, Link } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const isAdmin = user.role === 'admin';
  const links = db.prepare('SELECT * FROM links ORDER BY sort,id').all() as Link[];
  const groups = db.prepare('SELECT * FROM groups ORDER BY sort,id').all() as Group[];
  const users = isAdmin
    ? (db
        .prepare('SELECT id,username,role,disabled,created_at FROM users ORDER BY id')
        .all() as UserRow[])
    : [];
  return (
    <SettingsUI me={user} links={links} groups={groups} settings={allSettings()} users={users} />
  );
}
