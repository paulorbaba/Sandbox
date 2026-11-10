import type { ReactNode } from 'react';

/** Enquadramento de celular para desktop. Em telas pequenas, o conteúdo ocupa a tela inteira. */
export function PhoneFrame({ children, label = 'Celular do participante', always = false }: { children: ReactNode; label?: string; always?: boolean }) {
  return (
    <div className={`phone-frame ${always ? 'always' : ''}`} aria-label={label} role="region">
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">{children}</div>
    </div>
  );
}
