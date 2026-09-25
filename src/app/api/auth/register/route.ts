import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { canRegister, createSession, createUser, hasAnyUser, SESSION_COOKIE } from '@/lib/auth';
import { fail } from '@/lib/api';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || !/^[\w.-]{2,32}$/.test(username))
    return fail('invalid_username');
  if (typeof password !== 'string' || password.length < 6)
    return fail('password_too_short');
  if (!canRegister()) return fail('registration_disabled', 403);
  const dup = getDb().prepare('SELECT id FROM users WHERE username=?').get(username);
  if (dup) return fail('username_exists', 409);
  const role = hasAnyUser() ? 'user' : 'admin';
  const id = createUser(username, password, role as 'user' | 'admin');
  const token = createSession(id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, path: '/', maxAge: 30 * 24 * 3600 });
  return NextResponse.json({ user: { id, username, role } });
}
