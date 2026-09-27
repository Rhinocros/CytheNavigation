/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import { NextRequest, NextResponse } from 'next/server';

/** 会话 token 固定为 64 位十六进制；边缘层只能做格式粗筛，真授权靠页面/接口的服务端校验 */
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('cythe_session')?.value;
  if (!token || !TOKEN_RE.test(token)) {
    if (pathname.startsWith('/settings')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/settings/:path*'],
};
