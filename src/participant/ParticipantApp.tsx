import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROFILES, profileFor, rhythmById, type MotivationId, type ReactionId, type RhythmId } from '../../shared/config';
import { useParticipantChannel } from '../lib/realtime';
import { participantId, usePersistentState } from '../lib/util';
import type { CameraFailure } from '../lib/camera';
import { downloadBlob, renderCard } from '../lib/clip';
import { extFor } from '../lib/camera';
import { Cadastro, CameraPrep, Espera, Motivacao, Resultado, Ritmo, SemCamera, Welcome } from './onboarding';
import { Live } from './live';
import { Recorder, type RecordResult } from './Recorder';
import { ClipePronto, Conclusao, FalhaVideo, Processando, Reconectando, SessaoEncerrada, SessaoInexistente, type ClipResult } from './delivery';
import { Spinner } from './ui';
import './participant.css';

type Step = 'welcome' | 'cadastro' | 'motivacao' | 'ritmo' | 'resultado' | 'camera' | 'semcamera' | 'session';
type Delivery = 'none' | 'processing' | 'ready' | 'failed' | 'collective';

interface Journey {
  step: Step;
  motivation: MotivationId | null;
  vote: RhythmId | null;
  voteState: 'confirmed' | 'closed' | 'pending';
  recordMode: 'real' | 'simulated' | 'none' | null;
  camFailure: CameraFailure | null;
  runId: number | null;
  captured: 'real' | 'simulated' | null;
  concluded: boolean;
  delivery: Delivery;
  attempts: number;
  collectiveOnly: boolean;
}

const INITIAL: Journey = {
  step: 'welcome',
  motivation: null,
  vote: null,
  voteState: 'pending',
  recordMode: null,
  camFailure: null,
  runId: null,
  captured: null,
  concluded: false,
  delivery: 'none',
  attempts: 0,
  collectiveOnly: false,
};

export type ScreenId =
  | 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06' | 'C07' | 'C08' | 'C09'
  | 'C10' | 'C11' | 'C12' | 'C13' | 'C14' | 'C15' | 'C16' | 'C17' | 'C18';

export interface ParticipantAppProps {
  sessionId: string;
  /** Escopo do identificador local (o /demo usa um escopo próprio). */
  scope?: string;
  /** Simulação de câmera negada/indisponível (somente no /demo). */
  demoCameraFailure?: CameraFailure | null;
  /** Salto de tela para exploração do protótipo (/demo). */
  jump?: { screen: ScreenId; nonce: number } | null;
  onScreen?: (id: string) => void;
}

