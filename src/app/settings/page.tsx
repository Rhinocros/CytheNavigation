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
  // 站点管理仅限自己创建的条目：不把全站数据（含他人/内网条目）下发到普通用户浏览器
  const links = isAdmin
    ? (db.prepare('SELECT * FROM links ORDER BY sort,id').all() as Link[])
    : (db
        .prepare('SELECT * FROM links WHERE owner_id=? ORDER BY sort,id')
        .all(user.id) as Link[]);
  // 分组管理：管理员全量；普通用户仅限自己拥有的分组
  const groups = isAdmin
    ? (db.prepare('SELECT * FROM groups ORDER BY sort,id').all() as Group[])
    : (db
        .prepare("SELECT * FROM groups WHERE owner_id=? AND visibility='private' ORDER BY sort,id")
        .all(user.id) as Group[]);
  const users = isAdmin
    ? (db
        .prepare('SELECT id,username,role,disabled,created_at FROM users ORDER BY id')
        .all() as UserRow[])
    : [];
  // 系统设置（开关/标题/图片）仅管理员可见可改
  const settings = isAdmin ? allSettings() : {};
  return (
    <SettingsUI
      me={user}
      links={links}
      groups={groups}
      settings={settings}
      users={users}
    />
  );
}
