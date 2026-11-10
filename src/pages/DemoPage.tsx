import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PHASE_LABEL, type Phase } from '../../shared/config';
import type { ControlCommand } from '../../shared/types';
import { Logo } from '../components/Brand';
import { PhoneFrame } from '../components/PhoneFrame';
import { StageScene } from '../components/stage/StageScene';
import { ParticipantApp, type ScreenId } from '../participant/ParticipantApp';
import type { CameraFailure } from '../lib/camera';
import { createSession, useWatcherChannel } from '../lib/realtime';
import { links, useReducedMotion } from '../lib/util';
import './pages.css';

const STORE = 'ltl:demo-session';

const SCREENS: Array<{ id: ScreenId; label: string; phase?: Phase | 'reconnect' }> = [
  { id: 'C01', label: 'Boas-vindas' },
  { id: 'C02', label: 'Cadastro' },
  { id: 'C03', label: 'Pesquisa' },
  { id: 'C04', label: 'Voto no ritmo' },
  { id: 'C05', label: 'Resultado' },
  { id: 'C06', label: 'Câmera opcional' },
  { id: 'C16', label: 'Sem câmera' },
  { id: 'C07', label: 'Espera', phase: 'lobby' },
  { id: 'C08', label: 'Live', phase: 'set' },
  { id: 'C09', label: 'Missão do drop', phase: 'mission' },
  { id: 'C10', label: 'Registro do DJ', phase: 'set' },
  { id: 'C11', label: 'Troca de câmera', phase: 'set' },
  { id: 'C12', label: 'Selfie', phase: 'set' },
  { id: 'C13', label: 'Conclusão', phase: 'ended' },
  { id: 'C14', label: 'Processamento', phase: 'ended' },
  { id: 'C15', label: 'Clipe pronto', phase: 'ended' },
  { id: 'C18', label: 'Falha no vídeo', phase: 'ended' },
  { id: 'C17', label: 'Reconexão', phase: 'reconnect' },
];

async function ensureSession(): Promise<{ id: string; controlKey: string }> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    if (saved?.id) {
      const r = await fetch(`/api/sessions/${saved.id}`);
      if (r.ok) return saved;
    }
  } catch {
    /* cria nova */
  }
  const s = await createSession();
  sessionStorage.setItem(STORE, JSON.stringify({ id: s.id, controlKey: s.controlKey }));
  return s;
}

export default function DemoPage() {
  const [session, setSession] = useState<{ id: string; controlKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Demo individual · Lek Trek LIVE';
    ensureSession()
      .then(setSession)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error)
    return (
      <main className="gate">
        <Logo size={42} />
        <h1>Não foi possível abrir a demonstração</h1>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
          Tentar de novo
        </button>
      </main>
    );
  if (!session)
    return (
      <main className="gate" role="status">
        <Logo size={42} />
        <p>Preparando a demonstração…</p>
      </main>
    );
  return (
    <DemoRoom
      key={session.id}
      session={session}
      onReset={async () => {
        sessionStorage.removeItem(STORE);
        setSession(null);
        setSession(await ensureSession());
      }}
    />
  );
}

