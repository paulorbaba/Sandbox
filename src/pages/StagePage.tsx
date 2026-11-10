import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StageScene } from '../components/stage/StageScene';
import { Logo } from '../components/Brand';
import { useWatcherChannel } from '../lib/realtime';
import { links, useReducedMotion } from '../lib/util';
import { useStageAudio } from '../lib/audio';
import { currentRhythm, intensityOf } from '../components/stage/stageModel';
import './pages.css';

/** Palco em tela cheia: sem controles técnicos. Só "tela cheia" e "som" aparecem ao mover o mouse. */
export default function StagePage() {
  const { sessionId = '' } = useParams();
  const { state, status, onReactions } = useWatcherChannel({ sessionId, role: 'stage' });
  const [reduced] = useReducedMotion();
  const [chrome, setChrome] = useState(true);
  const timer = useRef<number>(undefined);
  const audio = useStageAudio();

  useEffect(() => {
    document.title = 'Palco · Lek Trek LIVE';
    const wake = () => {
      setChrome(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setChrome(false), 2500);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('touchstart', wake);
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    audio.update({ phase: state.phase, rhythm: currentRhythm(state)?.id ?? null, intensity: intensityOf(state) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.block, state?.setlist, state?.energy, state?.dropCharge]);

  if (status === 'not_found') {
    return (
      <main className="gate dark">
        <Logo size={42} dark />
        <h1>Sessão não encontrada</h1>
        <p>Ela pode ter expirado ou o servidor foi reiniciado (as sessões ficam só em memória).</p>
        <Link className="btn btn-primary" to="/">
          Criar nova sessão
        </Link>
      </main>
    );
  }

  return (
    <main className="stage-page" data-chrome={chrome ? 'on' : 'off'}>
      <h1 className="sr-only">Palco virtual Lek Trek LIVE</h1>
      {state ? (
        <StageScene state={state} onReactions={onReactions} joinUrl={links(state.id).participant} reducedMotion={reduced} />
      ) : (
        <div className="stage-loading" role="status">
          <Logo size={48} dark />
          <span>Conectando ao palco…</span>
        </div>
      )}
      {status === 'reconnecting' && state && (
        <div className="stage-reconnect" role="status">
          Reconectando…
        </div>
      )}
      <div className="stage-chrome">
        <button
          type="button"
          className="chrome-btn"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        >
          Tela cheia
        </button>
        <button type="button" className="chrome-btn" aria-pressed={audio.enabled} onClick={() => audio.toggle()}>
          {audio.enabled ? 'Som: ligado' : 'Ativar som'}
        </button>
      </div>
    </main>
  );
}
