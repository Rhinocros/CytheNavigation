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
  initial: { locale: Locale; mode: Mode; accent: Accent; user: Ctx['user'] };
  children: React.ReactNode;
}) {
  const [locale, setLocaleS] = useState<Locale>(initial.locale);
  const [mode, setModeS] = useState<Mode>(initial.mode);
  const [accent, setAccentS] = useState<Accent>(initial.accent as Accent);
  const [user, setUser] = useState(initial.user);

  // 服务端重新渲染时同步登录状态（useEffect 安全模式，避免并发渲染问题）
  const serverUserId = initial.user?.id ?? null;
  const [syncedId, setSyncedId] = useState(serverUserId);
  useEffect(() => {
    if (serverUserId !== syncedId) {
      setSyncedId(serverUserId);
      setUser(initial.user);
    }
  }, [serverUserId, syncedId, initial.user]);

  const apply = useCallback((m: Mode, a: Accent) => {
    const el = document.documentElement;
    el.dataset.mode = m;
    el.dataset.accent = a;
  }, []);

  const setMode = useCallback(
    (m: Mode) => {
      setModeS(m);
      setCookie('cythe_mode', m);
      apply(m, accent);
    },
    [accent, apply]
  );
  const setAccent = useCallback(
    (a: Accent) => {
      setAccentS(a);
      setCookie('cythe_accent', a);
      apply(mode, a);
    },
    [mode, apply]
  );
  const setLocale = useCallback((l: Locale) => {
    setLocaleS(l);
    setCookie('cythe_locale', l);
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  }, []);

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
