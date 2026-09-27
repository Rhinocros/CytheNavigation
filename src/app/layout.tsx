/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers, type Accent } from '@/components/providers';
import { SiteFooter } from '@/components/site-footer';
import type { SessionUser } from '@/lib/auth';
import { currentUser } from '@/lib/auth';
import { getSetting, getUserPrefs } from '@/lib/db';
import type { Locale } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const isEn = store.get('cythe_locale')?.value === 'en';
  let title = isEn ? 'Cythe Navigation' : 'Cythe | 循息导航';
  let logo = '';
  try {
    if (!isEn) title = getSetting('site_title', title) || title;
    logo = getSetting('logo_image');
  } catch {
    /* db not ready during static phase */
  }
  return {
    title,
    description: isEn ? 'Local-first self-hosted service navigation' : '本地优先的自托管服务导航页',
    icons: logo ? { icon: `/api/asset/logo?v=${encodeURIComponent(logo)}` } : undefined,
  };
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  let locale = (store.get('cythe_locale')?.value === 'en' ? 'en' : 'zh') as Locale;
  let mode: 'light' | 'dark' = store.get('cythe_mode')?.value === 'light' ? 'light' : 'dark';
  let accent = (store.get('cythe_accent')?.value || 'indigo') as Accent;
  let user: SessionUser | null = null;
  try {
    user = await currentUser();
  } catch {
    user = null;
  }
  // 账户偏好优先于 cookie：同一账户登录时按账户设置显示
  let prefs = null;
  if (user) {
    try {
      prefs = getUserPrefs(user.id);
    } catch {
      prefs = null;
    }
    if (prefs) {
      if (prefs.theme_mode === 'light' || prefs.theme_mode === 'dark') mode = prefs.theme_mode;
      if (['indigo', 'graphite', 'forest', 'sand'].includes(prefs.accent)) accent = prefs.accent as Accent;
      if (prefs.locale === 'zh' || prefs.locale === 'en') locale = prefs.locale as Locale;
    }
  }
  const bg = getSetting('bg_image');
  const logoImage = getSetting('logo_image');
  const logoSrc = logoImage ? `/api/asset/logo?v=${encodeURIComponent(logoImage)}` : '/logo.png';
  return (
    <html
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      data-mode={mode}
      data-accent={accent}
      suppressHydrationWarning
    >
      <body>
        {bg ? <div className="bg-photo" style={{ backgroundImage: `url(/api/asset/bg?v=${encodeURIComponent(bg)})` }} /> : null}
        <Providers initial={{ locale, mode, accent, user, prefs, logo: logoSrc }}>
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
