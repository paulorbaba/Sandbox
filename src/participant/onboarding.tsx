import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MOTIVATIONS, PROFILES, RHYTHMS, profileFor, type MotivationId, type RhythmId } from '../../shared/config';
import { IMG, PowerIcon } from '../components/Brand';
import { audioSupported, useRhythmPreview } from '../lib/audio';
import { cameraSupport, failureOf, openCamera, stopStream, type CameraFailure } from '../lib/camera';
import { CameraIcon, Screen, Sheet, Title } from './ui';

/* C01 · Boas-vindas */
export function Welcome({ onStart, sessionNumber }: { onStart: () => void; sessionNumber?: number }) {
  return (
    <Screen
      id="C01"
      tone="yellow"
      className="welcome"
      title={
        <Title id="C01" className="welcome-title">
          Seu ritmo.
          <br />
          Sua galera.
        </Title>
      }
      footer={
        <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
          Começar
        </button>
      }
    >
      <p className="welcome-sub">Ajude o Lek Trek a manter a pista ON.</p>
      {sessionNumber ? <p className="pill pill-outline welcome-session">Sessão {sessionNumber}</p> : null}
      <img className="lek-hero" src={IMG.lekUp} alt="Lek Trek, o DJ da Sadia, de fones e jaqueta, apontando para cima" />
    </Screen>
  );
}

/* C02 · Cadastro demonstrativo — nada é enviado ao servidor */
const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, 11);
const maskPhone = (s: string) => {
  const d = onlyDigits(s);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export function Cadastro({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sheet, setSheet] = useState<'terms' | 'privacy' | null>(null);
  const firstInvalid = useRef<HTMLInputElement | null>(null);
  const refs = { name: useRef<HTMLInputElement>(null), phone: useRef<HTMLInputElement>(null), terms: useRef<HTMLInputElement>(null) };

  const errors = {
    name: name.trim().length < 2 ? 'Conta pra gente como você quer ser chamado.' : null,
    phone: ![10, 11].includes(onlyDigits(phone).length) ? 'Use DDD + número, ex.: (11) 98765-4321.' : null,
    terms: !terms ? 'Para participar, aceite os termos de participação.' : null,
  };
  const show = (k: keyof typeof errors) => (touched[k] || submitted) && errors[k];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const order = ['name', 'phone', 'terms'] as const;
    const bad = order.find((k) => errors[k]);
    if (bad) {
      firstInvalid.current = refs[bad].current;
      firstInvalid.current?.focus();
      return;
    }
    onDone();
  };

  const quickFill = () => {
    setName('Participante Demo');
    setPhone('(11) 90000-0000');
    setTerms(true);
    setTouched({});
  };

  return (
    <Screen
      id="C02"
      title={<Title id="C02">Vamos começar?</Title>}
      className="cadastro"
      footer={
        <button type="submit" form="cadastro-form" className="btn btn-primary btn-block">
          Continuar
        </button>
      }
    >
      <form className="form" noValidate onSubmit={submit} id="cadastro-form">
        <div className={`field ${show('name') ? 'has-error' : ''}`}>
          <label htmlFor="f-name">Nome</label>
          <input
            ref={refs.name}
            id="f-name"
            name="name"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            aria-invalid={!!show('name')}
            aria-describedby={show('name') ? 'e-name' : undefined}
          />
          {show('name') && (
            <p className="field-error" id="e-name">
              {errors.name}
            </p>
          )}
        </div>
        <div className={`field ${show('phone') ? 'has-error' : ''}`}>
          <label htmlFor="f-phone">WhatsApp</label>
          <input
            ref={refs.phone}
            id="f-phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            aria-invalid={!!show('phone')}
            aria-describedby={show('phone') ? 'e-phone' : undefined}
          />
          {show('phone') && (
            <p className="field-error" id="e-phone">
              {errors.phone}
            </p>
          )}
        </div>
        <div className={`check ${show('terms') ? 'has-error' : ''}`}>
          <input
            ref={refs.terms}
            type="checkbox"
            id="f-terms"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              setTouched((t) => ({ ...t, terms: true }));
            }}
            aria-invalid={!!show('terms')}
            aria-describedby={show('terms') ? 'e-terms' : undefined}
          />
          <label htmlFor="f-terms">
            Li e aceito os{' '}
            <button type="button" className="inline-link" onClick={() => setSheet('terms')}>
              termos de participação
            </button>
            .
          </label>
        </div>
        {show('terms') && (
          <p className="field-error check-error" id="e-terms">
            {errors.terms}
          </p>
        )}
        <div className="check">
          <input type="checkbox" id="f-mkt" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          <label htmlFor="f-mkt">Quero receber novidades da Sadia (opcional).</label>
        </div>
        <p className="form-note">
          Cadastro demonstrativo: os dados ficam só nesta tela e não são enviados.{' '}
          <button type="button" className="inline-link" onClick={() => setSheet('privacy')}>
            Política de privacidade
          </button>
        </p>
        <button type="button" className="link-btn quick-fill" onClick={quickFill}>
          Preencher com dados fictícios
        </button>
      </form>
      <Sheet open={sheet === 'terms'} title="Termos de participação" onClose={() => setSheet(null)}>
        <p>
          <strong>Texto demonstrativo.</strong> O conteúdo final dos termos depende da operação e da aprovação jurídica do cliente.
        </p>
        <ul>
          <li>A participação na Lek Trek LIVE é gratuita e voluntária.</li>
          <li>Reações enviadas pelo celular aparecem de forma anônima no palco.</li>
          <li>Autorizar a câmera não autoriza uso promocional de imagem; esse consentimento terá fluxo próprio.</li>
          <li>Comunicações da Sadia são opcionais e desmarcadas por padrão.</li>
        </ul>
      </Sheet>
      <Sheet open={sheet === 'privacy'} title="Política de privacidade" onClose={() => setSheet(null)}>
        <p>
          <strong>Protótipo.</strong> Nome, WhatsApp e consentimentos preenchidos aqui não saem deste aparelho. O servidor recebe apenas um
          identificador aleatório da sessão, o voto no ritmo e as reações.
        </p>
        <p>Vídeos gravados ficam só no seu aparelho e podem ser baixados por você. Nada é enviado nesta fase.</p>
      </Sheet>
    </Screen>
  );
}

