'use client';

import { useApp } from './providers';

/** 全站底部版权信息（跟随语言切换） */
export function SiteFooter() {
  const { t, locale } = useApp();
  const year = new Date().getFullYear();
  const brand = locale === 'zh' ? 'Cythe | 循息导航' : 'Cythe Navigation';
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <img src="/logo.png" alt="Cythe" className="logo-mark" style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'cover' }} />
          <span>{brand}</span>
        </div>
        <div className="site-footer-tagline">{t('footerTagline')}</div>
        <div className="site-footer-copy">
          © {year} {brand}. {t('footerRights')}
        </div>
        <div className="site-footer-tech">{t('footerTech')}</div>
      </div>
    </footer>
  );
}
