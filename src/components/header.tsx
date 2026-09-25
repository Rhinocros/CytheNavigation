'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from './providers';

export function Header({ right }: { right?: React.ReactNode }) {
  const { t, locale, setLocale, mode, setMode, user, setUser } = useApp();
  const router = useRouter();
  const [mSearch, setMS] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
    router.refresh();
  }

  return (
    <header className={'header' + (mSearch && right ? ' msearch' : '')}>
      <div className="container header-inner">
        <Link href="/" className="logo">
          <img src="/logo.png" alt="Cythe" className="logo-mark" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
          <span>{t('brand')}</span>
        </Link>
        {right && <div className="header-slot">{right}</div>}
        <div className="header-actions">
          {right && (
            <button
              className="icon-btn msearch-btn"
              title={t('search')}
              onClick={() => setMS((v) => !v)}
            >
              ⌕
            </button>
          )}
          <button
            className="icon-btn"
            title={t('language')}
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
          >
            {locale === 'zh' ? '中' : 'EN'}
          </button>
          <button
            className="icon-btn"
            title={mode === 'dark' ? t('lightMode') : t('darkMode')}
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          >
            {mode === 'dark' ? '☀' : '☾'}
          </button>
          {user ? (
            <>
              <Link href="/settings" className="btn btn-sm">
                {t('settings')}
              </Link>
              <button className="btn btn-sm btn-ghost" onClick={logout} title={user.username}>
                {t('logout')}
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-sm">
              {t('login')}
            </Link>
          )}
        </div>
      </div>
      {right && mSearch && <div className="container msearch-bar">{right}</div>}
    </header>
  );
}
