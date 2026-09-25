import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
