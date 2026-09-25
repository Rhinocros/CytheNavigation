import { currentUser, ensureAdmin } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { visibleData } from '@/lib/visible';
import { Home } from '@/components/home';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  ensureAdmin();
  const user = await currentUser();
  const { links, groups } = visibleData(user);
  return (
    <Home
      links={links}
      groups={groups}
      defaultView={getSetting('default_view', 'grid')}
    />
  );
}