export function ParticipantApp({ sessionId, scope = 'p', demoCameraFailure = null, jump, onScreen }: ParticipantAppProps) {
  const pid = useMemo(() => participantId(sessionId, scope), [sessionId, scope]);
  const [j, setJ] = usePersistentState<Journey>(`ltl:j:${scope}:${sessionId.toUpperCase()}`, INITIAL);
  const patch = useCallback((p: Partial<Journey>) => setJ((prev) => ({ ...prev, ...p })), [setJ]);
  const ch = useParticipantChannel(sessionId, pid);
  const state = ch.state;
  const connected = ch.status === 'connected';

  const [recOpen, setRecOpen] = useState<false | 'idle' | 'dj' | 'flip' | 'selfie'>(false);
  const rawVideo = useRef<Blob | null>(null);
  const [clip, setClip] = useState<ClipResult | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // Nova rodada (reinício pelo apresentador): limpa o registro desta rodada.
  useEffect(() => {
    if (!state) return;
    if (j.runId === null) patch({ runId: state.runId });
    else if (j.runId !== state.runId) {
      patch({ runId: state.runId, captured: null, concluded: false, delivery: 'none', attempts: 0, collectiveOnly: false });
      setClip(null);
      rawVideo.current = null;
      setRecOpen(false);
    }
  }, [state?.runId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrou na sala de espera → pronto no servidor (idempotente, inclusive após reconexão).
  useEffect(() => {
    if (j.step === 'session' && connected) ch.markReady();
  }, [j.step, connected, ch]);

  // Comemoração curta ao entrar no drop.
  useEffect(() => {
    if (state?.phase !== 'drop') return;
    setCelebrate(true);
    const t = window.setTimeout(() => setCelebrate(false), 3500);
    return () => window.clearTimeout(t);
  }, [state?.phase, state?.runId]);

  // Exploração do protótipo: salto direto para uma tela.
  useEffect(() => {
    if (!jump) return;
    const s = jump.screen;
    const base: Partial<Journey> = { motivation: j.motivation ?? 'batida', vote: j.vote ?? 'funkynchicken', voteState: j.voteState === 'pending' ? 'confirmed' : j.voteState };
    setRecOpen(false);
    const steps: Partial<Record<ScreenId, Step>> = { C01: 'welcome', C02: 'cadastro', C03: 'motivacao', C04: 'ritmo', C05: 'resultado', C06: 'camera', C16: 'semcamera' };
    if (steps[s]) {
      patch({ ...base, step: steps[s]!, camFailure: s === 'C16' ? 'denied' : j.camFailure });
      return;
    }
    const session = { ...base, step: 'session' as Step, recordMode: j.recordMode && j.recordMode !== 'none' ? j.recordMode : ('simulated' as const) };
    if (s === 'C10' || s === 'C11' || s === 'C12') {
      patch({ ...session, concluded: false, delivery: 'none' });
      setRecOpen(s === 'C10' ? 'idle' : s === 'C11' ? 'flip' : 'selfie');
    } else if (s === 'C13') patch({ ...session, concluded: false, delivery: 'none' });
    else if (s === 'C14') patch({ ...session, concluded: true, delivery: 'processing', captured: j.captured ?? 'simulated', attempts: 1, collectiveOnly: false });
    else if (s === 'C15') patch({ ...session, concluded: true, delivery: 'processing', captured: j.captured ?? 'simulated', attempts: 1, collectiveOnly: false });
    else if (s === 'C18') patch({ ...session, concluded: true, delivery: 'failed', captured: j.captured ?? 'simulated', attempts: 1, collectiveOnly: false });
    else patch({ ...session, concluded: false, delivery: 'none' });
  }, [jump?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const profile = PROFILES[profileFor(j.motivation)];
  const rhythmName = rhythmById(state?.winner ?? j.vote)?.name ?? null;

  const saveCard = async () => {
    try {
      const blob = await renderCard({ profile: profile.short, rhythm: rhythmName, sessionNumber: state?.number ?? 0, reactions: state?.totalReactions });
      downloadBlob(blob, `meu-modo-on-${profileFor(j.motivation)}.png`);
    } catch {
      /* ignorar: download não suportado */
    }
  };

  const react = (r: ReactionId) => ch.react(r);

  const confirmVote = async (r: RhythmId) => {
    patch({ vote: r, voteState: 'pending', step: 'resultado' });
    if (state && !state.votingOpen) return patch({ voteState: 'closed' });
    const ok = await ch.vote(r);
    patch({ voteState: ok ? 'confirmed' : state?.votingOpen === false ? 'closed' : 'confirmed' });
  };

  const onRecordClose = (res: RecordResult | null) => {
    setRecOpen(false);
    if (!res) return;
    if (res.kind === 'real') rawVideo.current = res.blob;
    patch({ captured: res.kind });
  };

  /* ───────── Resolução de tela ───────── */
  let view: React.ReactNode;
  let screenKey = '';

  if (ch.status === 'not_found') {
    view = <SessaoInexistente />;
    screenKey = 'EXP';
  } else if (!state) {
    view = (
      <div className="scr scr--yellow boot-phone" role="status">
        <Spinner />
        <p>Conectando à sessão…</p>
      </div>
    );
    screenKey = 'BOOT';
  } else if (state.phase === 'ended' && j.step !== 'session' && !j.concluded && j.delivery === 'none' && !recOpen) {
    view = <SessaoEncerrada number={state.number} />;
    screenKey = 'ENC';
  } else if (j.step !== 'session') {
    switch (j.step) {
      case 'welcome':
        view = <Welcome sessionNumber={state.number} onStart={() => patch({ step: 'cadastro' })} />;
        break;
      case 'cadastro':
        view = <Cadastro onDone={() => patch({ step: 'motivacao' })} />;
        break;
      case 'motivacao':
        view = <Motivacao value={j.motivation} onDone={(m) => patch({ motivation: m, step: 'ritmo' })} />;
        break;
      case 'ritmo':
        view = <Ritmo value={j.vote} onDone={confirmVote} />;
        break;
      case 'resultado':
        view = (
          <Resultado
            motivation={j.motivation}
            voteState={j.voteState}
            sessionNumber={state.number}
            onNext={() => patch({ step: 'camera' })}
            onSaveCard={saveCard}
          />
        );
        break;
      case 'camera':
        view = (
          <CameraPrep
            demoFailure={demoCameraFailure}
            onReal={() => patch({ recordMode: 'real', step: 'session' })}
            onSimulated={() => patch({ recordMode: 'simulated', step: 'session' })}
            onNone={() => patch({ recordMode: 'none', step: 'session' })}
            onFailure={(f) => patch({ camFailure: f, step: 'semcamera' })}
          />
        );
        break;
      case 'semcamera':
        view = (
          <SemCamera
            failure={j.camFailure}
            onEnter={() => patch({ recordMode: 'none', step: 'session' })}
            onRetry={() => patch({ step: 'camera' })}
          />
        );
        break;
    }
    screenKey = j.step;
  } else if (recOpen && j.recordMode && j.recordMode !== 'none') {
    view = (
      <Recorder
        key={`${recOpen}-${jump?.nonce ?? 0}`}
        mode={j.recordMode}
        initial={recOpen}
        connected={connected}
        onReact={react}
        onClose={onRecordClose}
        onFallbackToSimulated={() => {
          patch({ recordMode: 'simulated' });
          setRecOpen('idle');
        }}
      />
    );
    screenKey = 'REC';
  } else if (state.phase === 'ended') {
    const personal = !!j.captured;
    if (!j.concluded) {
      view = <Conclusao onSee={() => patch({ concluded: true, delivery: 'processing' })} onSaveCard={saveCard} />;
      screenKey = 'C13';
    } else if (j.delivery === 'processing') {
      const collective = !personal || j.collectiveOnly;
      view = (
        <Processando
          key={`proc-${j.attempts}`}
          willFail={!collective && state.scenario.uploadFailure && j.attempts === 0}
          input={{
            profile: profile.short,
            rhythm: rhythmName,
            sessionNumber: state.number,
            reactions: state.totalReactions,
            personalVideo: rawVideo.current,
            simulatedPov: j.captured === 'simulated',
            collective,
          }}
          onDone={(r) => {
            if (!r.ok) return patch({ delivery: 'failed', attempts: j.attempts + 1 });
            setClip(r.clip);
            patch({ delivery: collective ? 'collective' : 'ready', attempts: j.attempts + 1 });
          }}
        />
      );
      screenKey = 'C14';
    } else if (j.delivery === 'failed') {
      view = (
        <FalhaVideo
          onCollective={() => patch({ collectiveOnly: true, delivery: 'processing' })}
          onRetry={() => patch({ collectiveOnly: false, delivery: 'processing' })}
        />
      );
      screenKey = 'C18';
    } else {
      const collective = j.delivery === 'collective';
      view = (
        <ClipePronto
          clip={clip && clip.collective === collective ? clip : null}
          collective={collective}
          hasRawVideo={!!rawVideo.current}
          onDownloadRaw={() => rawVideo.current && downloadBlob(rawVideo.current, `meu-role-lek-trek.${extFor(rawVideo.current.type)}`)}
          onRegenerate={() => patch({ delivery: 'processing' })}
          onRetryPersonal={personal && collective ? () => patch({ collectiveOnly: false, delivery: 'processing' }) : undefined}
          onSaveCard={saveCard}
        />
      );
      screenKey = 'C15';
    }
  } else if (state.phase === 'lobby' || state.phase === 'reveal') {
    view = (
      <Espera
        sessionNumber={state.number}
        connected={connected}
        ready={state.counts.ready}
        revealName={state.phase === 'reveal' ? rhythmById(state.winner)?.name : null}
      />
    );
    screenKey = 'C07';
  } else {
    view = (
      <Live
        state={state}
        connected={connected}
        onReact={react}
        celebrate={celebrate}
        recordAvailable={!!j.recordMode && j.recordMode !== 'none'}
        onRecord={() => setRecOpen('idle')}
      />
    );
    screenKey = state.phase === 'mission' || state.phase === 'buildup' ? 'C09' : 'C08';
  }

  useEffect(() => {
    onScreen?.(screenKey);
  }, [screenKey, onScreen]);

  const showReconnect = ch.status === 'reconnecting' && !!state && j.step === 'session';

  return (
    <div className="phone-app" data-screen-key={screenKey}>
      {view}
      {showReconnect && <Reconectando />}
      {ch.status === 'reconnecting' && j.step !== 'session' && (
        <p className="offline-banner" role="status">
          Sem conexão — tentando de novo…
        </p>
      )}
    </div>
  );
}
