/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { AuthForm } from '@/components/auth-form';
import { hasAnyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  // 只有数据库里还没有任何用户时才展示"第一个账号将成为管理员"提示
  return <AuthForm mode="register" bootstrap={!hasAnyUser()} />;
}
