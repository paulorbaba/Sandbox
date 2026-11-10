import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IMG, PowerIcon } from '../components/Brand';
import { clipSupported, composeClip, downloadBlob, type ClipInput } from '../lib/clip';
import { Screen, Sheet, Spinner, Title } from './ui';

/* C13 · Conclusão */
export function Conclusao({ onSee, onSaveCard }: { onSee: () => void; onSaveCard: () => void }) {
  return (
    <Screen
      id="C13"
      tone="yellow"
      className="conclusao"
      title={
        <>
          <span className="power-burst" aria-hidden="true">
            <PowerIcon size={58} stroke={3.2} />
          </span>
          <Title id="C13" className="concl-title">
            Modo ON
            <br />
            ativado
          </Title>
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={onSee}>
            Ver meu registro
          </button>
          <button type="button" className="link-btn" onClick={onSaveCard}>
            Salvar meu card
          </button>
        </>
      }
    >
      <p className="concl-sub">Esse ON foi da sua galera.</p>
      <img className="lek-hero" src={IMG.lekUp} alt="Lek Trek comemorando" />
    </Screen>
  );
}

export interface ClipResult {
  url: string;
  blob: Blob;
  ext: string;
  collective: boolean;
}

/* C14 · Processamento (montagem real do clipe de demonstração, no aparelho) */
export function Processando({
  input,
  willFail,
  onDone,
}: {
  input: ClipInput;
  willFail: boolean;
  onDone: (r: { ok: true; clip: ClipResult | null } | { ok: false }) => void;
}) {
  const [progress, setProgress] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      if (willFail) {
        // Cenário demonstrativo acionado pelo apresentador: falha no envio do vídeo pessoal.
        for (let i = 1; i <= 20 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 160));
          setProgress(i / 20 * 0.7);
        }
        if (!cancelled) onDone({ ok: false });
        return;
      }
      if (!clipSupported()) {
        for (let i = 1; i <= 20 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 150));
          setProgress(i / 20);
        }
        if (!cancelled) onDone({ ok: true, clip: null });
        return;
      }
      try {
        const out = await composeClip({ ...input, onProgress: (p) => !cancelled && setProgress(p) });
        if (!cancelled) onDone({ ok: true, clip: { ...out, collective: !!input.collective } });
      } catch {
        if (!cancelled) onDone({ ok: true, clip: null });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Screen id="C14" className="processando" title={<Title id="C14">Estamos preparando seu clipe.</Title>}>
      <div className="proc-ring" role="progressbar" aria-label="Preparando clipe" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <Spinner />
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <p className="center lead-sm">Você pode continuar curtindo. Ele aparece aqui quando estiver pronto.</p>
      <p className="hint center">Se sair, volte por este mesmo link: seu registro continua disponível neste aparelho.</p>
    </Screen>
  );
}

/* C15 · Clipe pronto (pessoal ou coletivo) */
export function ClipePronto({
  clip,
  collective,
  hasRawVideo,
  onDownloadRaw,
  onRegenerate,
  onRetryPersonal,
  onSaveCard,
}: {
  clip: ClipResult | null;
  collective: boolean;
  hasRawVideo: boolean;
  onDownloadRaw: () => void;
  onRegenerate: () => void;
  onRetryPersonal?: () => void;
  onSaveCard: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  return (
    <Screen
      id="C15"
      className="pronto"
      title={<Title id="C15">{collective ? 'Seu registro da sessão está pronto.' : 'Seu rolê tá aqui.'}</Title>}
      footer={
        <>
          {clip ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => downloadBlob(clip.blob, `lek-trek-live-${collective ? 'sessao' : 'meu-clipe'}.${clip.ext}`)}>
              Baixar clipe
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={onRegenerate}>
              Gerar clipe neste aparelho
            </button>
          )}
          <button type="button" className="link-btn" onClick={() => setSheet(true)}>
            Ouvir Lek Tracks
          </button>
        </>
      }
    >
      <div className="clip-frame">
        {clip ? (
          <video
            src={clip.url}
            controls
            playsInline
            loop
            preload="auto"
            onLoadedData={(e) => {
              if (e.currentTarget.currentTime === 0) e.currentTarget.currentTime = 4.2;
            }}
            aria-label={collective ? 'Registro coletivo da sessão' : 'Seu clipe'}
          />
        ) : (
          <div className="clip-sim" aria-label="Prévia simulada do clipe">
            <img src={collective ? IMG.pista : IMG.selfie} alt="" />
            <img src={IMG.drop} alt="" />
            <span className="clip-sim-tag">Prévia simulada</span>
          </div>
        )}
      </div>
      <p className="hint center">
        {clip
          ? collective
            ? 'O ON da nossa galera · clipe de demonstração montado no seu aparelho.'
            : 'Clipe de demonstração montado no seu aparelho com o seu registro.'
          : 'Este navegador não monta vídeo pela página. Na operação, o clipe chega pronto aqui.'}
      </p>
      <div className="row center-row">
        {hasRawVideo && !collective && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDownloadRaw}>
            Baixar gravação original
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSaveCard}>
          Salvar meu card
        </button>
      </div>
      {onRetryPersonal && (
        <button type="button" className="link-btn center-self" onClick={onRetryPersonal}>
          Tentar enviar meu vídeo
        </button>
      )}
      <Sheet open={sheet} title="Lek Tracks" onClose={() => setSheet(false)}>
        <p>O destino da playlist (plataforma e curadoria) ainda será definido com o cliente.</p>
        <p>No evento, este botão abre a playlist oficial com os ritmos da sessão.</p>
      </Sheet>
    </Screen>
  );
}