function DemoRoom({ session, onReset }: { session: { id: string; controlKey: string }; onReset: () => void }) {
  const { state, onReactions, command } = useWatcherChannel({ sessionId: session.id, role: 'control', controlKey: session.controlKey });
  const [reduced, setReduced] = useReducedMotion();
  const [camFail, setCamFail] = useState<CameraFailure | null>(null);
  const [jump, setJump] = useState<{ screen: ScreenId; nonce: number } | null>(null);
  const [screen, setScreen] = useState('');
  const [tab, setTab] = useState<'phone' | 'stage'>('phone');
  const [msg, setMsg] = useState<string | null>(null);

  const run = useCallback(
    async (cmd: ControlCommand) => {
      const r = await command(cmd);
      if (!r.ok) setMsg(r.error);
      return r.ok;
    },
    [command],
  );

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2500);
    return () => window.clearTimeout(t);
  }, [msg]);

  const goScreen = async (s: (typeof SCREENS)[number]) => {
    if (s.phase === 'reconnect') {
      if (state && (state.phase === 'lobby' || state.phase === 'ended')) await run({ type: 'goto', phase: 'set' });
      setJump({ screen: 'C08', nonce: Date.now() });
      window.setTimeout(() => run({ type: 'forceReconnect' }), 400);
      return;
    }
    if (s.phase && state?.phase !== s.phase) await run({ type: 'goto', phase: s.phase });
    if (!s.phase && state?.phase === 'ended') await run({ type: 'restart' });
    setJump({ screen: s.id, nonce: Date.now() });
  };

  const live = state && ['set', 'mission', 'buildup', 'drop'].includes(state.phase);

  return (
    <div className="demo" data-tab={tab}>
      <header className="demo-head">
        <Link to="/" className="demo-home" aria-label="Voltar para a central">
          <Logo size={28} />
        </Link>
        <div>
          <h1>Demonstração individual</h1>
          <p>Celular simulado e palco na mesma página · sessão própria {state ? `nº ${state.number}` : ''}</p>
        </div>
        <div className="demo-tabs" role="tablist" aria-label="Superfície">
          <button role="tab" type="button" aria-selected={tab === 'phone'} onClick={() => setTab('phone')}>
            Celular
          </button>
          <button role="tab" type="button" aria-selected={tab === 'stage'} onClick={() => setTab('stage')}>
            Palco
          </button>
        </div>
      </header>

      <main className="demo-main">
        <section className="demo-phone" aria-label="Celular simulado">
          <PhoneFrame always>
            <ParticipantApp sessionId={session.id} scope="demo" demoCameraFailure={camFail} jump={jump} onScreen={setScreen} />
          </PhoneFrame>
        </section>

        <section className="demo-stage" aria-label="Palco virtual">
          <div className="preview-16x9">
            {state ? (
              <StageScene state={state} onReactions={onReactions} joinUrl={links(session.id).participant} reducedMotion={reduced} />
            ) : (
              <div className="stage-loading">Conectando…</div>
            )}
          </div>

          <div className="demo-panel">
            <div className="demo-row">
              <span className="demo-label">Etapa</span>
              <strong className="demo-phase">{state ? PHASE_LABEL[state.phase] : '—'}</strong>
              {state?.phase === 'lobby' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => run({ type: 'start' })}>
                  Iniciar a pista
                </button>
              )}
              {state?.phase === 'reveal' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => run({ type: 'goto', phase: 'set' })}>
                  Abrir a pista
                </button>
              )}
              {state?.phase === 'set' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => run({ type: 'goto', phase: 'mission' })}>
                  Missão do drop
                </button>
              )}
              {(state?.phase === 'mission' || state?.phase === 'set') && (
                <button type="button" className={`btn btn-sm ${state.dropReady ? 'btn-primary pulse' : 'btn-dark'}`} onClick={() => run({ type: 'drop' })}>
                  Acionar drop
                </button>
              )}
              {state?.phase === 'drop' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => run({ type: 'end' })}>
                  Encerrar e ver registro
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'restart' })}>
                Reiniciar
              </button>
            </div>
            <div className="demo-row">
              <span className="demo-label">Pista</span>
              <button type="button" className="btn btn-dark btn-sm" disabled={!live} onClick={() => run({ type: 'clap' })}>
                👏 Palmas da sala
              </button>
              <button type="button" className="btn btn-dark btn-sm" disabled={!live} onClick={() => run({ type: 'simulateBurst', count: 10 })}>
                Simular 10 reações
              </button>
              <label className="mini-toggle">
                <input type="checkbox" checked={state?.crowd === 'high'} onChange={(e) => run({ type: 'crowd', level: e.target.checked ? 'high' : 'off' })} />
                Galera simulada
              </label>
              <label className="mini-toggle">
                <input type="checkbox" checked={!!state?.autoDrop} onChange={(e) => run({ type: 'autoDrop', value: e.target.checked })} />
                Drop automático
              </label>
            </div>
            <div className="demo-row">
              <span className="demo-label">Visão</span>
              <div className="seg" role="group" aria-label="Visão do palco">
                <button type="button" aria-pressed={state?.view === 'main'} onClick={() => run({ type: 'view', view: 'main' })}>
                  LED + BG
                </button>
                <button type="button" aria-pressed={state?.view === 'fachada'} onClick={() => run({ type: 'view', view: 'fachada' })}>
                  Fachada 9:16
                </button>
              </div>
              <label className="mini-toggle">
                <input type="checkbox" checked={!!state?.qrVisible} onChange={(e) => run({ type: 'qr', visible: e.target.checked })} />
                QR no palco
              </label>
              <label className="mini-toggle">
                <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
                Reduzir movimento
              </label>
            </div>
            <div className="demo-row">
              <span className="demo-label">Cenários</span>
              <label className="mini-toggle">
                <input
                  type="checkbox"
                  checked={!!state?.scenario.uploadFailure}
                  onChange={(e) => run({ type: 'scenario', uploadFailure: e.target.checked })}
                />
                Falha simulada no envio
              </label>
              <label className="mini-select">
                Câmera
                <select value={camFail ?? 'auto'} onChange={(e) => setCamFail(e.target.value === 'auto' ? null : (e.target.value as CameraFailure))}>
                  <option value="auto">real do navegador</option>
                  <option value="denied">simular negada</option>
                  <option value="unavailable">simular indisponível</option>
                </select>
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
                Nova sessão de demo
              </button>
            </div>
          </div>

          <nav className="screen-nav" aria-label="Explorar telas do participante">
            <p className="demo-label">
              Explorar telas <span className="muted">· atual: {screen || '—'}</span>
            </p>
            <ul>
              {SCREENS.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goScreen(s)} aria-label={`${s.id} ${s.label}`}>
                    <strong>{s.id}</strong> {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      </main>
      <div className="toast" role="status" aria-live="polite">
        {msg}
      </div>
    </div>
  );
}
