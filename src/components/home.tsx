'use client';

import { HomeView, type HomePrefs } from './home-view';
import type { Group, Link } from '@/lib/types';

export function Home({
  links,
  groups,
  defaultView,
  favorites,
  prefs,
  loggedIn,
}: {
  links: Link[];
  groups: Group[];
  defaultView: string;
  favorites: number[];
  prefs: HomePrefs | null;
  loggedIn: boolean;
}) {
  return (
    <>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <HomeView
        initialLinks={links}
        initialGroups={groups}
        defaultView={defaultView}
        favorites={favorites}
        prefs={prefs}
        loggedIn={loggedIn}
      />
    </>
  );
}
