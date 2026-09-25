'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dict, type Locale, type TKey } from '@/lib/i18n';

export type Mode = 'dark' | 'light';
export type Accent = 'indigo' | 'graphite' | 'forest' | 'sand';

type Ctx = {
  locale: Locale;
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
  user: { id: number; username: string; role: string } | null;
  setUser: (u: Ctx['user']) => void;
};

const AppCtx = createContext<Ctx>(null!);

export const useApp = () => useContext(AppCtx);

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function Providers({
  initial,
  children,
}: {
  initial: { locale: Locale; mode: Mode; accent: Accent; user: Ctx['user']; prefs?: Record<string, string> | null };
  children: React.ReactNode
}) {
  const [locale, setLocaleS] = useState<Locale>(initial.locale);
  const [mode, setModeS] = useState<Mode>(initial.mode);
  const [accent, setAccentS] = useState<Accent>(initial.accent as Accent);
  const [user, setUser] = useState(initial.user);

  // 登录时把账户偏好同步到库（fire-and-forget），下次同一账户登录自动恢复
  const savePref = useCallback((key: string, value: string) => {
    fetch('/api/prefs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }, []);

  const apply = useCallback((m: Mode, a: Accent) => {
    const el = document.documentElement;
    el.dataset.mode = m;
    el.dataset.accent = a;
  }, []);

  // 服务端重新渲染时同步登录状态（useEffect 安全模式，避免并发渲染问题）
  const serverUserId = initial.user?.id ?? null;
  const [syncedId, setSyncedId] = useState(serverUserId);
  useEffect(() => {
    if (serverUserId !== syncedId) {
      setSyncedId(serverUserId);
      setUser(initial.user);
      // 登录后应用账户偏好（主题/语言以库内设置为准）
      const p = initial.prefs;
      if (initial.user && p) {
        if (p.theme_mode === 'light' || p.theme_mode === 'dark') {
          setModeS(p.theme_mode as Mode);
          setCookie('cythe_mode', p.theme_mode);
        }
        if (p.accent) {
          setAccentS(p.accent as Accent);
          setCookie('cythe_accent', p.accent);
        }
        if (p.locale === 'zh' || p.locale === 'en') {
          setLocaleS(p.locale as Locale);
          setCookie('cythe_locale', p.locale);
        }
        apply(
          (p.theme_mode === 'light' || p.theme_mode === 'dark' ? p.theme_mode : initial.mode) as Mode,
          (p.accent || initial.accent) as Accent
        );
      }
    }
  }, [serverUserId, syncedId, initial.user, initial.prefs, initial.mode, initial.accent, apply]);

  const setMode = useCallback(
    (m: Mode) => {
      setModeS(m);
      setCookie('cythe_mode', m);
      apply(m, accent);
      if (user) savePref('theme_mode', m);
    },
    [accent, apply, user, savePref]
  );
  const setAccent = useCallback(
    (a: Accent) => {
      setAccentS(a);
      setCookie('cythe_accent', a);
      apply(mode, a);
      if (user) savePref('accent', a);
    },
    [mode, apply, user, savePref]
  );
  const setLocale = useCallback(
    (l: Locale) => {
      setLocaleS(l);
      setCookie('cythe_locale', l);
      document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
      if (user) savePref('locale', l);
    },
    [user, savePref]
  );

  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: (k: TKey) => dict[locale][k] ?? k,
      setLocale,
      mode,
      setMode,
      accent,
      setAccent,
      user,
      setUser,
    }),
    [locale, mode, accent, user, setLocale, setMode, setAccent]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
