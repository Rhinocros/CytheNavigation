/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from './providers';
import { IconGear, IconGlobe, IconLogout, IconMenu, IconMoon, IconSearch, IconSun } from './icons';

export function Header({ right }: { right?: React.ReactNode }) {
  const { t, locale, setLocale, mode, setMode, user, setUser, logo, title } = useApp();
  const router = useRouter();
  const [mSearch, setMS] = useState(false);
  // 小屏下的折叠菜单：语言 / 主题 / 设置 / 登录退出收进一个图标按钮
  const [menuOpen, setMenuOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    // header 自带 backdrop-filter，会变成 fixed 后代的包含块，因此不用遮罩而是监听全局按下关闭
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return; // 交给按钮自己的 onClick 切换
      if (!popRef.current?.contains(target)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
    router.refresh();
  }

  function switchLocale() {
    setLocale(locale === 'zh' ? 'en' : 'zh');
    setMenuOpen(false);
  }
  function switchMode() {
    setMode(mode === 'dark' ? 'light' : 'dark');
    setMenuOpen(false);
  }

  return (
    <header className={'header' + (mSearch && right ? ' msearch' : '')}>
      <div className="container header-inner">
        <Link href="/" className="logo">
          <img src={logo} alt="Cythe" className="logo-mark" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
          <span>{title}</span>
        </Link>
        {right && <div className="header-slot">{right}</div>}
        <div className="header-actions">
          {right && (
            <button
              className="icon-btn msearch-btn"
              title={t('search')}
              aria-label={t('search')}
              onClick={() => setMS((v) => !v)}
            >
              <IconSearch />
            </button>
          )}
          <div className="header-desktop">
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
              {mode === 'dark' ? <IconSun /> : <IconMoon />}
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
          <button
            ref={btnRef}
            className={`icon-btn header-menu-btn ${menuOpen ? 'on' : ''}`}
            title={t('menu')}
            aria-label={t('menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <IconMenu />
          </button>
        </div>
      </div>
      {/* 弹层只在窄屏下渲染（桌面靠 CSS 隐藏，按钮本身也点不到） */}
      {menuOpen && (
        <div className="menu-pop" ref={popRef}>
          <nav className="header-menu">
            <button onClick={switchLocale}>
              <span className="nav-ico">
                <IconGlobe />
              </span>
              {locale === 'zh' ? 'English' : '简体中文'}
            </button>
            <button onClick={switchMode}>
              <span className="nav-ico">{mode === 'dark' ? <IconSun /> : <IconMoon />}</span>
              {mode === 'dark' ? t('lightMode') : t('darkMode')}
            </button>
            {user ? (
              <>
                <Link href="/settings" onClick={() => setMenuOpen(false)}>
                  <span className="nav-ico">
                    <IconGear />
                  </span>
                  {t('settings')}
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  <span className="nav-ico">
                    <IconLogout />
                  </span>
                  {t('logout')}
                  <span className="menu-sub">{user.username}</span>
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                <span className="nav-ico">
                  <IconLogout />
                </span>
                {t('login')}
              </Link>
            )}
          </nav>
        </div>
      )}
      {right && mSearch && <div className="container msearch-bar">{right}</div>}
    </header>
  );
}
