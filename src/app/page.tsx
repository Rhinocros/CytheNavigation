import { currentUser, ensureAdmin } from '@/lib/auth';
import { getSetting, getUserFavorites, getUserPrefs } from '@/lib/db';
import { visibleData } from '@/lib/visible';
import { Home } from '@/components/home';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  ensureAdmin();
  const user = await currentUser();
  const { links, groups } = visibleData(user);
  const favorites = user ? getUserFavorites(user.id) : [];
  const p = user ? getUserPrefs(user.id) : null;
  return (
    <Home
      links={links}
      groups={groups}
      defaultView={getSetting('default_view', 'grid')}
      favorites={favorites}
      prefs={
        p
          ? { view: p.view, sort_dir: p.sort_dir, collapsed: p.collapsed }
          : null
      }
      loggedIn={!!user}
    />
  );
}
