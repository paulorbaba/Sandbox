import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactionId } from '../../shared/config';
import { IMG } from '../components/Brand';
import { CanvasRecorder, extFor, failureOf, openCamera, stopStream, type Facing } from '../lib/camera';
import { downloadBlob } from '../lib/clip';
import { fmtClock } from '../lib/util';
import { ReactionBar } from './live';
import { Screen, Title } from './ui';

export type RecordResult = { kind: 'real'; blob: Blob } | { kind: 'simulated'; seconds: number };
type Stage = 'idle' | 'dj' | 'selfie' | 'done' | 'error';

const MAX_MS = 30_000;
const FLIP_AFTER_MS = 4_000;

interface Props {
  mode: 'real' | 'simulated';
  onClose: (r: RecordResult | null) => void;
  onReact: (r: ReactionId) => boolean;
  connected: boolean;
  initial?: 'idle' | 'dj' | 'flip' | 'selfie';
  onFallbackToSimulated: () => void;
}

/* C10 Registro do DJ · C11 Troca de câmera · C12 Selfie */
export function Recorder({ mode, onClose, onReact, connected, initial = 'idle', onFallbackToSimulated }: Props) {
  const startInRec = initial !== 'idle';
  const [stage, setStage] = useState<Stage>(initial === 'selfie' ? 'selfie' : startInRec ? 'dj' : 'idle');
  const [elapsed, setElapsed] = useState(0);
  const [flipPrompt, setFlipPrompt] = useState(initial === 'flip');
  const [flipDismissed, setFlipDismissed] = useState(false);
  const [facing, setFacing] = useState<Facing>(initial === 'selfie' ? 'user' : 'environment');
  const [camReady, setCamReady] = useState(mode === 'simulated');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<CanvasRecorder | null>(null);
  const startedAt = useRef<number | null>(startInRec ? Date.now() : null);
  const recording = stage === 'dj' || stage === 'selfie';

  // Câmera real: abre ao entrar na etapa e libera ao sair.
  const attach = useCallback(async (f: Facing) => {
    try {
      const s = await openCamera(f);
      stopStream(stream.current);
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => undefined);
      }
      recorder.current?.setSource(video.current, f === 'user');
      setCamReady(true);
      return true;
    } catch (e) {
      const f2 = failureOf(e);
      setError(f2 === 'denied' ? 'O acesso à câmera foi bloqueado.' : 'A câmera não está disponível agora.');
      setStage('error');
      return false;
    }
  }, []);

  useEffect(() => {
    if (mode !== 'real') return;
    recorder.current = new CanvasRecorder();
    attach(facing).then((ok) => {
      if (ok && startInRec) {
        try {
          recorder.current?.start();
        } catch {
          /* sem suporte */
        }
      }
    });
    return () => {
      recorder.current?.dispose();
      recorder.current = null;
      stopStream(stream.current);
      stream.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const stop = useCallback(async () => {
    const secs = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
    startedAt.current = null;
    setFlipPrompt(false);
    if (mode === 'real') {
      const blob = await recorder.current?.stop();
      stopStream(stream.current);
      stream.current = null;
      if (blob && blob.size) {
        setResult({ blob, url: URL.createObjectURL(blob) });
        setStage('done');
      } else {
        setError('Não foi possível salvar a gravação neste navegador.');
        setStage('error');
      }
    } else {
      setElapsed(secs * 1000);
      setStage('done');
    }
  }, [mode]);

  // Cronômetro (só durante captura).
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      const ms = startedAt.current ? Date.now() - startedAt.current : 0;
      setElapsed(ms);
      if (stage === 'dj' && ms >= FLIP_AFTER_MS && !flipDismissed) setFlipPrompt(true);
      if (ms >= MAX_MS) stop();
    }, 250);
    return () => window.clearInterval(t);
  }, [recording, stage, flipDismissed, stop]);

  const start = () => {
    if (mode === 'real') {
      if (!recorder.current?.supported) {
        setError('Este navegador não permite gravar vídeo pela página.');
        setStage('error');
        return;
      }
      recorder.current.start();
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setStage('dj');
  };

  const flip = async () => {
    setFlipPrompt(false);
    setFlipDismissed(true);
    setFacing('user');
    if (mode === 'real') await attach('user');
    setStage('selfie');
  };

  const bgSrc = facing === 'user' ? IMG.selfie : IMG.pov;
  const stepLabel =
    stage === 'selfie' ? (elapsed > 3000 && !flipPrompt ? 'Você e a galera' : '2 de 2 • Agora você') : '1 de 2 • Mostre o DJ';
  const screenId = stage === 'selfie' ? 'C12' : flipPrompt ? 'C11' : 'C10';

  if (stage === 'done') {
    return (
      <Screen
        id="C12"
        tone="dark"
        className="rec-done"
        footer={
          <>
            {result && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => downloadBlob(result.blob, `meu-role-lek-trek.${extFor(result.blob.type)}`)}>
                Baixar minha gravação
              </button>
            )}
            <button
              type="button"
              className={result ? 'link-btn light' : 'btn btn-primary btn-block'}
              onClick={() => onClose(result ? { kind: 'real', blob: result.blob } : { kind: 'simulated', seconds: elapsed / 1000 })}
            >
              Voltar para a pista
            </button>
          </>
        }
      >
        <Title id="C12">{result ? 'Gravação salva no seu aparelho.' : 'Registro simulado concluído.'}</Title>
        {result ? (
          <video className="rec-preview" src={result.url} controls playsInline aria-label="Prévia da sua gravação" />
        ) : (
          <div className="rec-preview sim">
            <img src={IMG.selfie} alt="" />
            <span className="pill pill-dark">Simulação · {fmtClock(elapsed)}</span>
          </div>
        )}
        <p className="center light-text">
          {result
            ? 'Nada foi enviado. Seu trecho entra no clipe montado no fim da sessão.'
            : 'No modo demonstração, o clipe usa imagens do projeto no lugar do seu vídeo.'}
        </p>
      </Screen>
    );
  }

  if (stage === 'error') {
    return (
      <Screen
        id="C16"
        tone="dark"
        className="rec-error"
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                onFallbackToSimulated();
              }}
            >
              Usar modo demonstração
            </button>
            <button type="button" className="link-btn light" onClick={() => onClose(null)}>
              Voltar para as reações
            </button>
          </>
        }
      >
        <Title id="C16">Sem câmera por aqui.</Title>
        <p className="center light-text">{error} Você continua na dinâmica com as reações.</p>
      </Screen>
    );
  }

  return (
    <Screen
      id={screenId}
      tone="dark"
      className={`recorder ${facing === 'user' ? 'is-selfie' : ''}`}
      bg={
        <div className="live-bg rec-bg" aria-hidden="true">
          {mode === 'real' ? <video ref={video} muted playsInline className={facing === 'user' ? 'mirror' : ''} /> : <img src={bgSrc} alt="" className="kb" />}
          <div className="live-scrim soft" />
        </div>
      }
    >
      <div className="rec-top">
        {recording ? (
          mode === 'real' ? (
            <span className="pill pill-red rec-pill" role="status">
              <span className="dot" aria-hidden="true" /> REC {fmtClock(elapsed)}
            </span>
          ) : (
            <span className="pill pill-dark sim-pill" role="status">
              Simulação · {fmtClock(elapsed)}
            </span>
          )
        ) : (
          <span className="pill pill-dark">{mode === 'real' ? (camReady ? 'Câmera pronta · não está gravando' : 'Abrindo câmera…') : 'Modo demonstração'}</span>
        )}
        <span className="pill pill-dark step">{stepLabel}</span>
      </div>
      <Title id={screenId} className="sr-only">
        {screenId === 'C10' ? 'Registro do DJ' : screenId === 'C11' ? 'Troca de câmera' : 'Selfie'}
      </Title>

      <div className="rec-actions">
        {stage === 'idle' && (
          <>
            <p className="support-text">Seu clipe vem aí. Aponte pra cabine.</p>
            <button type="button" className="btn btn-primary btn-block" onClick={start} disabled={!camReady}>
              <span className="rec-dot white" aria-hidden="true" /> {mode === 'real' ? 'Iniciar gravação' : 'Iniciar simulação'}
            </button>
            <button type="button" className="link-btn light" onClick={() => onClose(null)}>
              Voltar sem gravar
            </button>
          </>
        )}
        {flipPrompt && stage === 'dj' && (
          <>
            <button type="button" className="btn btn-primary btn-block" onClick={flip}>
              <span className="flip-icon" aria-hidden="true">⟳</span> Virar câmera
            </button>
            <button
              type="button"
              className="link-btn light"
              onClick={() => {
                setFlipPrompt(false);
                setFlipDismissed(true);
              }}
            >
              Continuar com o DJ
            </button>
          </>
        )}
        {recording && (
          <button type="button" className="stop-btn" onClick={stop}>
            <span className="stop-square" aria-hidden="true" /> Encerrar gravação
          </button>
        )}
      </div>
      <ReactionBar onReact={onReact} disabled={!connected} label="Reagir sem parar de gravar" />
    </Screen>
  );
}
