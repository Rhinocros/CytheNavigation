/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useApp } from './providers';
import { Header } from './header';
import { LinkEditor } from './link-editor';
import { ConfirmDialog, InputDialog } from './dialog';
import type { Group, Link } from '@/lib/types';
import { hostOf, iconSrc } from './home-view';
import {
  IconLink,
  IconLayers,
  IconPalette,
  IconGear,
  IconUsers,
  IconDatabase,
  IconUpload,
  IconDownload,
  IconRadar,
} from './icons';
import type { Accent, Mode } from './providers';
import type { Locale } from '@/lib/i18n';

export type UserRow = {
  id: number;
  username: string;
  role: string;
  disabled: number;
  created_at: string;
};

type Tab = 'sites' | 'groups' | 'scan' | 'appearance' | 'system' | 'users' | 'data';

export function SettingsUI({
  me,
  links: initLinks,
  groups: initGroups,
  settings: initSettings,
  users: initUsers,
}: {
  me: { id: number; username: string; role: string };
  links: Link[];
  groups: Group[];
  settings: Record<string, string>;
  users: UserRow[];
}) {
  const { t, locale } = useApp();
  const router = useRouter();
  const isAdmin = me.role === 'admin';
  const [tab, setTab] = useState<Tab>('sites');
  const [links, setLinks] = useState(initLinks);
  const [groups, setGroups] = useState(initGroups);
  const [settings, setSettings] = useState(initSettings);
  const [users, setUsers] = useState(initUsers);
  const [editing, setEditing] = useState<Link | null | undefined>(undefined);
  const [toast, setToast] = useState('');
  const [confirmLink, setConfirmLink] = useState<number | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<Group | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserRow | null>(null);
  // 内网扫描进行中：锁定左侧导航，避免切页导致扫描中断
  const [scanning, setScanning] = useState(false);

  // 服务端数据变化（router.refresh 后 props 更新）时同步进本地状态，避免列表陈旧
  useEffect(() => {
    setLinks(initLinks);
  }, [initLinks]);
  useEffect(() => {
    setGroups(initGroups);
  }, [initGroups]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }
  function refresh() {
    router.refresh();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'sites', label: t('sites'), icon: <IconLink />, show: true },
    { id: 'groups', label: t('groups'), icon: <IconLayers />, show: true },
    { id: 'scan', label: t('scan'), icon: <IconRadar />, show: isAdmin },
    { id: 'appearance', label: t('appearance'), icon: <IconPalette />, show: true },
    { id: 'system', label: t('system'), icon: <IconGear />, show: isAdmin },
    { id: 'users', label: t('users'), icon: <IconUsers />, show: isAdmin },
    { id: 'data', label: t('data'), icon: <IconDatabase />, show: isAdmin },
  ];

  async function delLink(id: number) {
    const r = await fetch(`/api/links/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setLinks((ls) => ls.filter((l) => l.id !== id));
      notify(t('saved'));
      refresh();
    } else notify(t('opFailed'));
  }

  async function delGroup(g: Group) {
    const r = await fetch(`/api/groups/${g.id}`, { method: 'DELETE' });
    if (r.ok) {
      setGroups((gs) => gs.filter((x) => x.id !== g.id));
      notify(t('saved'));
      refresh();
    } else notify(t('opFailed'));
  }

  async function delUser(u: UserRow) {
    const r = await fetch(`/api/users?id=${u.id}`, { method: 'DELETE' });
    if (r.ok) {
      setUsers((us) => us.filter((x) => x.id !== u.id));
      notify(t('saved'));
    } else notify(t('opFailed'));
  }

  async function doResetPwd(u: UserRow, pw: string) {
    const r = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: u.id, password: pw }),
    });
    if (r.ok) notify(t('saved'));
    else notify(t('opFailed'));
  }

  // 扫描确认后，将新增分组 / 链接立即合并进本地状态，避免需切页才能看到
  function applyScanResult(group: Group, newLinks: Link[]) {
    setGroups((gs) =>
      gs.some((g) => g.id === group.id)
        ? gs.map((g) => (g.id === group.id ? group : g))
        : [...gs, group]
    );
    if (newLinks.length) {
      setLinks((ls) => {
        // 以现有列表的 id 去重，只追加尚未存在的条目
        const known = new Set(ls.map((l) => l.id));
        return [...ls, ...newLinks.filter((l) => !known.has(l.id))];
      });
    }
    refresh();
  }

  return (
    <>
      <Header />
      <main className="container settings-layout">
        <nav className="settings-nav">
          {tabs
            .filter((x) => x.show)
            .map((x) => (
              <button
                key={x.id}
                className={tab === x.id ? 'active' : ''}
                disabled={scanning && x.id !== 'scan'}
                title={scanning && x.id !== 'scan' ? t('scanKeepPage') : undefined}
                onClick={() => setTab(x.id)}
              >
                <span className="nav-ico">{x.icon}</span> {x.label}
              </button>
            ))}
        </nav>
        <div className="settings-panel">
          {tab === 'sites' && (
            <SitesTab
              links={links}
              groups={groups}
              onAdd={() => setEditing(null)}
              onEdit={(l) => setEditing(l)}
              onDelete={(id) => setConfirmLink(id)}
            />
          )}
          {tab === 'groups' && (
            <GroupsTab groups={groups} setGroups={setGroups} links={links} notify={notify} refresh={refresh} onConfirmDelete={(g) => setConfirmGroup(g)} />
          )}
          {tab === 'scan' && isAdmin && (
            <ScanTab locale={locale} notify={notify} onAdded={applyScanResult} onScanning={setScanning} />
          )}
          {tab === 'appearance' && (
            <AppearanceTab
              isAdmin={isAdmin}
              settings={settings}
              setSettings={setSettings}
              notify={notify}
              logo={settings.logo_image ?? ''}
              onLogoChange={(v) => setSettings((s) => ({ ...s, logo_image: v }))}
            />
          )}
          {tab === 'system' && isAdmin && (
            <SystemTab settings={settings} setSettings={setSettings} notify={notify} />
          )}
          {tab === 'users' && isAdmin && (
            <UsersTab
              me={me}
              users={users}
              setUsers={setUsers}
              notify={notify}
              onConfirmDelete={(u) => setConfirmUser(u)}
              onResetPassword={(u) => setResetPwdUser(u)}
            />
          )}
          {tab === 'data' && isAdmin && <DataTab notify={notify} />}
        </div>
      </main>
      {editing !== undefined && (
        <LinkEditor
          link={editing}
          groups={groups}
          onClose={() => setEditing(undefined)}
          onSaved={(saved, isNew) => {
            setLinks((ls) => (isNew ? [...ls, saved] : ls.map((l) => (l.id === saved.id ? saved : l))));
            setEditing(undefined);
            notify(t('saved'));
            refresh();
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {/* ---- 确认删除站点 ---- */}
      <ConfirmDialog
        open={confirmLink !== null}
        message={t('confirmDelete')}
        onCancel={() => setConfirmLink(null)}
        onOk={() => { if (confirmLink !== null) delLink(confirmLink); setConfirmLink(null); }}
      />
      {/* ---- 确认删除分组 ---- */}
      <ConfirmDialog
        open={confirmGroup !== null}
        message={t('confirmDelete')}
        onCancel={() => setConfirmGroup(null)}
        onOk={() => { if (confirmGroup) delGroup(confirmGroup); setConfirmGroup(null); }}
      />
      {/* ---- 确认删除用户 ---- */}
      <ConfirmDialog
        open={confirmUser !== null}
        message={t('confirmDelete')}
        onCancel={() => setConfirmUser(null)}
        onOk={() => { if (confirmUser) delUser(confirmUser); setConfirmUser(null); }}
      />
      {/* ---- 重置密码 ---- */}
      <InputDialog
        open={resetPwdUser !== null}
        label={t('newPassword')}
        title={`${t('resetPassword')} — ${resetPwdUser?.username ?? ''}`}
        type="password"
        onCancel={() => setResetPwdUser(null)}
        onOk={(pw) => { if (resetPwdUser) doResetPwd(resetPwdUser, pw); setResetPwdUser(null); }}
      />
    </>
  );
}

/* ---------------- Sites ---------------- */

function SitesTab({
  links,
  groups,
  onAdd,
  onEdit,
  onDelete,
}: {
  links: Link[];
  groups: Group[];
  onAdd: () => void;
  onEdit: (l: Link) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useApp();
  const gname = (id: number) => groups.find((g) => g.id === id)?.name ?? t('ungrouped');
  return (
    <div className="panel-card">
      <div className="panel-title">
        {t('sites')}
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          ＋ {t('addSite')}
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            <th>{t('name')}</th>
            <th>{t('url')}</th>
            <th style={{ width: 150 }}>{t('group')}</th>
            <th style={{ width: 78 }}>{t('scope')}</th>
            <th style={{ width: 120 }}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.id} className="group-row">
              <td>
                <span className="favicon" style={{ width: 26, height: 26 }}>
                  <img src={iconSrc(l)} alt="" style={{ width: 17, height: 17 }} loading="lazy" />
                </span>
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                {l.note && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.note}</div>}
              </td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                {hostOf(l.url)}
              </td>
              <td>
                <span className="chip chip-wrap">{gname(l.group_id)}</span>
              </td>
              <td>
                <span className={`chip ${l.scope === 'external' ? 'chip-accent' : ''}`}>
                  {l.scope === 'external' ? t('scopeExternal') : t('scopeInternal')}
                </span>
              </td>
              <td>
                <div className="row-actions" style={{ opacity: 1 }}>
                  <button className="mini-btn" title={t('edit')} onClick={() => onEdit(l)}>
                    ✎
                  </button>
                  <button className="mini-btn" title={t('delete')} onClick={() => onDelete(l.id)}>
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {links.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Groups ---------------- */

function GroupsTab({
  groups,
  setGroups,
  links,
  notify,
  refresh,
  onConfirmDelete,
}: {
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  links: Link[];
  notify: (m: string) => void;
  refresh: () => void;
  onConfirmDelete: (g: Group) => void;
}) {
  const { t } = useApp();
  const [draft, setDraft] = useState({ name: '', color: '#5b7cfa', visibility: 'public' });

  async function add() {
    if (!draft.name.trim()) return;
    const r = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (r.ok) {
      const j = await r.json();
      setGroups((gs) => [...gs, { id: j.id, name: draft.name, color: draft.color, sort: gs.length + 1, visibility: draft.visibility as Group['visibility'], owner_id: null }]);
      setDraft({ ...draft, name: '' });
      notify(t('saved'));
      refresh();
    } else notify(t('opFailed'));
  }

  async function save(g: Group, patch: Partial<Group>) {
    const next = { ...g, ...patch };
    const r = await fetch(`/api/groups/${g.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (r.ok) {
      setGroups((gs) => gs.map((x) => (x.id === g.id ? next : x)));
      notify(t('saved'));
      refresh();
    } else notify(t('opFailed'));
  }

  function del(g: Group) {
    onConfirmDelete(g);
  }

  return (
    <>
      <div className="panel-card">
        <div className="panel-title">{t('groups')}</div>
        <table className="table">
          <thead>
            <tr>
              <th>{t('groupName')}</th>
              <th>{t('color')}</th>
              <th>{t('visibility')}</th>
              <th>{t('sort')}</th>
              <th>{t('sites')}</th>
              <th style={{ width: 70 }}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.id} className="group-row">
                <td>
                  <input
                    className="input"
                    style={{ height: 30, maxWidth: 180 }}
                    defaultValue={g.name}
                    onBlur={(e) => e.target.value !== g.name && save(g, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    value={g.color || '#5b7cfa'}
                    onChange={(e) => setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, color: e.target.value } : x)))}
                    onBlur={(e) => save(g, { color: e.target.value })}
                    style={{ width: 30, height: 26, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 5, background: 'none' }}
                  />
                </td>
                <td>
                  <select
                    className="select"
                    style={{ height: 30, width: 90 }}
                    value={g.visibility}
                    onChange={(e) => save(g, { visibility: e.target.value as Group['visibility'] })}
                  >
                    <option value="public">{t('visPublic')}</option>
                    <option value="private">{t('visPrivate')}</option>
                  </select>
                </td>
                <td style={{ width: 70 }}>
                  <div className="sort-btns">
                    <button className="mini-btn" disabled={i === 0} onClick={() => {
                      const prev = groups[i - 1];
                      save(g, { sort: prev.sort });
                      save(prev, { sort: g.sort });
                    }}>↑</button>
                    <button className="mini-btn" disabled={i === groups.length - 1} onClick={() => {
                      const next = groups[i + 1];
                      save(g, { sort: next.sort });
                      save(next, { sort: g.sort });
                    }}>↓</button>
                  </div>
                </td>
                <td className="section-count">{links.filter((l) => l.group_id === g.id).length}</td>
                <td>
                  <button className="mini-btn" onClick={() => del(g)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divider" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            style={{ maxWidth: 200 }}
            placeholder={t('groupName')}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            style={{ width: 34, height: 34, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'none' }}
          />
          <select
            className="select"
            style={{ width: 100 }}
            value={draft.visibility}
            onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}
          >
            <option value="public">{t('visPublic')}</option>
            <option value="private">{t('visPrivate')}</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={add}>
            ＋ {t('addGroup')}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------- LAN Scan ---------------- */

