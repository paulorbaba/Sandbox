import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ENERGY, PHASES, PHASE_LABEL, RHYTHMS, isLivePhase, type CrowdLevel, type Phase } from '../../shared/config';
import type { ControlCommand, SessionState } from '../../shared/types';
import { Logo } from '../components/Brand';
import { QrCode } from '../components/QrCode';
import { StageScene } from '../components/stage/StageScene';
import { currentRhythm } from '../components/stage/stageModel';
import { useWatcherChannel } from '../lib/realtime';
import { copyText, links, loadControlKey, useReducedMotion } from '../lib/util';
import './pages.css';

export default function ControlPage() {
  const { sessionId = '' } = useParams();
  const key = useMemo(() => loadControlKey(sessionId), [sessionId]);
  const { state, status, onReactions, command } = useWatcherChannel({ sessionId, role: 'control', controlKey: key });
  const [reduced, setReduced] = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Controle · Lek Trek LIVE';
    // A credencial sai da URL após ser guardada neste navegador.
    if (window.location.hash.includes('key=')) history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const run = async (cmd: ControlCommand, ok?: string) => {
    const res = await command(cmd);
    if (!res.ok) setToast(res.error === 'unauthorized' ? 'Credencial inválida para esta sessão.' : res.error);
    else if (ok) setToast(ok);
  };

  if (status === 'unauthorized' || status === 'not_found') {
    return (
      <main className="gate">
        <Logo size={42} />
        <h1>{status === 'not_found' ? 'Sessão não encontrada' : 'Acesso restrito ao apresentador'}</h1>
        <p>
          {status === 'not_found'
            ? 'A sessão pode ter expirado ou o servidor foi reiniciado. As sessões ficam apenas em memória.'
            : 'Este endereço não contém a credencial de controle desta sessão. Use o link de controle gerado na criação da sessão.'}
        </p>
        <Link className="btn btn-primary" to="/">
          Criar nova sessão
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="gate" role="status">
        <Logo size={42} />
        <p>Conectando ao controle…</p>
      </main>
    );
  }

  const L = links(state.id, key);
  return (
    <main className="control" id="conteudo">
      <header className="control-head">
        <div className="control-title">
          <Logo size={30} />
          <div>
            <h1>Controle do apresentador</h1>
            <p>
              Sessão {state.number} · código <strong>{state.id}</strong>
            </p>
          </div>
        </div>
        <div className="control-status">
          <span className={`conn ${status}`}>{status === 'connected' ? 'Conectado' : 'Reconectando…'}</span>
          <span>
            <strong>{state.counts.connected}</strong> conectados
          </span>
          <span>
            <strong>{state.counts.ready}</strong> prontos
          </span>
          <span>
            <strong>{state.counts.stages}</strong> {state.counts.stages === 1 ? 'palco aberto' : 'palcos abertos'}
          </span>
        </div>
      </header>

      <div className="control-grid">
        <section className="card span-2" aria-labelledby="h-prev">
          <div className="card-head">
            <h2 id="h-prev">Prévia do palco</h2>
            <div className="seg" role="group" aria-label="Visão do palco">
              <button type="button" aria-pressed={state.view === 'main'} onClick={() => run({ type: 'view', view: 'main' })}>
                LED + BG
              </button>
              <button type="button" aria-pressed={state.view === 'fachada'} onClick={() => run({ type: 'view', view: 'fachada' })}>
                Fachada 9:16
              </button>
            </div>
          </div>
          <div className="preview-16x9">
            <StageScene state={state} onReactions={onReactions} joinUrl={L.participant} reducedMotion={reduced} />
          </div>
        </section>

        <section className="card" aria-labelledby="h-step">
          <h2 id="h-step">Condução</h2>
          <ol className="stepper">
            {PHASES.map((p) => (
              <li key={p} data-state={p === state.phase ? 'current' : PHASES.indexOf(p) < PHASES.indexOf(state.phase) ? 'done' : 'todo'}>
                <button type="button" onClick={() => run({ type: 'goto', phase: p })} aria-current={p === state.phase ? 'step' : undefined}>
                  {PHASE_LABEL[p]}
                </button>
              </li>
            ))}
          </ol>
          <PrimaryAction state={state} run={run} />
          <div className="row wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'next' })} disabled={state.phase === 'ended'}>
              Avançar etapa
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'nextBlock' })} disabled={!state.setlist.length}>
              Próximo ritmo
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'end' })} disabled={state.phase === 'ended'}>
              Encerrar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => window.confirm('Reiniciar a sessão? A energia e as reações voltam ao início.') && run({ type: 'restart' }, 'Sessão reiniciada.')}
            >
              Reiniciar sessão
            </button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={state.autoDrop} onChange={(e) => run({ type: 'autoDrop', value: e.target.checked })} />
            <span>
              <strong>Modo automático</strong> — ao completar a carga, segue sozinho para o drop e encerra.
            </span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={state.autoAssist} onChange={(e) => run({ type: 'autoAssist', value: e.target.checked })} />
            <span>
              <strong>Assistência automática</strong> — aos {ENERGY.mission.assistAtMs / 1000}s da missão, abaixo de{' '}
              {ENERGY.mission.assistBelow}%, o Lek Trek puxa a batida (sinalizado no palco).
            </span>
          </label>
          <SetInfo state={state} />
        </section>

        <section className="card" aria-labelledby="h-energy">
          <h2 id="h-energy">Energia coletiva</h2>
          <EnergyControls state={state} run={run} />
        </section>

        <section className="card" aria-labelledby="h-access">
          <h2 id="h-access">Acesso</h2>
          <div className="access">
            <QrCode value={L.participant} size={148} label="QR code do link de participação" />
            <div className="access-links">
              <a className="btn btn-primary btn-sm" href={L.stage} target="lektrek-palco" rel="noopener">
                Abrir palco em nova janela
              </a>
              <CopyRow label="Participação" value={L.participant} onCopied={setToast} />
              <CopyRow label="Palco" value={L.stage} onCopied={setToast} />
              <CopyRow label="Controle (privado)" value={L.control} onCopied={setToast} />
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={state.qrVisible} onChange={(e) => run({ type: 'qr', visible: e.target.checked })} />
            <span>
              <strong>QR visível no palco</strong> — recolha durante a dinâmica.
            </span>
          </label>
        </section>

        <section className="card" aria-labelledby="h-alt">
          <h2 id="h-alt">Estados alternativos</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.scenario.uploadFailure}
              onChange={(e) => run({ type: 'scenario', uploadFailure: e.target.checked })}
            />
            <span>
              <strong>Falha simulada no envio do vídeo</strong> — cenário demonstrativo (não há upload real). A primeira tentativa de cada
              celular falha e oferece registro coletivo + nova tentativa.
            </span>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'forceReconnect' }, 'Celulares reconectando…')}>
            Simular queda de conexão (2,5 s)
          </button>
          <ul className="alt-links">
            <li>
              <a href="/participar/EXPIRA" target="_blank" rel="noopener">
                Sessão inexistente ou expirada
              </a>
            </li>
            <li>
              <Link to="/demo">Câmera negada, sem câmera e demais telas (no /demo)</Link>
            </li>
            <li>Sessão encerrada: use “Encerrar” e abra o link de participação em outro aparelho.</li>
          </ul>
          <label className="toggle">
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
            <span>
              <strong>Reduzir movimento</strong> neste navegador.
            </span>
          </label>
        </section>
      </div>
      <div className="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </main>
  );
}

