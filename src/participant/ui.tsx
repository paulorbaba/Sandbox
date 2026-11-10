import { useEffect, useRef, type ReactNode } from 'react';
import { Logo } from '../components/Brand';

export function Screen({
  tone = 'cream',
  id,
  title,
  children,
  footer,
  logo = true,
  className = '',
  bg,
}: {
  tone?: 'cream' | 'yellow' | 'dark';
  id: string;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  logo?: boolean;
  className?: string;
  bg?: ReactNode;
}) {
  return (
    <section className={`scr scr--${tone} ${className}`} data-screen={id} aria-labelledby={`${id}-title`}>
      {bg}
      {tone === 'cream' && <span className="scr-swoosh" aria-hidden="true" />}
      <div className="scr-body">
        {logo && (
          <div className="scr-logo">
            <Logo size={34} dark={tone === 'dark'} />
          </div>
        )}
        {title}
        {children}
      </div>
      {footer && <div className="scr-foot">{footer}</div>}
    </section>
  );
}

/** Título que recebe foco a cada troca de tela (leitores de tela e teclado). */
export function Title({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = document.activeElement;
    const app = el.closest('.phone-app');
    if (!active || active === document.body || (app && app.contains(active))) el.focus({ preventScroll: true });
  }, []);
  return (
    <h1 id={`${id}-title`} ref={ref} tabIndex={-1} className={`scr-title ${className}`}>
      {children}
    </h1>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (prev.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function CameraIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <span className="cam-icon" aria-hidden="true">
      <svg viewBox="0 0 120 100" width="120" height="100">
        <path d="M34 22 l8-12 h36 l8 12 h16 a10 10 0 0 1 10 10 v48 a10 10 0 0 1 -10 10 h-84 a10 10 0 0 1 -10 -10 v-48 a10 10 0 0 1 10 -10 z" fill="none" stroke="#111" strokeWidth="7" strokeLinejoin="round" />
        <circle cx="60" cy="54" r="18" fill="none" stroke="#111" strokeWidth="7" />
        {crossed && <path d="M14 94 L106 10" stroke="#e30613" strokeWidth="8" strokeLinecap="round" />}
      </svg>
      <span className="cam-burst" />
    </span>
  );
}

export function Spinner({ dots = false }: { dots?: boolean }) {
  if (dots)
    return (
      <span className="spin-dots" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-34px)`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </span>
    );
  return <span className="spin-ring" aria-hidden="true" />;
}
