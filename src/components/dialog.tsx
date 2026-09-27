/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './providers';

/* ---------- ConfirmDialog ---------- */
type ConfirmProps = {
  open: boolean;
  message: string;
  title?: string;
  onOk: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, message, title, onOk, onCancel }: ConfirmProps) {
  const { t } = useApp();
  if (!open) return null;
  return (
    <>
      <div className="modal-mask" onClick={onCancel} />
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
          {title ?? '⚠ 确认操作'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            {t('confirmCancel')}
          </button>
          <button className="btn btn-primary" onClick={onOk}>
            {t('confirmOk')}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- InputDialog ---------- */
type InputProps = {
  open: boolean;
  label: string;
  title?: string;
  placeholder?: string;
  type?: 'text' | 'password';
  onOk: (value: string) => void;
  onCancel: () => void;
};

export function InputDialog({
  open,
  label,
  title,
  placeholder,
  type = 'text',
  onOk,
  onCancel,
}: InputProps) {
  const { t } = useApp();
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVal('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  function confirm() {
    onOk(val);
    setVal('');
  }

  return (
    <>
      <div className="modal-mask" onClick={onCancel} />
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          {title ?? label}
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label>{label}</label>
          <input
            ref={inputRef}
            className="input"
            type={type}
            value={val}
            placeholder={placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && val.trim() && confirm()}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            {t('confirmCancel')}
          </button>
          <button className="btn btn-primary" onClick={confirm} disabled={!val.trim()}>
            {t('confirmOk')}
          </button>
        </div>
      </div>
    </>
  );
}
