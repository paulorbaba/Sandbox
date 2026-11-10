import { useEffect, useState } from 'react';

/** Links sempre construídos a partir do domínio atual. */
export const links = (sessionId: string, controlKey?: string | null) => {
  const origin = window.location.origin;
  return {
    participant: `${origin}/participar/${sessionId}`,
    stage: `${origin}/palco/${sessionId}`,
    control: `${origin}/controle/${sessionId}${controlKey ? `#key=${encodeURIComponent(controlKey)}` : ''}`,
  };
};

const keyStore = (id: string) => `ltl:ctl:${id.toUpperCase()}`;
export const saveControlKey = (id: string, key: string) => {
  try {
    localStorage.setItem(keyStore(id), key);
  } catch {
    /* modo privado */
  }
};
export const loadControlKey = (id: string): string | null => {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('key');
  if (fromHash) {
    saveControlKey(id, fromHash);
    return fromHash;
  }
  try {
    return localStorage.getItem(keyStore(id));
  } catch {
    return null;
  }
};

function randomId() {
  if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Identificador do participante por sessão — evita contagem dupla ao recarregar/reconectar. */
export function participantId(sessionId: string, scope = 'p'): string {
  const k = `ltl:${scope}:${sessionId.toUpperCase()}`;
  try {
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(k, id);
    return id;
  } catch {
    return randomId();
  }
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const RM_KEY = 'ltl:reduced-motion';
/** Preferência de movimento reduzido: sistema operacional ou escolha manual. */
export function useReducedMotion() {
  const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [system, setSystem] = useState(() => !!query?.matches);
  const [manual, setManual] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(RM_KEY);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!query) return;
    const on = () => setSystem(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, [query]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RM_KEY) setManual(e.newValue === null ? null : e.newValue === '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const reduced = manual ?? system;
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reduced ? 'true' : 'false';
  }, [reduced]);
  const set = (v: boolean) => {
    setManual(v);
    try {
      localStorage.setItem(RM_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
  return [reduced, set] as const;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const pct = (v: number) => `${Math.round(v)}%`;

export function useNow(intervalMs = 250, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, active]);
  return now;
}

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
