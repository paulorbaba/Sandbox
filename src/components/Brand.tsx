import type { CSSProperties } from 'react';

export function PowerIcon({ size = '1em', stroke = 2.6, style }: { size?: string | number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} aria-hidden="true" focusable="false">
      <path d="M7.05 6.4a8 8 0 1 0 9.9 0" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M12 2.6v8.2" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

/** Wordmark provisório "Sadia ON" (sem arquivo oficial no repositório). */
export function Logo({ size = 32, dark = false, className = '' }: { size?: number; dark?: boolean; className?: string }) {
  return (
    <span className={`logo ${dark ? 'on-dark' : ''} ${className}`} style={{ fontSize: size }} role="img" aria-label="Sadia ON">
      <span className="logo-sadia" aria-hidden="true">
        Sadia
      </span>
      <span className="logo-on" aria-hidden="true">
        <PowerIcon stroke={3.4} />N
      </span>
    </span>
  );
}

export const IMG = {
  lekLed: '/img/lek_led.webp',
  lekUp: '/img/lek_up.webp',
  lekPoint: '/img/lek_point.webp',
  pov: '/img/photo_pov.webp',
  selfie: '/img/photo_selfie.webp',
  pista: '/img/photo_pista.webp',
  drop: '/img/photo_drop.webp',
  fachada: '/img/render_fachada.webp',
};

export function Swoosh({ className = '' }: { className?: string }) {
  return (
    <svg className={`swoosh ${className}`} viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M10 118 C 60 40, 130 20, 200 14" fill="none" stroke="var(--yellow)" strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}