/* C03 · Pesquisa */
export function Motivacao({ value, onDone }: { value: MotivationId | null; onDone: (m: MotivationId) => void }) {
  const [sel, setSel] = useState<MotivationId | null>(value);
  return (
    <Screen
      id="C03"
      title={
        <>
          <p className="pill pill-outline step-pill">1 de 2</p>
          <Title id="C03">O que te coloca no modo ON?</Title>
        </>
      }
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!sel} onClick={() => sel && onDone(sel)}>
          Continuar
        </button>
      }
    >
      <div className="options" role="radiogroup" aria-labelledby="C03-title">
        {MOTIVATIONS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={sel === m.id}
            className="option"
            onClick={() => setSel(m.id)}
          >
            <span>{m.label}</span>
            <span className="option-check" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="hint">Escolha uma resposta.</p>
    </Screen>
  );
}

/* C04 · Voto no ritmo (prévia separada do voto) */
export function Ritmo({ value, onDone }: { value: RhythmId | null; onDone: (r: RhythmId) => void }) {
  const [sel, setSel] = useState<RhythmId | null>(value);
  const preview = useRhythmPreview();
  const canPreview = audioSupported();
  return (
    <Screen
      id="C04"
      title={
        <>
          <p className="pill pill-outline step-pill">2 de 2</p>
          <Title id="C04">Qual ritmo abre o set?</Title>
        </>
      }
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!sel}
          onClick={() => {
            preview.stop();
            sel && onDone(sel);
          }}
        >
          Confirmar voto
        </button>
      }
    >
      <div className="rhythms" role="radiogroup" aria-labelledby="C04-title">
        {RHYTHMS.map((r) => (
          <div key={r.id} className={`rhythm ${sel === r.id ? 'is-sel' : ''}`}>
            {canPreview && (
              <button
                type="button"
                className={`play ${preview.playing === r.id ? 'is-playing' : ''}`}
                onClick={() => preview.toggle(r.id)}
                aria-label={preview.playing === r.id ? `Parar prévia de ${r.name}` : `Ouvir prévia de ${r.name}`}
              >
                {preview.playing === r.id ? <span className="pause-icon" /> : <span className="play-icon" />}
              </button>
            )}
            <button type="button" role="radio" aria-checked={sel === r.id} className="rhythm-pick" onClick={() => setSel(r.id)}>
              <span className="rhythm-name">{r.name}</span>
              <span className="rhythm-vibe">{r.vibe}</span>
              <span className="option-check" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <p className="hint">{canPreview ? 'Ouça a prévia e toque no ritmo para escolher. Prévias sintetizadas para a demonstração.' : 'Toque no ritmo para escolher.'}</p>
    </Screen>
  );
}

/* C05 · Resultado */
export function Resultado({
  motivation,
  voteState,
  sessionNumber,
  onNext,
  onSaveCard,
}: {
  motivation: MotivationId | null;
  voteState: 'confirmed' | 'closed' | 'pending';
  sessionNumber: number;
  onNext: () => void;
  onSaveCard: () => void;
}) {
  const profile = PROFILES[profileFor(motivation)];
  return (
    <Screen
      id="C05"
      tone="yellow"
      className="resultado"
      title={
        <>
          <p className="result-kicker">Seu modo ON:</p>
          <Title id="C05" className="result-title">
            <span className="burst">{profile.short}</span>
          </Title>
        </>
      }
      footer={
        <>
          <p className={`pill vote-pill ${voteState}`} role="status">
            {voteState === 'confirmed' ? (
              <>
                <span className="tick" aria-hidden="true" /> Voto confirmado
              </>
            ) : voteState === 'closed' ? (
              'Votação encerrada: seu voto fica no seu card'
            ) : (
              'Enviando voto…'
            )}
          </p>
          <p className="pill pill-outline session-pill">Sessão {sessionNumber}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
            Continuar
          </button>
          <button type="button" className="link-btn" onClick={onSaveCard}>
            Salvar meu card
          </button>
        </>
      }
    >
      <p className="result-line">{profile.line}</p>
      <img className="lek-hero lek-point" src={IMG.lekPoint} alt="Lek Trek apontando para você" />
    </Screen>
  );
}

/* C06 · Câmera opcional */
export function CameraPrep({
  onReal,
  onSimulated,
  onNone,
  onFailure,
  demoFailure,
}: {
  onReal: () => void;
  onSimulated: () => void;
  onNone: () => void;
  onFailure: (f: CameraFailure) => void;
  demoFailure?: CameraFailure | null;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      video.current.play().catch(() => undefined);
    }
  }, [stream]);
  // Libera a câmera ao sair da etapa.
  useEffect(() => () => stopStream(stream), [stream]);

  const activate = async () => {
    if (demoFailure) return onFailure(demoFailure);
    setBusy(true);
    try {
      setStream(await openCamera('environment'));
    } catch (e) {
      onFailure(failureOf(e));
    } finally {
      setBusy(false);
    }
  };

  if (stream) {
    return (
      <Screen
        id="C06"
        title={<Title id="C06">Câmera pronta.</Title>}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              stopStream(stream);
              setStream(null);
              onReal();
            }}
          >
            Continuar
          </button>
        }
      >
        <div className="cam-preview">
          <video ref={video} muted playsInline aria-label="Prévia da câmera traseira" />
          <span className="pill pill-dark cam-preview-tag">Prévia · não está gravando</span>
        </div>
        <p className="center">A gravação só começa quando você tocar em “Gravar meu rolê”, durante a live.</p>
      </Screen>
    );
  }

  const support = cameraSupport();
  return (
    <Screen
      id="C06"
      className="camera-prep"
      title={
        <>
          <CameraIcon />
          <Title id="C06">Quer gravar seu rolê?</Title>
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={activate} disabled={busy}>
            {busy ? 'Aguardando permissão…' : 'Ativar câmera'}
          </button>
          <button type="button" className="link-btn" onClick={onNone}>
            Seguir sem câmera
          </button>
          <p className="foot-note">Você participa dos dois jeitos.</p>
        </>
      }
    >
      <p className="center lead-sm">Mostre o DJ e depois vire a câmera pra você.</p>
      {support !== 'ok' && (
        <p className="notice">
          {support === 'insecure'
            ? 'A câmera exige conexão segura (HTTPS). Use o modo demonstração abaixo.'
            : 'Este navegador não oferece câmera. Use o modo demonstração abaixo.'}
        </p>
      )}
      <button type="button" className="demo-mode" onClick={onSimulated}>
        <strong>Modo demonstração</strong>
        <span>Simular o registro com imagens do projeto, sem câmera.</span>
      </button>
    </Screen>
  );
}

