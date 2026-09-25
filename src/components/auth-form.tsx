'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/providers';
import { Header } from '@/components/header';
import type { TKey } from '@/lib/i18n';

const errMap: Record<string, TKey> = {
  bad_credentials: 'errBadCredentials',
  invalid_username: 'errInvalidUsername',
  password_too_short: 'errPasswordTooShort',
  username_exists: 'errUsernameExists',
  missing_fields: 'errMissingFields',
};

export function AuthForm({ mode, bootstrap = false }: { mode: 'login' | 'register'; bootstrap?: boolean }) {
  const { t, setUser } = useApp();
  const router = useRouter();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [password2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (mode === 'register' && password !== password2) {
      setErr(t('errPassMismatch'));
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.status === 403) {
      setClosed(true);
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      const code: string = j?.error ?? '';
      setErr(errMap[code] ? t(errMap[code]) : (code || t('opFailed')));
      return;
    }
    const j = await res.json().catch(() => null);
    if (j?.user) setUser(j.user);
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <Header />
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <div>
              <div className="logo" style={{ marginBottom: 18 }}>
                <img src="/logo.png" alt="Cythe" className="logo-mark" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
                <span>{t('brand')}</span>
              </div>
              <h1>{mode === 'login' ? t('welcomeBack') : t('createAccount')}</h1>
              <p>{mode === 'login' ? t('loginSubtitle') : (bootstrap ? t('registerFirstAdmin') : t('registerSubtitle'))}</p>
            </div>
            <p style={{ fontSize: 11 }}>⌘ Self-hosted · Local-first</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-tabs">
              <Link href="/login" className={mode === 'login' ? 'active' : ''}>
                {t('login')}
              </Link>
              <Link href="/register" className={mode === 'register' ? 'active' : ''}>
                {t('register')}
              </Link>
            </div>
            <div className="field">
              <label>{t('username')}</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setU(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>{t('password')}</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setP(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {mode === 'register' && (
              <div className="field">
                <label>{t('passwordConfirm')}</label>
                <input
                  className="input"
                  type="password"
                  value={password2}
                  onChange={(e) => setP2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}
            <div className="auth-error">{err}</div>
            <button className="btn btn-primary" style={{ height: 38, width: '100%' }} disabled={busy}>
              {busy ? '⏳' : mode === 'login' ? t('login') : t('register')}
            </button>
            {closed && <div className="auth-hint">🔒 {t('registerClosed')}</div>}
            {mode === 'register' && bootstrap && (
              <div className="auth-hint">ⓘ {t('registerFirstAdmin')}</div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
