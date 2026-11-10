import { useEffect, useRef } from 'react';
import { REACTION_EMOJI, REACTION_IDS, type Phase, type ReactionId } from '../../../shared/config';
import type { ReactionBatchItem } from '../../../shared/types';
import { IMG, Logo } from '../Brand';

/** Geometria interna do LED (px de design). */
const W = 620;
const H = 870;
const CX = W / 2;
const CY = H / 2;
const A = W / 2;
const B = H / 2;
const MAX_LIVE = 16;
const LANE_INSET = 64;

const halfWidthAt = (y: number) => A * Math.sqrt(Math.max(0, 1 - ((y - CY) / B) ** 2));

interface Props {
  phase: Phase;
  onReactions: (l: (b: ReactionBatchItem[]) => void) => () => void;
  reducedMotion: boolean;
  runId: number;
}

export function LedOval({ phase, onReactions, reducedMotion, runId }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const live = useRef(0);
  const side = useRef(0);
  const comboRef = useRef<HTMLDivElement>(null);
  const combo = useRef({ n: 0, r: 'fire' as ReactionId, t: 0 as number | undefined });
  const rmRef = useRef(reducedMotion);
  rmRef.current = reducedMotion;

  const spawn = (r: ReactionId, delay = 0) => {
    const el = layer.current;
    if (!el) return false;
    if (live.current >= MAX_LIVE) return false;
    live.current++;
    const s = (side.current = 1 - side.current);
    const span = document.createElement('span');
    span.className = 'led-emoji';
    span.textContent = REACTION_EMOJI[r];
    const size = 54 + Math.random() * 24;
    span.style.fontSize = `${size}px`;
    el.appendChild(span);

    const y0 = 590 + Math.random() * 30;
    const y1 = 120 + Math.random() * 60;
    const sway = (Math.random() * 2 - 1) * 14;
    const inset = LANE_INSET + Math.random() * 26;
    const xAt = (y: number) => CX + (s ? 1 : -1) * (halfWidthAt(y) - inset);
    const frames: Keyframe[] = [];
    if (rmRef.current) {
      const y = y0 - (y0 - y1) * (0.3 + Math.random() * 0.4);
      const x = xAt(y);
      frames.push(
        { transform: `translate(${x}px, ${y}px) translate(-50%,-50%)`, opacity: 0, offset: 0 },
        { transform: `translate(${x}px, ${y}px) translate(-50%,-50%)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${x}px, ${y}px) translate(-50%,-50%)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${x}px, ${y}px) translate(-50%,-50%)`, opacity: 0, offset: 1 },
      );
    } else {
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = y0 - (y0 - y1) * t;
        const x = xAt(y) + Math.sin(t * Math.PI * 2) * sway;
        const scale = t < 0.12 ? 0.5 + (t / 0.12) * 0.65 : 1.15 - t * 0.3;
        const opacity = t < 0.1 ? t / 0.1 : t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
        frames.push({
          transform: `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${scale.toFixed(3)}) rotate(${(Math.sin(t * 5) * 8).toFixed(1)}deg)`,
          opacity,
          offset: t,
        });
      }
    }
    const anim = span.animate(frames, {
      duration: rmRef.current ? 1600 : 2600 + Math.random() * 900,
      delay,
      easing: 'cubic-bezier(.25,.7,.35,1)',
      fill: 'both',
    });
    const done = () => {
      span.remove();
      live.current = Math.max(0, live.current - 1);
    };
    anim.onfinish = done;
    anim.oncancel = done;
    return true;
  };

  const showCombo = (r: ReactionId, n: number) => {
    const el = comboRef.current;
    if (!el) return;
    const c = combo.current;
    c.n = (Date.now() - (c.t ?? 0) < 1500 ? c.n : 0) + n;
    c.r = r;
    c.t = Date.now();
    el.textContent = `${REACTION_EMOJI[r]} +${c.n}`;
    el.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 10px) scale(.9)' },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.15 },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.75 },
        { opacity: 0, transform: 'translate(-50%, -6px) scale(1)' },
      ],
      { duration: 1400, fill: 'both' },
    );
  };

  useEffect(
    () =>
      onReactions((batch) => {
        let overflow = 0;
        let overflowR: ReactionId = 'fire';
        let k = 0;
        for (const item of batch) {
          for (let i = 0; i < item.n; i++) {
            const ok = spawn(item.r, k++ * 90);
            if (!ok) {
              overflow++;
              overflowR = item.r;
            }
          }
        }
        if (overflow > 0) showCombo(overflowR, overflow);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onReactions],
  );

  // Explosão gráfica no drop (dentro do LED, preservando o centro).
  useEffect(() => {
    if (phase !== 'drop') return;
    for (let i = 0; i < 14; i++) spawn(REACTION_IDS[i % REACTION_IDS.length], i * 110);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runId]);

  return (
    <div className="led-oval" aria-hidden="true">
      <div className="led-bezel" />
      <div className="led-screen">
        <div className="led-vignette" />
        <div className="led-logo">
          <Logo size={50} dark />
        </div>
        <div className="led-content">
          <div className="led-drift">
            <div className="led-bounce">
              <img className="led-lek" src={IMG.lekLed} alt="" draggable={false} />
              <span className="platter platter-l">
                <i />
              </span>
              <span className="platter platter-r">
                <i />
              </span>
              <div className="led-console">
                <div className="eq">
                  {Array.from({ length: 16 }, (_, i) => (
                    <span key={i} style={{ animationDelay: `${(i * 37) % 300}ms` }} />
                  ))}
                </div>
                <div className="console-strip" />
              </div>
            </div>
          </div>
        </div>
        <svg className="led-wave" viewBox="0 0 1200 80" preserveAspectRatio="none">
          <path
            d="M0 40 C 50 10, 100 10, 150 40 S 250 70, 300 40 S 400 10, 450 40 S 550 70, 600 40 S 700 10, 750 40 S 850 70, 900 40 S 1000 10, 1050 40 S 1150 70, 1200 40"
            fill="none"
            stroke="#ffd200"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
        <div className="led-reactions" ref={layer} />
        <div className="led-combo" ref={comboRef} />
        <div className="led-pixels" />
        <div className="led-scan" />
      </div>
    </div>
  );
}
