/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
'use client';

import { useApp } from './providers';

/** 全站底部版权信息（跟随语言切换）——版权注释不可删除 */
export function SiteFooter() {
  const { t, locale, logo } = useApp();
  const year = new Date().getFullYear();
  const brand = locale === 'zh' ? 'Cythe | 循息导航' : 'Cythe Navigation';
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <img src={logo} alt="Cythe" className="logo-mark" style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'cover' }} />
          <span>{brand}</span>
        </div>
        <div className="site-footer-tagline">{t('footerTagline')}</div>
        <div className="site-footer-copy">
          © {year} {brand}. {t('footerRights')}
        </div>
      </div>
    </footer>
  );
}
