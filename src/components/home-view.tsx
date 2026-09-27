/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './providers';
import type { Group, Link } from '@/lib/types';
import { Header } from './header';
import { IconStar } from './icons';

export type ViewMode = 'list' | 'grid' | 'card';
export type SortDir = 'asc' | 'desc';

export type HomePrefs = { view: string; sort_dir: string; collapsed: string };

type Props = {
  initialLinks: Link[];
  initialGroups: Group[];
  defaultView: string;
  favorites: number[];
  prefs: HomePrefs | null;
  loggedIn: boolean;
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

export function HomeView({ initialLinks, initialGroups, defaultView, favorites, prefs, loggedIn }: Props) {
  const { t } = useApp();
  const [links, setLinks] = useState(initialLinks);
  const groups = initialGroups;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(-1);
  const [view, setView] = useState<ViewMode>('grid');
  const [favs, setFavs] = useState<Set<number>>(() => new Set(favorites));
  const [sortDir, setSortDir] = useState<SortDir>(prefs?.sort_dir === 'desc' ? 'desc' : 'asc');
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try {
      const arr = JSON.parse(prefs?.collapsed || '[]') as number[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  });
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  /* ---------- per-account persistence ---------- */
  function persistPref(key: string, value: string) {
    if (!loggedIn) return;
    fetch('/api/prefs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }

  useEffect(() => {
    const saved = localStorage.getItem('cythe_view') as ViewMode | null;
    const pv = prefs?.view;
    // 账户偏好 > 本地缓存 > 站点默认
    if (pv === 'list' || pv === 'grid' || pv === 'card') setView(pv);
    else if (saved === 'list' || saved === 'grid' || saved === 'card') setView(saved);
    else if (defaultView === 'list' || defaultView === 'card') setView(defaultView);
  }, [defaultView, prefs]);

  function setViewPersist(v: ViewMode) {
    setView(v);
    localStorage.setItem('cythe_view', v);
    persistPref('view', v);
  }

  function toggleSortDir() {
    const d: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(d);
    persistPref('sort_dir', d);
  }

  function persistCollapsed(s: Set<number>) {
    persistPref('collapsed', JSON.stringify([...s]));
  }

  /* ---------- favorite ---------- */
  function toggleFav(id: number) {
    if (!loggedIn) return;
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    fetch('/api/favorites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ link_id: id }),
    }).catch(() => {});
  }

  /* ---------- collapse ---------- */
  function collapseAll() {
    const s = new Set<number>(grouped.map(({ g }) => g?.id ?? 0));
    setCollapsed(s);
    persistCollapsed(s);
  }
  function expandAll() {
    const s = new Set<number>();
    setCollapsed(s);
    persistCollapsed(s);
  }
  /** 当前分区是否已全部折叠（在渲染时 grouped 就绪后计算） */
  function isAllCollapsed(): boolean {
    return grouped.length > 0 && grouped.every(({ g }) => collapsed.has(g?.id ?? 0));
  }
  function toggleCollapseAll() {
    if (isAllCollapsed()) expandAll();
    else collapseAll();
  }
  function toggleSection(id: number) {
    const s = new Set(collapsed);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setCollapsed(s);
    persistCollapsed(s);
  }

  /* ---------- drag & drop reorder ---------- */
  function handleDrop(targetId: number) {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (from == null || from === targetId) return;
    const arr = [...links];
    const fi = arr.findIndex((l) => l.id === from);
    const tiOrig = arr.findIndex((l) => l.id === targetId);
    if (fi < 0 || tiOrig < 0 || fi === tiOrig) return;
    const [moved] = arr.splice(fi, 1);
    // 移除被拖项后目标的新下标
    const newTi = tiOrig > fi ? tiOrig - 1 : tiOrig;
    // 向下拖：落在目标之后（占据目标原位置）；向上拖：落在目标之前。修复“落位偏前一位”
    const insert = tiOrig > fi ? newTi + 1 : newTi;
    arr.splice(insert, 0, moved);
    setLinks(arr);
    fetch('/api/links/reorder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: arr.map((l) => l.id) }),
    }).catch(() => {});
  }

  const dragProps = (l: Link) =>
    loggedIn
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            setDragId(l.id);
            e.dataTransfer.effectAllowed = 'move';
          },
          onDragOver: (e: React.DragEvent) => {
            if (dragId != null && dragId !== l.id) {
              e.preventDefault();
              setOverId(l.id);
            }
          },
          onDragLeave: () => setOverId((v) => (v === l.id ? null : v)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            handleDrop(l.id);
          },
          onDragEnd: () => {
            setDragId(null);
            setOverId(null);
          },
        }
      : {};

  /* ---------- filtering & ordering ---------- */
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

  const order = useMemo(() => new Map(links.map((l, i) => [l.id, i])), [links]);

  /** 按存储顺序排列（desc 时反转）；收藏不再组内置顶，而是独立成顶部收藏组 */
  function arrange(items: Link[]): Link[] {
    return [...items].sort((a, b) => {
      const d = (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
      return sortDir === 'desc' ? -d : d;
    });
  }

  /** 当前筛选结果中的收藏项（跨分组），用于顶部独立收藏组 */
  const favLinks = useMemo(
    () => arrange(filtered.filter((l) => favs.has(l.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, favs, order, sortDir]
  );

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

  /** 渲染一组链接为当前视图（列表 / 网格 / 大卡片） */
  const renderItems = (items: Link[]) =>
    view === 'list' ? (
      <div className="list-wrap">
        {arrange(items).map((l, i) => (
          <ListRow
            key={l.id}
            link={l}
            index={i}
            fav={favs.has(l.id)}
            loggedIn={loggedIn}
            onFav={() => toggleFav(l.id)}
            dragging={dragId === l.id}
            over={overId === l.id && dragId !== l.id}
            dragProps={dragProps(l)}
          />
        ))}
      </div>
    ) : (
      <div className={view === 'grid' ? 'grid-cards' : 'grid-cards-lg'}>
        {arrange(items).map((l, i) => (
          <Card
            key={l.id}
            link={l}
            index={i}
            big={view === 'card'}
            fav={favs.has(l.id)}
            loggedIn={loggedIn}
            onFav={() => toggleFav(l.id)}
            dragging={dragId === l.id}
            over={overId === l.id && dragId !== l.id}
            dragProps={dragProps(l)}
          />
        ))}
      </div>
    );

  return (
    <>
      <Header right={searchBox} />
      <main className="container home-layout">
        {/* 左侧竖向分组导航 */}
        <aside className="home-side">
          <div className="home-side-title">{t('groups')}</div>
          <button
            className={`side-tab ${group === -1 ? 'active' : ''}`}
            onClick={() => setGroup(-1)}
          >
            <span className="side-dot side-dot-all" />
            <span className="side-name">{t('allGroups')}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`side-tab ${group === g.id ? 'active' : ''}`}
              onClick={() => setGroup(g.id)}
            >
              <span className="side-dot" style={{ background: g.color || 'var(--muted)' }} />
              <span className="side-name">{g.name}</span>
            </button>
          ))}
        </aside>

        {/* 右侧内容区 */}
        <div className="home-main">
          <div className="home-toolbar">
            <div className="segmented">
              {/* 折叠 / 展开合并为一个文字切换按钮 */}
              <button onClick={toggleCollapseAll}>
                {isAllCollapsed() ? t('expandAll') : t('collapseAll')}
              </button>
              <button
                onClick={toggleSortDir}
                title={sortDir === 'asc' ? t('sortAsc') : t('sortDesc')}
                className={sortDir === 'desc' ? 'active' : ''}
              >
                {sortDir === 'asc' ? 'A↑' : 'A↓'}
              </button>
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
            <>
              {/* 顶部独立收藏组（仅在全部视图且有收藏时显示） */}
              {group === -1 && favLinks.length > 0 && (
                <section className="section fav-section">
                  <div className="section-head">
                    <span className="fav-star">
                      <IconStar width={14} height={14} />
                    </span>
                    <span className="section-bar" />
                    <span className="section-title">{t('favorite')}</span>
                    <span className="section-count">{favLinks.length}</span>
                  </div>
                  <div key={view} className="view-wrap">
                    {renderItems(favLinks)}
                  </div>
                </section>
              )}

              {grouped.map(({ g, items }) => {
                const sid = g?.id ?? 0;
                const isCollapsed = collapsed.has(sid);
                return (
                  <section className="section" key={sid}>
                    <div className="section-head">
                      <button className="collapse-btn" onClick={() => toggleSection(sid)} aria-label="collapse">
                        {isCollapsed ? '▸' : '▾'}
                      </button>
                      <span className="section-bar" />
                      <span className="section-title">{g?.name ?? t('ungrouped')}</span>
                      <span className="section-count">{items.length}</span>
                    </div>
                    {!isCollapsed && (
                      <div key={view} className="view-wrap">
                        {renderItems(items)}
                      </div>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      </main>
    </>
  );
}

/* ---------- favorite star ---------- */
function FavBtn({
  fav,
  loggedIn,
  onFav,
  title,
}: {
  fav: boolean;
  loggedIn: boolean;
  onFav: () => void;
  title: string;
}) {
  return (
    <button
      className={`fav-btn ${fav ? 'on' : ''}`}
      title={loggedIn ? title : 'need login'}
      aria-label={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFav();
      }}
    >
      {fav ? '★' : '☆'}
    </button>
  );
}

/* ---------- List row (read-only + favorite/drag) ---------- */
function ListRow({
  link,
  index,
  fav,
  loggedIn,
  onFav,
  dragging,
  over,
  dragProps,
}: {
  link: Link;
  index: number;
  fav: boolean;
  loggedIn: boolean;
  onFav: () => void;
  dragging: boolean;
  over: boolean;
  dragProps: object;
}) {
  const { t } = useApp();
  return (
    <a
      className={`list-row ${dragging ? 'dragging' : ''} ${over ? 'drag-over' : ''}`}
      href={link.url}
      target="_blank"
      rel="noreferrer"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      {...dragProps}
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
        <FavBtn fav={fav} loggedIn={loggedIn} onFav={onFav} title={fav ? t('favorited') : t('favorite')} />
      </span>
    </a>
  );
}

/* ---------- Card (read-only + favorite/drag) ---------- */
function Card({
  link,
  index,
  big,
  fav,
  loggedIn,
  onFav,
  dragging,
  over,
  dragProps,
}: {
  link: Link;
  index: number;
  big: boolean;
  fav: boolean;
  loggedIn: boolean;
  onFav: () => void;
  dragging: boolean;
  over: boolean;
  dragProps: object;
}) {
  const { t } = useApp();
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <a
      ref={ref}
      className={`card ${fav ? 'is-fav' : ''} ${dragging ? 'dragging' : ''} ${over ? 'drag-over' : ''}`}
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
      {...dragProps}
    >
      <span className="card-fav">
        <FavBtn fav={fav} loggedIn={loggedIn} onFav={onFav} title={fav ? t('favorited') : t('favorite')} />
      </span>
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
