import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, size = 200, label, dark = '#111111' }: { value: string; size?: number; label?: string; dark?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark, light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [value, dark]);
  return (
    <div
      className="qr"
      role="img"
      aria-label={label ?? `QR code para ${value}`}
      style={{ width: size, height: size, background: '#fff', borderRadius: 12, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