function PrimaryAction({ state, run }: { state: SessionState; run: (c: ControlCommand, ok?: string) => void }) {
  const map: Partial<Record<Phase, { label: string; cmd: ControlCommand; hint: string }>> = {
    lobby: { label: 'Iniciar a pista', cmd: { type: 'start' }, hint: 'Fecha a votação e revela o ritmo vencedor.' },
    reveal: { label: 'Abrir a pista agora', cmd: { type: 'goto', phase: 'set' }, hint: 'A pista abre sozinha após a revelação.' },
    set: { label: 'Iniciar missão do drop', cmd: { type: 'goto', phase: 'mission' }, hint: 'Novo anel: a galera libera o drop.' },
    mission: {
      label: state.dropReady ? 'Acionar o drop!' : 'Acionar o drop',
      cmd: { type: 'drop' },
      hint: state.dropReady ? 'A pista está pronta.' : 'Você pode acionar a qualquer momento.',
    },
    buildup: { label: 'Drop agora', cmd: { type: 'drop' }, hint: 'Contagem em andamento.' },
    drop: { label: 'Encerrar e mostrar registro', cmd: { type: 'end' }, hint: 'Celulares vão para a conclusão.' },
    ended: { label: 'Nova rodada nesta sessão', cmd: { type: 'restart' }, hint: 'Volta à recepção com os mesmos participantes.' },
  };
  const a = map[state.phase];
  if (!a) return null;
  return (
    <div className="primary-action">
      <button type="button" className={`btn btn-primary btn-block ${state.dropReady && state.phase === 'mission' ? 'pulse' : ''}`} onClick={() => run(a.cmd)}>
        {a.label}
      </button>
      <p>{a.hint}</p>
      {state.phase === 'mission' && !state.assisted && (
        <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'assist' }, 'Assistência ativada.')}>
          Lek Trek puxa a batida (assistência)
        </button>
      )}
    </div>
  );
}

