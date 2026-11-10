import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ENERGY, REACTIONS, isLivePhase } from '../../../shared/config';
import type { ReactionBatchItem, SessionState } from '../../../shared/types';
import { serverNow } from '../../lib/realtime';
import { fmtClock, useNow } from '../../lib/util';
import { IMG, Logo, PowerIcon } from '../Brand';
import { QrCode } from '../QrCode';
import { CurvedBG } from './CurvedBG';
import { LedOval } from './LedOval';
import { buildupCount, currentRhythm, intensityOf, lekLine } from './stageModel';
import './stage.css';

const STAGE_W = 1920;
const STAGE_H = 1080;

export type ReactionSubscribe = (l: (b: ReactionBatchItem[]) => void) => () => void;

interface Props {
  state: SessionState;
  onReactions: ReactionSubscribe;
  joinUrl: string;
  reducedMotion: boolean;
}

/** Escala o palco 1920×1080 para caber no contêiner, mantendo 16:9. */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, scale };
}

export function StageScene({ state, onReactions, joinUrl, reducedMotion }: Props) {
  const { ref, scale } = useFit();
  const rhythm = currentRhythm(state);
  const intensity = intensityOf(state);
  const beat = 60 / (rhythm?.bpm ?? 118);
  const [clapPulse, setClapPulse] = useState(0);

  useEffect(() => {
    if (state.lastClapAt) setClapPulse((n) => n + 1);
  }, [state.lastClapAt]);

  const style = {
    '--intensity': intensity.toFixed(3),
    '--beat': `${beat.toFixed(3)}s`,
    transform: `translate(-50%, -50%) scale(${scale})`,
  } as CSSProperties;

  return (
    <div className="stage-viewport" ref={ref}>
      <div
        className="stage"
        style={style}
        data-phase={state.phase}
        data-view={state.view}
        data-rm={reducedMotion ? 'true' : 'false'}
        role="img"
        aria-label={`Palco Lek Trek LIVE — ${lekLine(state)}`}
      >
        <RoomBackdrop />
        {state.view === 'fachada' ? (
          <FacadeView state={state} joinUrl={joinUrl} onReactions={onReactions} />
        ) : (
          <>
            <CurvedBG state={state} intensity={intensity} onReactions={onReactions} reducedMotion={reducedMotion} />
            <LedOval phase={state.phase} onReactions={onReactions} reducedMotion={reducedMotion} runId={state.runId} />
            <SpeechBubble text={lekLine(state)} />
            <StageHeader state={state} />
            {state.phase === 'lobby' && state.qrVisible ? (
              <QrReception state={state} joinUrl={joinUrl} />
            ) : (
              <EnergyHud state={state} />
            )}
            {state.qrVisible && state.phase !== 'lobby' && state.phase !== 'ended' && (
              <div className="qr-mini">
                <QrCode value={joinUrl} size={132} label="QR code para entrar na sessão" />
                <span>Entre na pista</span>
              </div>
            )}
          </>
        )}
        {clapPulse > 0 && <div className="clap-pulse" key={clapPulse} />}
        {state.phase === 'drop' && !reducedMotion && <div className="drop-flash" key={state.runId} />}
      </div>
    </div>
  );
}

