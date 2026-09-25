'use client';

import { useState } from 'react';
import { useApp } from './providers';
import type { Group, Link } from '@/lib/types';
import { iconSrc } from './home-view';

type Props = {
  link: Link | null; // null = create
  groups: Group[];
  defaultGroupId?: number;
  onClose: () => void;
  onSaved: (saved: Link, isNew: boolean) => void;
};

export function LinkEditor({ link, groups, defaultGroupId, onClose, onSaved }: Props) {
  const { t } = useApp();
  const [form, setForm] = useState({
    name: link?.name ?? '',
    url: link?.url ?? '',
    note: link?.note ?? '',
    group_id: link?.group_id ?? defaultGroupId ?? 0,
    scope: link?.scope ?? 'internal',
    icon: link?.icon ?? '',
    sort: link?.sort ?? 0,
    has_thumb: !!link?.has_thumb,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [iconVer, setIconVer] = useState(0);
  const [thumbVer] = useState(0);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.name.trim() || !form.url.trim()) {
      setErr(`${t('name')} / ${t('url')} ✱`);
      return;
    }
    setSaving(true);
    const res = await fetch(link ? `/api/links/${link.id}` : '/api/links', {
      method: link ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error ?? t('opFailed'));
      return;
    }
    const j = await res.json().catch(() => ({}));
    const saved: Link = {
      ...(link ?? {
        id: Number(j.id),
        created_at: '',
        owner_id: null,
      }),
      ...form,
      has_thumb: form.has_thumb ? 1 : 0,
    } as Link;
    onSaved(saved, !link);
  }

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          {link ? t('editSite') : t('addSite')}
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label>{t('name')} ✱</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('url')} ✱</label>
            <input
              className="input"
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder="http://192.168.1.10:8096 或 https://example.com"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              onBlur={() => setIconVer((v) => v + 1)}
            />
          </div>
          <div className="field">
            <label>{t('note')}</label>
            <textarea className="input" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>{t('group')}</label>
              <select className="select" value={form.group_id} onChange={(e) => set('group_id', Number(e.target.value))}>
                <option value={0}>{t('ungrouped')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.visibility === 'private' ? ' 🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('scope')}</label>
              <select className="select" value={form.scope} onChange={(e) => set('scope', e.target.value)}>
                <option value="internal">{t('scopeInternal')}</option>
                <option value="external">{t('scopeExternal')}</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>{t('icon')}</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="favicon">
                <img
                  key={iconVer}
                  src={
                    form.icon ||
                    `/api/asset/icon?url=${encodeURIComponent(form.url)}&name=${encodeURIComponent(form.name)}&v=${iconVer}`
                  }
                  alt=""
                />
              </span>
              <button className="btn btn-sm" onClick={() => setIconVer((v) => v + 1)} type="button">
                ⟳ {t('iconAuto')}
              </button>
              <input
                className="input"
                placeholder={t('icon') + ' URL (optional)'}
                value={form.icon}
                onChange={(e) => set('icon', e.target.value)}
                style={{ flex: 1, fontSize: 11 }}
              />
            </div>
          </div>
          {link && (
            <div className="field">
              <label>{t('thumbnail')}</label>
              <span className="thumb" style={{ width: 160 }}>
                <img src={`/api/asset/thumb/${link.id}?v=${thumbVer}`} alt="" />
              </span>
            </div>
          )}
          {err && <div className="auth-error">{err}</div>}
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '⏳' : t('save')}
          </button>
        </div>
      </div>
    </>
  );
}