function SetInfo({ state }: { state: SessionState }) {
  const total = Object.values(state.votes).reduce((a, b) => a + b, 0);
  const r = currentRhythm(state);
  return (
    <div className="setinfo">
      <h3>Votos no ritmo {state.votingOpen ? '(votação aberta)' : '(votação fechada)'}</h3>
      <ul className="votes">
        {RHYTHMS.map((x) => {
          const n = state.votes[x.id];
          const share = total ? (n / total) * 100 : 0;
          return (
            <li key={x.id} data-current={r?.id === x.id ? 'true' : undefined}>
              <span className="v-name">{x.name}</span>
              <span className="v-bar">
                <i style={{ width: `${share}%` }} />
              </span>
              <span className="v-n">{n}</span>
            </li>
          );
        })}
      </ul>
      {state.setlist.length > 0 && (
        <p className="muted">
          Setlist: {state.setlist.map((id, i) => `${i + 1}. ${RHYTHMS.find((x) => x.id === id)?.name}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function EnergyControls({ state, run }: { state: SessionState; run: (c: ControlCommand, ok?: string) => void }) {
  const mission = state.phase === 'mission';
  const live = isLivePhase(state.phase);
  const value = mission ? state.dropCharge : state.energy;
  const [draft, setDraft] = useState<number | null>(null);
  const crowd: Array<[CrowdLevel, string]> = [
    ['off', 'Desligado'],
    ['low', 'Galera pequena'],
    ['high', 'Galera cheia'],
  ];
  return (
    <div className="energy-ctl">
      <div className="meter-big">
        <span>{mission ? 'Carga do drop' : 'Energia da pista'}</span>
        <strong>{Math.round(value)}%</strong>
      </div>
      {mission && <p className="muted">Pista ON reconhecida: {Math.round(state.energy)}%</p>}
      <label className="range">
        <span>Ajustar {mission ? 'carga' : 'energia'}</span>
        <input
          type="range"
          min={mission ? 0 : ENERGY.floor}
          max={100}
          value={draft ?? Math.round(value)}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={() => draft !== null && (run({ type: 'setEnergy', value: draft }), setDraft(null))}
          onKeyUp={() => draft !== null && (run({ type: 'setEnergy', value: draft }), setDraft(null))}
        />
      </label>
      <div className="row wrap">
        <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'clap' })} disabled={!live}>
          👏 Palmas da sala (+{ENERGY.clapBonus})
        </button>
        <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'simulateBurst', count: 12 })} disabled={!live}>
          Simular 12 reações
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'resetEnergy' }, 'Energia reiniciada.')}>
          Reiniciar energia
        </button>
      </div>
      <fieldset className="seg-field">
        <legend>Público simulado (reações extras contínuas)</legend>
        <div className="seg">
          {crowd.map(([lvl, label]) => (
            <button key={lvl} type="button" aria-pressed={state.crowd === lvl} onClick={() => run({ type: 'crowd', level: lvl })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="muted small">
        Reações recebidas nesta rodada: <strong>{state.totalReactions}</strong>. “Palmas” e público simulado representam a sala —
        não são medições de som ou movimento.
      </p>
    </div>
  );
}

function CopyRow({ label, value, onCopied }: { label: string; value: string; onCopied: (m: string) => void }) {
  return (
    <div className="copy-row">
      <span className="copy-label">{label}</span>
      <code title={value}>{value.replace(/^https?:\/\//, '')}</code>
      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => onCopied((await copyText(value)) ? `Link de ${label.toLowerCase()} copiado.` : 'Não foi possível copiar.')}>
        Copiar
      </button>
    </div>
  );
}