function RoomBackdrop() {
  const ribs = 34;
  const ceil = Array.from({ length: ribs }, (_, i) => {
    const a = Math.PI + 0.08 + (i / (ribs - 1)) * (Math.PI - 0.16);
    const cx = 1180;
    const cy = 250;
    const x0 = cx + Math.cos(a) * 330;
    const y0 = cy + Math.sin(a) * 90;
    const x1 = cx + Math.cos(a) * 1500;
    const y1 = cy + Math.sin(a) * 520;
    return { x0, y0, x1, y1, d: (i * 0.06) % 2 };
  });
  const floor = Array.from({ length: 30 }, (_, i) => {
    const a = 0.12 + (i / 29) * (Math.PI - 0.24);
    const cx = 1150;
    const cy = 880;
    return {
      x0: cx + Math.cos(a) * 360,
      y0: cy + Math.sin(a) * 60,
      x1: cx + Math.cos(a) * 1500,
      y1: cy + Math.sin(a) * 420,
      d: (i * 0.07) % 2,
    };
  });
  return (
    <svg className="room" viewBox="0 0 1920 1080" width="1920" height="1080" aria-hidden="true">
      <defs>
        <radialGradient id="roomBg" cx="58%" cy="42%" r="75%">
          <stop offset="0" stopColor="#3b0709" />
          <stop offset=".45" stopColor="#1a0304" />
          <stop offset="1" stopColor="#060101" />
        </radialGradient>
        <radialGradient id="ceilHole" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset=".6" stopColor="#f2a920" />
          <stop offset="1" stopColor="#7a3d00" />
        </radialGradient>
        <linearGradient id="floorGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a0405" stopOpacity="0" />
          <stop offset="1" stopColor="#5b0a0a" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#roomBg)" />
      <ellipse cx="1180" cy="250" rx="330" ry="90" fill="url(#ceilHole)" opacity=".85" />
      <ellipse cx="1180" cy="250" rx="330" ry="90" fill="none" stroke="#ffcf5a" strokeWidth="6" opacity=".7" />
      <g className="ribs ceil">
        {ceil.map((r, i) => (
          <g key={i} style={{ animationDelay: `${r.d}s` }}>
            <line x1={r.x0} y1={r.y0} x2={r.x1} y2={r.y1} className="rib-glow" />
            <line x1={r.x0} y1={r.y0} x2={r.x1} y2={r.y1} className="rib-core" />
          </g>
        ))}
      </g>
      <rect y="760" width="1920" height="320" fill="url(#floorGlow)" />
      <g className="ribs floor">
        {floor.map((r, i) => (
          <g key={i} style={{ animationDelay: `${r.d}s` }}>
            <line x1={r.x0} y1={r.y0} x2={r.x1} y2={r.y1} className="rib-glow" />
            <line x1={r.x0} y1={r.y0} x2={r.x1} y2={r.y1} className="rib-core" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <div className="lek-line" key={text} aria-live="polite">
      <span className="lek-line-who">Lek Trek</span>
      <span className="lek-line-text">{text}</span>
    </div>
  );
}

function StageHeader({ state }: { state: SessionState }) {
  const live = isLivePhase(state.phase);
  return (
    <div className="stage-header">
      <div className="stage-brand">
        <Logo size={40} dark />
        <span className="stage-brand-sep" />
        <span className="stage-brand-name">
          LEK TREK LIVE
          <small>Sessão {state.number}</small>
        </span>
      </div>
      <div className="stage-status">
        {live && (
          <span className="pill pill-red stage-live">
            <span className="dot" /> AO VIVO
          </span>
        )}
        <span className="stage-count">
          <strong>{state.counts.ready}</strong> {state.counts.ready === 1 ? 'pessoa na pista' : 'pessoas na pista'}
        </span>
      </div>
    </div>
  );
}

function QrReception({ state, joinUrl }: { state: SessionState; joinUrl: string }) {
  const short = joinUrl.replace(/^https?:\/\//, '');
  return (
    <div className="qr-reception">
      <QrCode value={joinUrl} size={196} label="QR code para entrar na sessão pelo celular" />
      <div className="qr-copy">
        <p className="qr-kicker">Seu ritmo. Sua galera. Seu modo ON.</p>
        <h3>Escaneie e entre na pista</h3>
        <p className="qr-url">{short}</p>
        <div className="qr-counts">
          <span>
            <strong>{state.counts.connected}</strong> conectados
          </span>
          <span>
            <strong>{state.counts.ready}</strong> prontos
          </span>
          <span>
            <strong>{Object.values(state.votes).reduce((a, b) => a + b, 0)}</strong> votos
          </span>
        </div>
      </div>
    </div>
  );
}

function EnergyHud({ state }: { state: SessionState }) {
  const mission = state.phase === 'mission';
  const value = mission ? state.dropCharge : state.phase === 'lobby' || state.phase === 'reveal' ? state.energy : state.energy;
  const label = mission ? 'Libere o drop' : state.phase === 'drop' ? 'Modo ON ativado' : state.phase === 'ended' ? 'Energia da galera' : 'Energia da pista';
  const now = useNow(250, mission);
  void now;
  const remaining = mission && state.missionEndsAt ? state.missionEndsAt - serverNow() : null;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const count = buildupCount(state);
  const band = value >= ENERGY.highBand ? 'Alta' : value >= ENERGY.lowBand ? 'Média' : 'Baixa';
  return (
    <div className={`hud ${mission ? 'is-mission' : ''} ${state.dropReady && mission ? 'is-ready' : ''}`}>
      <div className="hud-ring">
        <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
          <circle cx="60" cy="60" r={r} className="ring-track" />
          <circle
            cx="60"
            cy="60"
            r={r}
            className="ring-fill"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - Math.min(100, value) / 100)}
          />
        </svg>
        <span className="hud-power">
          <PowerIcon size={54} stroke={3} />
        </span>
      </div>
      <div className="hud-main">
        <div className="hud-top">
          <span className="hud-label">{label}</span>
          <span className="hud-value">{count ?? `${Math.round(value)}%`}</span>
        </div>
        <div className="hud-bar" role="presentation">
          <span className={`hud-fill ${state.assisted && mission ? 'assisted' : ''}`} style={{ width: `${Math.min(100, value)}%` }} />
          {!mission && (
            <>
              <i className="hud-tick" style={{ left: `${ENERGY.lowBand}%` }} />
              <i className="hud-tick" style={{ left: `${ENERGY.highBand}%` }} />
            </>
          )}
        </div>
        <div className="hud-foot">
          {mission ? (
            <>
              <span className="chip ok">Pista ON · {Math.round(state.energy)}%</span>
              {state.dropReady ? (
                <span className="chip ready">Pista pronta pro drop!</span>
              ) : state.assisted ? (
                <span className="chip assist">Lek Trek puxando a batida</span>
              ) : (
                <span className="chip">Faltam {fmtClock(remaining ?? 0)}</span>
              )}
            </>
          ) : state.phase === 'set' ? (
            <>
              <span className="chip">Faixa {band.toLowerCase()}</span>
              <span className="hud-emojis" aria-hidden="true">
                {REACTIONS.map((r) => (
                  <span key={r.id}>{r.emoji}</span>
                ))}
              </span>
              <span className="chip">{state.totalReactions} reações</span>
            </>
          ) : (
            <span className="chip">{state.totalReactions} reações da galera</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FacadeView({ state, joinUrl, onReactions }: { state: SessionState; joinUrl: string; onReactions: ReactionSubscribe }) {
  const yellow = state.phase === 'lobby' || state.phase === 'ended' || state.phase === 'reveal';
  const drop = state.phase === 'drop';
  const value = state.phase === 'mission' ? state.dropCharge : state.energy;
  const [pop, setPop] = useState<string | null>(null);
  useEffect(
    () =>
      onReactions((b) => {
        const last = b[b.length - 1];
        if (last) setPop(`${last.r}-${Date.now()}`);
      }),
    [onReactions],
  );
  const r = 150;
  const circ = 2 * Math.PI * r;
  return (
    <div className={`facade ${yellow || drop ? 'is-yellow' : 'is-dark'}`}>
      <div className="facade-inner">
        <Logo size={64} dark={!(yellow || drop)} />
        {drop ? (
          <h2 className="brand-headline facade-h">
            <span className="burst">Modo ON</span>
            <br />
            <span className="red">Ativado</span>
          </h2>
        ) : yellow ? (
          <>
            <h2 className="brand-headline facade-h">
              <span className="burst">A pista</span>
              <br />
              tá ON
            </h2>
            <img className="facade-lek" src={IMG.lekPoint} alt="" />
            <p className="facade-call">Vem com a sua galera.</p>
            {state.phase !== 'ended' && (
              <div className="facade-qr">
                <QrCode value={joinUrl} size={150} label="QR code da experiência" />
                <span>
                  QR DA
                  <br />
                  EXPERIÊNCIA
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="brand-headline facade-h white">
              A energia
              <br />
              da galera
            </h2>
            <div className="facade-ring">
              <svg viewBox="0 0 340 340" width="340" height="340" aria-hidden="true">
                <circle cx="170" cy="170" r={r} className="ring-track" />
                <circle
                  cx="170"
                  cy="170"
                  r={r}
                  className="ring-fill"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - Math.min(100, value) / 100)}
                />
              </svg>
              <span>{Math.round(value)}%</span>
            </div>
            <p className="pill pill-dark facade-status">
              {state.phase === 'mission' ? 'Liberando o drop!' : 'Sessão em andamento.'}
            </p>
            <div className="facade-emojis" aria-hidden="true">
              {REACTIONS.map((x) => (
                <span key={pop?.startsWith(x.id) ? pop : x.id} className={pop?.startsWith(x.id) ? 'pop' : ''}>
                  {x.emoji}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
