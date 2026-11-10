import { useRef, type ReactNode } from 'react';
import { REACTIONS, rhythmById, type ReactionId } from '../../shared/config';
import type { SessionState } from '../../shared/types';
import { IMG } from '../components/Brand';
import { buildupCount } from '../components/stage/stageModel';
import { useNow } from '../lib/util';
import { Screen, Title } from './ui';

const SEND_INTERVAL_MS = 300;

/** Barra de reações: confirma o toque no próprio celular antes de enviar. */
export function ReactionBar({ onReact, disabled, label = 'Toque para reagir' }: { onReact: (r: ReactionId) => boolean; disabled?: boolean; label?: string }) {
  const fx = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);
  const tap = (r: ReactionId, emoji: string, el: HTMLButtonElement) => {
    if (disabled) return;
    navigator.vibrate?.(12);
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.84)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], {
      duration: 260,
      easing: 'ease-out',
    });
    const layer = fx.current;
    if (layer) {
      const s = document.createElement('span');
      s.className = 'tap-fx';
      s.textContent = emoji;
      const box = el.getBoundingClientRect();
      const lb = layer.getBoundingClientRect();
      s.style.left = `${box.left - lb.left + box.width / 2}px`;
      layer.appendChild(s);
      const dx = (Math.random() * 2 - 1) * 30;
      s.animate(
        [
          { transform: 'translate(-50%, 0) scale(.7)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx / 2}px), -40px) scale(1.15)`, opacity: 1, offset: 0.2 },
          { transform: `translate(calc(-50% + ${dx}px), -170px) scale(1)`, opacity: 0 },
        ],
        { duration: 900, easing: 'cubic-bezier(.2,.7,.3,1)' },
      ).onfinish = () => s.remove();
    }
    const now = Date.now();
    if (now - lastSent.current >= SEND_INTERVAL_MS) {
      lastSent.current = now;
      onReact(r);
    }
  };
  return (
    <div className="react-bar">
      <div className="react-fx" ref={fx} aria-hidden="true" />
      <p className="react-label" id="react-label">
        {label}
      </p>
      <div className="react-buttons" role="group" aria-labelledby="react-label">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="react-btn"
            disabled={disabled}
            aria-label={`Enviar reação: ${r.label}`}
            onClick={(e) => tap(r.id, r.emoji, e.currentTarget)}
          >
            <span aria-hidden="true">{r.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LiveBackground({ src = IMG.pista, children }: { src?: string; children?: ReactNode }) {
  return (
    <div className="live-bg" aria-hidden="true">
      <img src={src} alt="" />
      <div className="live-scrim" />
      {children}
    </div>
  );
}

/* C08 / C09 · Live */
export function Live({
  state,
  connected,
  onReact,
  recordAvailable,
  onRecord,
  celebrate,
}: {
  state: SessionState;
  connected: boolean;
  onReact: (r: ReactionId) => boolean;
  recordAvailable: boolean;
  onRecord: () => void;
  celebrate: boolean;
}) {
  const mission = state.phase === 'mission';
  const drop = state.phase === 'drop';
  const buildup = state.phase === 'buildup';
  useNow(200, buildup);
  const count = buildupCount(state);
  const rhythm = rhythmById(state.setlist[state.block] ?? state.winner);
  const value = mission ? state.dropCharge : state.energy;
  const id = mission || buildup ? 'C09' : 'C08';
  return (
    <Screen id={id} tone="dark" className="live" bg={<LiveBackground />}>
      <div className="live-top">
        <span className="pill pill-red live-pill">
          <span className="dot" aria-hidden="true" /> AO VIVO
        </span>
        {mission ? (
          <span className="pill pill-yellow">Pista ON</span>
        ) : (
          <span className="pill pill-dark energy-pill">
            Energia da pista <strong>{Math.round(state.energy)}%</strong>
          </span>
        )}
      </div>
      <Title id={id} className="sr-only">
        {mission ? 'Missão do drop' : drop ? 'Modo ON ativado' : buildup ? 'Build-up' : 'Live'}
      </Title>
      {rhythm && !drop && <p className="live-rhythm">{rhythm.name}</p>}

      <div className="live-center">
        {buildup && (
          <div className="live-count" aria-live="assertive">
            <p>Seu clipe vem aí. Aponte pra cabine!</p>
            <strong>{count}</strong>
          </div>
        )}
        {drop && (
          <div className={`live-drop ${celebrate ? 'is-new' : ''}`} role="status">
            <span className="brand-headline">
              Modo ON
              <br />
              <em>ativado</em>
            </span>
          </div>
        )}
      </div>

      <div className="live-bottom">
        {mission && (
          <div className="drop-meter" role="meter" aria-label="Libere o drop" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
            <span className="drop-meter-fill" style={{ width: `${Math.min(100, value)}%` }} />
            <span className="drop-meter-label">{state.dropReady ? 'Drop liberado!' : state.assisted ? 'Lek Trek puxando a batida' : 'Libere o drop'}</span>
            <strong>{Math.round(value)}%</strong>
          </div>
        )}
        <p className="support-text">
          {mission
            ? 'Vamos juntos pro drop'
            : drop
              ? 'Esse ON é da galera!'
              : buildup
                ? 'Galera junto? Três, dois, um…'
                : 'Reage no celular. Mantém o set ON.'}
        </p>
        {recordAvailable && (
          <button type="button" className="rec-entry" onClick={onRecord}>
            <span className="rec-dot" aria-hidden="true" /> Gravar meu rolê
          </button>
        )}
        <ReactionBar onReact={onReact} disabled={!connected} />
      </div>
    </Screen>
  );
}
