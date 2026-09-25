'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './providers';
import type { Group, Link } from '@/lib/types';
import { Header } from './header';

export type ViewMode = 'list' | 'grid' | 'card';

type Props = {
  initialLinks: Link[];
  initialGroups: Group[];
  defaultView: string;
};

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function iconSrc(l: Link) {
  return (
    l.icon ||
    `/api/asset/icon?url=${encodeURIComponent(l.url)}&name=${encodeURIComponent(l.name)}`
  );
}

export function HomeView({ initialLinks, initialGroups, defaultView }: Props) {
  const { t } = useApp();
  const [links] = useState(initialLinks);
  const groups = initialGroups;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(-1);
  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
    const saved = localStorage.getItem('cythe_view') as ViewMode | null;
    if (saved === 'list' || saved === 'grid' || saved === 'card') setView(saved);
    else if (defaultView === 'list' || defaultView === 'card') setView(defaultView);
  }, [defaultView]);

  function setViewPersist(v: ViewMode) {
    setView(v);
    localStorage.setItem('cythe_view', v);
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return links.filter((l) => {
      if (group >= 0 && l.group_id !== group) return false;
      if (!kw) return true;
      return (
        l.name.toLowerCase().includes(kw) ||
        l.note.toLowerCase().includes(kw) ||
        l.url.toLowerCase().includes(kw)
      );
    });
  }, [links, q, group]);

  const grouped = useMemo(() => {
    if (group >= 0) return [{ g: groups.find((x) => x.id === group) ?? null, items: filtered }];
    const byG = new Map<number, Link[]>();
    for (const l of filtered) {
      const arr = byG.get(l.group_id) ?? [];
      arr.push(l);
      byG.set(l.group_id, arr);
    }
    const out: { g: Group | null; items: Link[] }[] = [];
    const rest = byG.get(0) ?? [];
    if (rest.length) out.unshift({ g: null, items: rest });
    byG.delete(0);
    for (const g of groups) {
      const items = byG.get(g.id);
      if (items?.length) out.push({ g, items });
      byG.delete(g.id);
    }
    return out;
  }, [filtered, groups, group]);

  const searchBox = (
    <div className="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search')}
        aria-label="search"
      />
    </div>
  );

  return (
    <>
      <Header right={searchBox} />
      <main className="container">
        <div className="grouptabs" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              className={`grouptab ${group === -1 ? 'active' : ''}`}
              onClick={() => setGroup(-1)}
            >
              {t('allGroups')}
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                className={`grouptab ${group === g.id ? 'active' : ''}`}
                onClick={() => setGroup(g.id)}
              >
                {g.color ? <span style={{ color: g.color }}>●</span> : null} {g.name}
              </button>
            ))}
          </div>
          <div className="segmented">
            {(['list', 'grid', 'card'] as ViewMode[]).map((v) => (
              <button
                key={v}
                className={view === v ? 'active' : ''}
                onClick={() => setViewPersist(v)}
                title={v === 'list' ? t('listView') : v === 'grid' ? t('gridView') : t('cardView')}
              >
                {v === 'list' ? '☰' : v === 'grid' ? '▦' : '⬒'}
              </button>
            ))}
          </div>
        </div>

        {links.length === 0 ? (
          <div className="empty">{t('emptyHome')}</div>
        ) : (
          grouped.map(({ g, items }) => (
            <section className="section" key={g?.id ?? 'none'}>
              <div className="section-head">
                <span className="section-bar" />
                <span className="section-title">{g?.name ?? t('ungrouped')}</span>
                <span className="section-count">{items.length}</span>
              </div>
              {/* key={view} forces remount → view-in animation plays on layout switch */}
              <div key={view} className="view-wrap">
                {view === 'list' ? (
                  <div className="list-wrap">
                    {items.map((l, i) => (
                      <ListRow key={l.id} link={l} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className={view === 'grid' ? 'grid-cards' : 'grid-cards-lg'}>
                    {items.map((l, i) => (
                      <Card key={l.id} link={l} index={i} big={view === 'card'} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))
        )}
        <div className="footer">Cythe Navigation · Self-hosted</div>
      </main>
    </>
  );
}

/* ---------- List row (read-only) ---------- */
function ListRow({ link, index }: { link: Link; index: number }) {
  return (
    <a
      className="list-row"
      href={link.url}
      target="_blank"
      rel="noreferrer"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <span className="favicon">
        <img src={iconSrc(link)} alt="" loading="lazy" />
      </span>
      <span className="list-name">{link.name}</span>
      <span className="list-note">{link.note || '—'}</span>
      <span className="list-url">{hostOf(link.url)}</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span className={`chip ${link.scope === 'external' ? 'chip-accent' : ''}`}>
          {link.scope === 'external' ? '外网' : '内网'}
        </span>
      </span>
    </a>
  );
}

/* ---------- Card (read-only) ---------- */
function Card({ link, index, big }: { link: Link; index: number; big: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <a
      ref={ref}
      className="card"
      href={link.url}
      target="_blank"
      rel="noreferrer"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
    >
      {big && (
        <span className="thumb">
          <img src={`/api/asset/thumb/${link.id}`} alt="" loading="lazy" />
        </span>
      )}
      <span className="card-top">
        <span className="favicon">
          <img src={iconSrc(link)} alt="" loading="lazy" />
        </span>
        <span>
          <span className="card-name" style={{ display: 'block' }}>
            {link.name}
          </span>
          <span className="card-url">
            {hostOf(link.url)}
            {link.scope === 'external' && (
              <span className="chip chip-accent" style={{ height: 18 }}>
                外网
              </span>
            )}
          </span>
        </span>
      </span>
      {link.note && <span className="card-note">{link.note}</span>}
    </a>
  );
}