/* C16 · Sem câmera */
export function SemCamera({ failure, onEnter, onRetry }: { failure: CameraFailure | null; onEnter: () => void; onRetry: () => void }) {
  const reason =
    failure === 'denied'
      ? 'O acesso à câmera não foi liberado.'
      : failure === 'insecure'
        ? 'A câmera precisa de conexão segura (HTTPS).'
        : 'Não encontramos uma câmera disponível.';
  return (
    <Screen
      id="C16"
      className="sem-camera"
      title={
        <>
          <CameraIcon crossed />
          <Title id="C16">Bora curtir do mesmo jeito?</Title>
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={onEnter}>
            Entrar na live
          </button>
          <button type="button" className="link-btn" onClick={onRetry}>
            Tentar ativar câmera
          </button>
        </>
      }
    >
      <p className="center lead-sm">Reaja com a galera e receba o registro da sessão.</p>
      <p className="notice">{reason} Se mudar de ideia, libere a câmera nas configurações do navegador e toque em “Tentar ativar câmera”.</p>
    </Screen>
  );
}

/* C07 · Espera */
export function Espera({
  sessionNumber,
  connected,
  ready,
  revealName,
}: {
  sessionNumber: number;
  connected: boolean;
  ready: number;
  revealName?: string | null;
}) {
  return (
    <Screen id="C07" className="espera" title={<p className="pill pill-outline session-big">Sessão {sessionNumber}</p>}>
      <span className="power-big" aria-hidden="true">
        <PowerIcon size={110} stroke={3} />
      </span>
      {revealName ? (
        <>
          <Title id="C07">A galera escolheu: {revealName}</Title>
          <p className="center lead-sm">A pista vai abrir. Prepare os dedos!</p>
        </>
      ) : (
        <>
          <Title id="C07">Tudo pronto.</Title>
          <p className="center lead-sm">Aguarde a chamada da equipe.</p>
        </>
      )}
      <p className={`conn-line ${connected ? 'ok' : 'off'}`} role="status">
        <span className="dot" aria-hidden="true" /> {connected ? 'Conectado' : 'Reconectando…'}
      </p>
      <p className="hint center">
        {ready} {ready === 1 ? 'pessoa pronta' : 'pessoas prontas'} nesta sessão
      </p>
    </Screen>
  );
}
