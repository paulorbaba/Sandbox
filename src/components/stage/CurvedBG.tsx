import { useEffect, useRef } from 'react';
import type { SessionState } from '../../../shared/types';
import type { ReactionBatchItem } from '../../../shared/types';
import { Logo } from '../Brand';
import { buildupCount, currentRhythm } from './stageModel';
import { useNow } from '../../lib/util';

export const BG_W = 1160;
export const BG_H = 652;
/** Recorte côncavo: painel curvo visto de frente (centro mais distante). */
export const BG_CLIP = `M0,0 Q${BG_W / 2},${BG_H * 0.085} ${BG_W},0 L${BG_W},${BG_H} Q${BG_W / 2},${BG_H * 0.915} 0,${BG_H} Z`;

type Mode = 'yellow' | 'waves' | 'rays';

function modeFor(s: SessionState): Mode {
  if (s.phase === 'lobby' || s.phase === 'drop' || s.phase === 'ended') return 'yellow';
  if (s.phase === 'mission' || s.phase === 'buildup') return 'rays';
  return 'waves';
}

interface Props {
  state: SessionState;
  intensity: number;
  onReactions: (l: (b: ReactionBatchItem[]) => void) => () => void;
  reducedMotion: boolean;
}

export function CurvedBG({ state, intensity, onReactions, reducedMotion }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ intensity, mode: modeFor(state), pulse: 0, rm: reducedMotion, bpm: 120, celebrate: false });
  live.current.celebrate = state.phase === 'drop';
  live.current.intensity = intensity;
  live.current.mode = modeFor(state);
  live.current.rm = reducedMotion;
  live.current.bpm = currentRhythm(state)?.bpm ?? 120;

  useEffect(
    () =>
      onReactions((batch) => {
        const n = batch.reduce((a, b) => a + b.n, 0);
        live.current.pulse = Math.min(1.4, live.current.pulse + 0.12 * n);
      }),
    [onReactions],
  );

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    let t = 0;
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      if (ts - last < 1000 / 40) return; // ~40 fps é suficiente para ondas suaves
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const L = live.current;
      const speed = L.rm ? 0.15 : 0.6 + L.intensity * 1.4;
      t += dt * speed;
      L.pulse *= Math.pow(0.18, dt);
      const amp = (L.rm ? 0.5 : 1) * (0.35 + L.intensity * 0.75 + L.pulse * 0.35);
      const beat = L.rm ? 0 : Math.pow(Math.max(0, Math.cos(((ts / 1000) * L.bpm * Math.PI) / 60)), 12);
      const w = c.width;
      const h = c.height;
      ctx.globalCompositeOperation = 'source-over';

      if (L.mode === 'yellow') {
        ctx.fillStyle = '#ffd200';
        ctx.fillRect(0, 0, w, h);
        if (L.celebrate) {
          // raios de comemoração no drop
          ctx.save();
          ctx.translate(w * 0.58, h * 0.48);
          ctx.rotate(L.rm ? 0 : t * 0.08);
          const n = 24;
          ctx.fillStyle = 'rgba(245,163,0,.35)';
          for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI * 2;
            const a1 = a0 + Math.PI / n;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a0) * 1200, Math.sin(a0) * 1200);
            ctx.lineTo(Math.cos(a1) * 1200, Math.sin(a1) * 1200);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
        // ondas tonais discretas
        ctx.globalAlpha = 0.18;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 12) {
            const y = h * (0.3 + k * 0.17) + Math.sin(x / (140 + k * 40) + t * (1 + k * 0.3)) * 22 * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = '#f5a300';
          ctx.lineWidth = 26;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // recorte vermelho na base (como no KV)
        ctx.fillStyle = '#e30613';
        ctx.beginPath();
        ctx.moveTo(w * 0.42, h);
        ctx.quadraticCurveTo(w * 0.78, h * (0.84 - beat * 0.01), w, h * 0.78);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        return;
      }

      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b0203');
      g.addColorStop(0.55, '#2a0306');
      g.addColorStop(1, '#120102');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (L.mode === 'rays') {
        ctx.save();
        ctx.translate(w / 2, h * 0.52);
        const n = 44;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + t * 0.05;
          const r0 = 230 + (i % 3) * 18;
          const r1 = r0 + 90 + ((i * 37) % 70) + beat * 40;
          ctx.strokeStyle = `rgba(255,${60 + (i % 4) * 20},40,${0.35 + L.intensity * 0.45})`;
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.62);
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.62);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'lighter';
      const waves = 7;
      for (let k = 0; k < waves; k++) {
        const base = h * (L.mode === 'rays' ? 0.82 : 0.8) + (k - waves / 2) * 6;
        const freq = 1 / (110 + k * 13);
        const ph = t * (1.2 + k * 0.18) + k * 0.7;
        const hue = k < 3 ? [255, 40, 30] : k < 5 ? [255, 120, 30] : [255, 210, 0];
        for (const [lw, al] of [
          [16, 0.06],
          [6, 0.16],
          [2.2, 0.9],
        ] as const) {
          ctx.beginPath();
          for (let x = -10; x <= w + 10; x += 8) {
            const env = Math.sin((x / w) * Math.PI) * 0.8 + 0.2;
            const y =
              base +
              Math.sin(x * freq + ph) * 60 * amp * env +
              Math.sin(x * freq * 2.3 - ph * 1.3) * 18 * amp * env +
              beat * -14 * env;
            if (x === -10) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${hue[0]},${hue[1]},${hue[2]},${al * (0.55 + L.intensity * 0.45)})`;
          ctx.lineWidth = lw;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rhythm = currentRhythm(state);
  const now = useNow(100, state.phase === 'buildup');
  const count = buildupCount(state);
  void now;

  return (
    <div className="bg-panel" data-mode={modeFor(state)}>
      <div className="bg-curve" style={{ clipPath: `path('${BG_CLIP}')` }}>
        <canvas ref={canvas} width={BG_W} height={BG_H} className="bg-canvas" />
        <div className="bg-copy" key={`${state.phase}-${state.phase === 'set' ? state.block : 0}-${count ?? ''}`}>
          {state.phase === 'lobby' && (
            <>
              <Logo size={64} />
              <h2 className="brand-headline bg-h1">
                <span className="burst">Lek Trek</span>
                <br />
                <span className="red">Live</span>
              </h2>
            </>
          )}
          {state.phase === 'reveal' && (
            <>
              <p className="bg-kicker">A galera escolheu</p>
              <h2 className="brand-headline bg-h1 white">{rhythm?.name ?? 'Escolha da galera'}</h2>
              <p className="bg-sub">{rhythm?.vibe}</p>
            </>
          )}
          {state.phase === 'set' && (
            <>
              <Logo size={52} dark />
              <h2 className="brand-headline bg-h1 white">
                Pista <span className="yellow">ON</span>
              </h2>
              <p className="bg-sub">
                Ritmo {state.block + 1} de {Math.max(1, state.setlist.length)} · {rhythm?.name}
              </p>
            </>
          )}
          {state.phase === 'mission' && (
            <>
              <Logo size={52} dark />
              <h2 className="brand-headline bg-h1 white">
                Juntos pro <span className="yellow">drop</span>
              </h2>
            </>
          )}
          {state.phase === 'buildup' && (
            <div className="bg-count" aria-live="polite">
              {count}
            </div>
          )}
          {state.phase === 'drop' && (
            <>
              <Logo size={60} />
              <h2 className="brand-headline bg-h1 bg-drop">
                <span className="burst">Modo ON</span>
                <br />
                <span className="red">Ativado</span>
              </h2>
            </>
          )}
          {state.phase === 'ended' && (
            <>
              <Logo size={60} />
              <h2 className="brand-headline bg-h1">
                Esse ON foi
                <br />
                <span className="red">de vocês</span>
              </h2>
              <p className="bg-sub dark">Ative seu modo ON</p>
            </>
          )}
        </div>
        <div className="bg-shade" />
      </div>
      <svg className="bg-frame" viewBox={`0 0 ${BG_W} ${BG_H}`} width={BG_W} height={BG_H} aria-hidden="true">
        <path d={BG_CLIP} fill="none" stroke="rgba(0,0,0,.85)" strokeWidth="10" />
        <path d={BG_CLIP} fill="none" stroke="rgba(255,190,120,.35)" strokeWidth="2" />
      </svg>
    </div>
  );
}
