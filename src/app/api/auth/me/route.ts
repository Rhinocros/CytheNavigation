/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextResponse } from 'next/server';
import { canRegister, currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user, allowRegister: canRegister() });
}
