'use client';

import { useState } from 'react';
import { HomeView } from './home-view';
import type { Group, Link } from '@/lib/types';

export function Home({
  links,
  groups,
  defaultView,
}: {
  links: Link[];
  groups: Group[];
  defaultView: string;
}) {
  const [all] = useState(links);

  return (
    <>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <HomeView
        initialLinks={all}
        initialGroups={groups}
        defaultView={defaultView}
      />
    </>
  );
}