/* C18 · Falha no vídeo pessoal */
export function FalhaVideo({ onCollective, onRetry }: { onCollective: () => void; onRetry: () => void }) {
  return (
    <Screen
      id="C18"
      className="falha"
      title={<Title id="C18">Seu registro da sessão está pronto.</Title>}
      footer={
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={onCollective}>
            Ver registro da sessão
          </button>
          <button type="button" className="link-btn" onClick={onRetry}>
            Tentar enviar meu vídeo
          </button>
        </>
      }
    >
      <div className="clip-frame thumb">
        <img src={IMG.pista} alt="Registro coletivo da sessão" />
      </div>
      <p className="center lead-sm">Não conseguimos incluir seu vídeo. Você ainda pode tentar enviar de novo.</p>
      <p className="tag-demo">Cenário demonstrativo acionado pelo apresentador</p>
    </Screen>
  );
}

/* Sessão encerrada (para quem chega depois) */
export function SessaoEncerrada({ number }: { number: number }) {
  return (
    <Screen id="ENC" className="encerrada" title={<Title id="ENC">A Sessão {number} já terminou.</Title>}>
      <span className="power-big" aria-hidden="true">
        <PowerIcon size={96} stroke={3} />
      </span>
      <p className="center lead-sm">A próxima sessão começa já já. Enquanto isso, veja como a Lek Trek LIVE funciona.</p>
      <div className="stack">
        <Link className="btn btn-primary btn-block" to="/demo">
          Abrir demonstração
        </Link>
        <Link className="link-btn center" to="/">
          Ir para a central
        </Link>
      </div>
    </Screen>
  );
}

/* Sessão inexistente ou expirada */
export function SessaoInexistente() {
  return (
    <Screen id="EXP" className="encerrada" title={<Title id="EXP">Essa sessão não está mais no ar.</Title>}>
      <span className="power-big off" aria-hidden="true">
        <PowerIcon size={96} stroke={3} />
      </span>
      <p className="center lead-sm">O link pode ter expirado ou a sessão foi reiniciada. Peça um novo QR para a equipe.</p>
      <div className="stack">
        <Link className="btn btn-primary btn-block" to="/demo">
          Ver uma nova demonstração
        </Link>
        <Link className="link-btn center" to="/">
          Ir para a central
        </Link>
      </div>
    </Screen>
  );
}

/* C17 · Reconexão (sobreposição) */
export function Reconectando() {
  return (
    <div className="reconnect" role="alertdialog" aria-modal="false" aria-labelledby="C17-title" data-screen="C17">
      <div className="reconnect-card">
        <h2 id="C17-title" className="brand-headline reconnect-title">
          Reconectando…
        </h2>
        <span className="reconnect-spin">
          <Spinner dots />
        </span>
        <p>Continue curtindo com a galera. Suas reações voltam assim que a conexão retornar.</p>
      </div>
    </div>
  );
}
