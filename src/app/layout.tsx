import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers, type Accent } from '@/components/providers';
import type { SessionUser } from '@/lib/auth';
import { currentUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import type { Locale } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  let title = 'Cythe 导航';
  try {
    title = getSetting('site_title', title) || title;
  } catch {
    /* db not ready during static phase */
  }
  return { title, description: 'Local services navigation' };
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = (store.get('cythe_locale')?.value === 'en' ? 'en' : 'zh') as Locale;
  const mode = store.get('cythe_mode')?.value === 'light' ? 'light' : 'dark';
  const accent = (store.get('cythe_accent')?.value || 'indigo') as Accent;
  let user: SessionUser | null = null;
  try {
    user = await currentUser();
  } catch {
    user = null;
  }
  return (
    <html
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      data-mode={mode}
      data-accent={accent}
      suppressHydrationWarning
    >
      <body>
        <Providers initial={{ locale, mode, accent, user }}>{children}</Providers>
      </body>
    </html>
  );
}