type ScanPreview = { key: string; name: string; url: string; note: string; exists?: boolean; added?: boolean };
type ScanCache = { ts: number; cidr: string; items: ScanPreview[] };
const SCAN_CACHE_KEY = 'cythe_scan_cache';
const SCAN_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function loadScanCache(): ScanCache | null {
  try {
    const raw = localStorage.getItem(SCAN_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as ScanCache;
    if (!c || typeof c.ts !== 'number' || !Array.isArray(c.items)) return null;
    if (Date.now() - c.ts > SCAN_CACHE_TTL) {
      localStorage.removeItem(SCAN_CACHE_KEY);
      return null;
    }
    return c;
  } catch {
    return null;
  }
}
function saveScanCache(c: ScanCache) {
  try {
    localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota */
  }
}
function clearScanCache() {
  try {
    localStorage.removeItem(SCAN_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function ScanTab({
  locale,
  notify,
  onAdded,
  onScanning,
}: {
  locale: Locale;
  notify: (m: string) => void;
  onAdded: (group: Group, links: Link[]) => void;
  onScanning: (b: boolean) => void;
}) {
  const { t } = useApp();
  const [cidr, setCidr] = useState('');
  const [detected, setDetected] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [items, setItems] = useState<ScanPreview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromCache, setFromCache] = useState(false);

  // 默认勾选：未存在且未添加的条目
  function defaultSelected(list: ScanPreview[]) {
    return new Set(list.filter((i) => !i.exists && !i.added).map((i) => i.key));
  }

  useEffect(() => {
    fetch('/api/scan')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cidr?: string } | null) => {
        if (j?.cidr) {
          setCidr(j.cidr);
          setDetected(true);
        }
      })
      .catch(() => {});
    // 恢复上次扫描结果（5 分钟内）
    const c = loadScanCache();
    if (c && c.items.length) {
      setItems(c.items);
      setSelected(defaultSelected(c.items));
      setFromCache(true);
      if (c.cidr) setCidr(c.cidr);
    }
  }, []);

  async function start() {
    if (!agree || busy) return;
    setBusy(true);
    setFromCache(false);
    setItems([]);
    setSelected(new Set());
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consent: true, cidr }),
      });
      if (r.ok) {
        const j = await r.json();
        const list: ScanPreview[] = Array.isArray(j.items) ? j.items : [];
        saveScanCache({ ts: Date.now(), cidr, items: list });
        // 结果与按钮状态同步落屏，避免「扫描完成」提示先出现、结果晚几秒才渲染
        flushSync(() => {
          setItems(list);
          setSelected(defaultSelected(list));
          setBusy(false);
        });
        notify(t('scanDone'));
        return;
      }
      flushSync(() => setBusy(false));
      notify(t('scanFailedHint'));
    } catch {
      flushSync(() => setBusy(false));
      notify(t('scanFailedHint'));
    }
  }

  // 扫描进行中：上报状态以锁定左侧导航，并拦截刷新/关闭标签页避免请求中断
  useEffect(() => {
    onScanning(busy);
    if (!busy) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      window.removeEventListener('beforeunload', guard);
      onScanning(false);
    };
  }, [busy, onScanning]);

  const selectableKeys = items.filter((i) => !i.exists && !i.added).map((i) => i.key);
  const allChecked = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));

  function toggle(key: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => {
      if (selectableKeys.every((k) => s.has(k))) {
        const n = new Set(s);
        selectableKeys.forEach((k) => n.delete(k));
        return n;
      }
      return new Set([...s, ...selectableKeys]);
    });
  }

  async function confirm() {
    const chosen = items.filter((i) => selected.has(i.key) && !i.added && !i.exists);
    if (chosen.length === 0) {
      notify(t('scanNoSelection'));
      return;
    }
    setConfirming(true);
    try {
      const r = await fetch('/api/scan/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: chosen.map((c) => ({ name: c.name, url: c.url, note: c.note })),
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const chosenKeys = new Set(chosen.map((c) => c.key));
        const nextItems = items.map((i) =>
          chosenKeys.has(i.key) ? { ...i, added: true } : i
        );
        // 先合并进本地状态（站点管理立即可见），再一次性落屏
        if (j.group && Array.isArray(j.links)) onAdded(j.group as Group, j.links as Link[]);
        flushSync(() => {
          setItems(nextItems);
          setSelected(new Set());
          setConfirming(false);
        });
        // 更新缓存（保留剩余预览 5 分钟）
        saveScanCache({ ts: Date.now(), cidr, items: nextItems });
        notify(t('scanAddedDone').replace('{c}', String(j.created ?? 0)));
        return;
      }
      flushSync(() => setConfirming(false));
      notify(t('scanFailedHint'));
    } catch {
      flushSync(() => setConfirming(false));
      notify(t('scanFailedHint'));
    }
  }

  function discard() {
    clearScanCache();
    setItems([]);
    setSelected(new Set());
    setFromCache(false);
  }

  const selCount = items.filter((i) => selected.has(i.key) && !i.added && !i.exists).length;

  return (
    <div className="panel-card">
      <div className="panel-title">{t('scan')}</div>
      <div className="setting-desc" style={{ marginBottom: 12 }}>
        {t('scanDesc')}
      </div>
      {/* ---- 知情同意告知 ---- */}
      <div
        className="setting-desc"
        style={{ border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 12px' }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('scanConsentTitle')}</div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>{t('scanConsent1')}</li>
          <li>{t('scanConsent2')}</li>
          <li>{t('scanConsent3')}</li>
          <li>{t('scanConsent4')}</li>
        </ol>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span style={{ fontWeight: 600 }}>{t('scanAgree')}</span>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ width: 180 }}
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          placeholder="192.168.1.0/24"
        />
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('scanCidr')}</span>
        <button className="btn btn-primary btn-sm" disabled={!agree || busy || !cidr} onClick={start}>
          {busy ? t('scanRunning') : '◈ ' + t(items.length ? 'scanRescan' : 'scanStart')}
        </button>
        {items.length > 0 && (
          <button className="btn btn-sm" onClick={discard}>
            ✕ {t('scanClear')}
          </button>
        )}
      </div>
      {!detected && (
        <div className="setting-desc" style={{ marginTop: 8 }}>
          {t('scanNoNet')}
        </div>
      )}
      {busy && (
        <div className="scan-warn" role="status">
          ⚠ {t('scanKeepPage')}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ fontWeight: 600 }}>
              {t('scanFound')}
              {t('scanCountSummary')
                .replace('{n}', String(items.length))
                .replace('{s}', String(selCount))}
              {fromCache && (
                <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>
                  {' '}· {t('scanCachedHint')}
                </span>
              )}
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={selectableKeys.length === 0}
                    title={t('scanSelectAll')}
                  />
                </th>
                <th>{t('name')}</th>
                <th>{t('url')}</th>
                <th>{t('note')}</th>
                <th style={{ width: 88 }}>{t('scanStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => {
                const locked = !!x.added || !!x.exists;
                return (
                  <tr key={x.key} className="group-row">
                    <td>
                      <input
                        type="checkbox"
                        checked={locked ? false : selected.has(x.key)}
                        disabled={locked}
                        onChange={() => toggle(x.key)}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{x.name}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                      {x.url}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {locale === 'zh' ? x.note.split(' ｜ ')[0] : x.note}
                    </td>
                    <td>
                      {x.added ? (
                        <span className="chip chip-accent">{t('scanAdded')}</span>
                      ) : x.exists ? (
                        <span className="chip">{t('scanExists')}</span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={confirming || selCount === 0}
              onClick={confirm}
            >
              {confirming ? '⏳' : '✓ ' + t('scanConfirmAdd')}
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {t('scanSelectedHint').replace('{s}', String(selCount))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceTab({
  isAdmin,
  settings,
  setSettings,
  notify,
  logo,
  onLogoChange,
}: {
  isAdmin: boolean;
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  notify: (m: string) => void;
  logo: string;
  onLogoChange: (v: string) => void;
}) {
  const { t, mode, setMode, accent, setAccent, locale, setLocale } = useApp();
  const accents: { id: Accent; label: string; css: string }[] = [
    { id: 'indigo', label: t('accentIndigo'), css: 'linear-gradient(135deg,#5b7cfa,#38bdf8)' },
    { id: 'graphite', label: t('accentGraphite'), css: 'linear-gradient(135deg,#8fa3bf,#5f7494)' },
    { id: 'forest', label: t('accentForest'), css: 'linear-gradient(135deg,#34d399,#10b981)' },
    { id: 'sand', label: t('accentSand'), css: 'linear-gradient(135deg,#f5b451,#ea9c3a)' },
  ];
  async function saveSettings(patch: Record<string, string>) {
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      setSettings((s) => ({ ...s, ...patch }));
      notify(t('saved'));
    } else notify(t('opFailed'));
  }
  return (
    <>
      <div className="panel-card">
        <div className="panel-title">{t('theme')}</div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{mode === 'dark' ? t('darkMode') : t('lightMode')}</div>
            <div className="setting-desc">{t('appearance')}</div>
          </div>
          <div className="segmented">
            {(['dark', 'light'] as Mode[]).map((m) => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                {m === 'dark' ? '☾ ' + t('darkMode') : '☀ ' + t('lightMode')}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-label">{t('theme')}</div>
          <div className="swatches">
            {accents.map((a) => (
              <button
                key={a.id}
                title={a.label}
                className={`swatch ${accent === a.id ? 'active' : ''}`}
                style={{ background: a.css }}
                onClick={() => setAccent(a.id)}
              />
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-label">{t('language')}</div>
          <div className="segmented">
            {(['zh', 'en'] as Locale[]).map((l) => (
              <button key={l} className={locale === l ? 'active' : ''} onClick={() => setLocale(l)}>
                {l === 'zh' ? '简体中文' : 'English'}
              </button>
            ))}
          </div>
        </div>
        {isAdmin && (
          <div className="setting-row">
            <div className="setting-label">{t('defaultView')}</div>
            <div className="segmented">
              {(['list', 'grid', 'card'] as const).map((v) => (
                <button
                  key={v}
                  className={(settings.default_view ?? 'grid') === v ? 'active' : ''}
                  onClick={() => saveSettings({ default_view: v })}
                >
                  {v === 'list' ? t('listView') : v === 'grid' ? t('gridView') : t('cardView')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <BgImageCard hasBg={!!(settings.bg_image ?? '')} bgKey={settings.bg_image ?? ''} notify={notify} />
      {isAdmin && (
        <LogoCard logo={logo} onLogoChange={onLogoChange} notify={notify} />
      )}
    </>
  );
}

/* ---------------- Background image (site-wide) ---------------- */

function BgImageCard({ hasBg, bgKey, notify }: { hasBg: boolean; bgKey: string; notify: (m: string) => void }) {
  const { t } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(f: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', f);
    const r = await fetch('/api/asset/bg', { method: 'POST', body: fd });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (r.ok) {
      notify(t('saved'));
      setTimeout(() => window.location.reload(), 500);
    } else notify(t('opFailed'));
  }

  async function remove() {
    const r = await fetch('/api/asset/bg', { method: 'DELETE' });
    if (r.ok) {
      notify(t('saved'));
      setTimeout(() => window.location.reload(), 500);
    } else notify(t('opFailed'));
  }

  return (
    <div className="panel-card">
      <div className="panel-title">{t('bgImage')}</div>
      <div className="setting-row">
        <div>
          <div className="setting-desc">{t('bgHint')}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <IconUpload width={14} height={14} /> {t('bgUpload')}
            </button>
            {hasBg && (
              <button className="btn btn-sm" onClick={remove}>
                ✕ {t('bgRemove')}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>
        {hasBg && (
          <img
            src={`/api/asset/bg?v=${encodeURIComponent(bgKey)}`}
            alt="bg preview"
            style={{ width: 120, height: 74, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        )}
      </div>
    </div>
  );
}

function TitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      className="input"
      style={{ width: 220 }}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

/* ---------------- Site logo (admin only) ---------------- */

function LogoCard({
  logo,
  onLogoChange,
  notify,
}: {
  logo: string;
  onLogoChange: (v: string) => void;
  notify: (m: string) => void;
}) {
  const { t, setLogo } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasLogo = !!logo;
  const src = hasLogo ? `/api/asset/logo?v=${encodeURIComponent(logo)}` : '/logo.png';

  async function upload(f: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', f);
    const r = await fetch('/api/asset/logo', { method: 'POST', body: fd });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) {
      notify(t('opFailed'));
      return;
    }
    const j = (await r.json().catch(() => null)) as { name?: string; logo?: string } | null;
    if (j?.logo) setLogo(j.logo);
    onLogoChange(j?.name ?? '');
    notify(t('saved'));
  }

  async function restore() {
    const r = await fetch('/api/asset/logo', { method: 'DELETE' });
    if (!r.ok) {
      notify(t('opFailed'));
      return;
    }
    setLogo('/logo.png');
    onLogoChange('');
    notify(t('saved'));
  }

  return (
    <div className="panel-card">
      <div className="panel-title">{t('siteLogo')}</div>
      <div className="setting-row">
        <div>
          <div className="setting-desc">{t('logoHint')}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <IconUpload width={14} height={14} /> {t('logoUpload')}
            </button>
            {hasLogo && (
              <button className="btn btn-sm" onClick={restore}>
                ↺ {t('logoRestore')}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>
        <img
          src={src}
          alt="logo preview"
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border)', background: 'var(--panel-2)' }}
        />
      </div>
    </div>
  );
}

/* ---------------- System ---------------- */

function SystemTab({
  settings,
  setSettings,
  notify,
}: {
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  notify: (m: string) => void;
}) {
  const { t } = useApp();
  async function toggle(key: 'allow_register' | 'user_can_add') {
    const val = settings[key] === '1' ? '0' : '1';
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [key]: val }),
    });
    if (r.ok) {
      setSettings((s) => ({ ...s, [key]: val }));
      notify(t('saved'));
    } else notify(t('opFailed'));
  }
  async function save(patch: Record<string, string>) {
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      setSettings((s) => ({ ...s, ...patch }));
      notify(t('saved'));
    } else notify(t('opFailed'));
  }
  return (
    <div className="panel-card">
      <div className="panel-title">{t('system')}</div>
      <div className="setting-row">
        <div>
          <div className="setting-label">{t('allowRegister')}</div>
          <div className="setting-desc">{t('allowRegisterDesc')}</div>
        </div>
        <button
          className={`switch ${settings.allow_register === '1' ? 'on' : ''}`}
          onClick={() => toggle('allow_register')}
        />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">{t('userCanAdd')}</div>
          <div className="setting-desc">{t('userCanAddDesc')}</div>
        </div>
        <button
          className={`switch ${settings.user_can_add === '1' ? 'on' : ''}`}
          onClick={() => toggle('user_can_add')}
        />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">{t('siteTitle')}</div>
          <div className="setting-desc">{t('copyrightNote')}</div>
        </div>
        <TitleInput value={settings.site_title ?? ''} onSave={(v) => save({ site_title: v })} />
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersTab({
  me,
  users,
  setUsers,
  notify,
  onConfirmDelete,
  onResetPassword,
}: {
  me: { id: number };
  users: UserRow[];
  setUsers: React.Dispatch<React.SetStateAction<UserRow[]>>;
  notify: (m: string) => void;
  onConfirmDelete: (u: UserRow) => void;
  onResetPassword: (u: UserRow) => void;
}) {
  const { t } = useApp();
  async function patch(u: UserRow, body: Record<string, unknown>) {
    const r = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: u.id, ...body }),
    });
    if (r.ok) {
      setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, ...body } as UserRow : x)));
      notify(t('saved'));
    } else notify(t('opFailed'));
  }
  function del(u: UserRow) {
    onConfirmDelete(u);
  }
  return (
    <div className="panel-card">
      <div className="panel-title">{t('users')}</div>
      <table className="table">
        <thead>
          <tr>
            <th>{t('username')}</th>
            <th>{t('role')}</th>
            <th>{t('status')}</th>
            <th>{t('createdAt')}</th>
            <th style={{ width: 160 }}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="group-row">
              <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="avatar-sq">{u.username[0].toUpperCase()}</span>
                  {u.username}
                </span>
              </td>
              <td>
                <span className={`chip ${u.role === 'admin' ? 'chip-accent' : ''}`}>
                  {u.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                </span>
              </td>
              <td>
                <button
                  className={`switch ${u.disabled ? '' : 'on'}`}
                  onClick={() => patch(u, { disabled: u.disabled ? 0 : 1 })}
                  disabled={u.id === me.id}
                />
              </td>
              <td style={{ fontSize: 11, color: 'var(--muted)' }}>{u.created_at.slice(0, 10)}</td>
              <td>
                <div className="row-actions" style={{ opacity: 1, gap: 4 }}>
                  <button
                    className="mini-btn"
                    title={u.role === 'admin' ? t('demoteAdmin') : t('promoteAdmin')}
                    disabled={u.id === me.id}
                    onClick={() => patch(u, { role: u.role === 'admin' ? 'user' : 'admin' })}
                  >
                    {u.role === 'admin' ? '⇩' : '⇧'}
                  </button>
                  <button
                    className="mini-btn"
                    title={t('resetPassword')}
                    onClick={() => onResetPassword(u)}
                  >
                    ⚿
                  </button>
                  <button className="mini-btn" title={t('delete')} disabled={u.id === me.id} onClick={() => del(u)}>
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Data ---------------- */

function DataTab({ notify }: { notify: (m: string) => void }) {
  const { t } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  async function importFile(f: File) {
    const text = await f.text();
    try {
      const body = JSON.parse(text);
      const r = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      notify(r.ok ? t('saved') : t('opFailed'));
    } catch {
      notify(t('opFailed'));
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  return (
    <div className="panel-card">
      <div className="panel-title">{t('data')}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <a className="btn" href="/api/backup" download>
          <IconDownload width={14} height={14} /> {t('exportData')}
        </a>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <IconUpload width={14} height={14} /> {t('importData')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}
