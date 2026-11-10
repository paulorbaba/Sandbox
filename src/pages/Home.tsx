import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IMG, Logo, PowerIcon } from '../components/Brand';
import { QrCode } from '../components/QrCode';
import { createSession } from '../lib/realtime';
import { copyText, links, saveControlKey } from '../lib/util';
import './pages.css';

interface Created {
  id: string;
  number: number;
  controlKey: string;
}

export default function Home() {
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sadia ON · Lek Trek LIVE — Central da demonstração';
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await createSession();
      saveControlKey(s.id, s.controlKey);
      setCreated(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const L = created ? links(created.id, created.controlKey) : null;
  const copy = async (label: string, v: string) => setCopied((await copyText(v)) ? `${label} copiado` : 'Não foi possível copiar');

  return (
    <div className="home">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="home-top">
        <Logo size={34} />
        <span className="home-top-sep" aria-hidden="true" />
        <span className="home-top-name">
          LEK TREK LIVE <small>no Lollapalooza Brasil 2027 · protótipo funcional</small>
        </span>
      </header>
      <main id="conteudo">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="kicker">Ative seu modo ON</p>
            <h1 className="brand-headline">
              O Lek Trek comanda o som.
              <br />
              <span>A galera mantém o set ON.</span>
            </h1>
            <p className="lead">
              Cada pessoa reage pelo próprio celular e vê sua reação chegar ao LED do Lek Trek, enquanto a energia coletiva transforma o palco
              até o drop.
            </p>
            <div className="home-ctas">
              <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
                <PowerIcon size={22} stroke={3} /> {busy ? 'Criando…' : 'Criar sessão ao vivo'}
              </button>
              <Link className="btn btn-dark" to="/demo">
                Explorar o protótipo
              </Link>
              <Link className="btn btn-ghost" to="/admin">
                Dashboard
              </Link>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <figure className="home-hero-art">
            <img src={IMG.fachada} alt="Render da fachada do espaço Sadia ON com o Lek Trek DJ gigante" />
            <figcaption>Render conceitual do espaço · referência de projeto</figcaption>
          </figure>
        </section>

        {created && L && (
          <section className="session-card" aria-labelledby="h-session" aria-live="polite">
            <div className="session-card-qr">
              <QrCode value={L.participant} size={220} label={`QR code para entrar na sessão ${created.number}`} />
              <p>Aponte a câmera do celular</p>
            </div>
            <div className="session-card-body">
              <p className="kicker">Sessão criada</p>
              <h2 id="h-session">
                Sessão {created.number} · <span className="mono">{created.id}</span>
              </h2>
              <ol className="session-steps">
                <li>
                  <a className="btn btn-primary btn-sm" href={L.stage} target="lektrek-palco" rel="noopener">
                    Abrir palco
                  </a>
                  <span>na TV ou no projetor (tela cheia).</span>
                </li>
                <li>
                  <Link className="btn btn-dark btn-sm" to={`/controle/${created.id}`}>
                    Abrir controle
                  </Link>
                  <span>nesta janela, para conduzir a dinâmica.</span>
                </li>
                <li>
                  <span>Participantes escaneiam o QR ou acessam o link de participação.</span>
                </li>
              </ol>
              <div className="copy-list">
                {(
                  [
                    ['Link de participação', L.participant],
                    ['Link do palco', L.stage],
                    ['Link de controle (privado)', L.control],
                  ] as const
                ).map(([label, v]) => (
                  <div className="copy-row" key={label}>
                    <span className="copy-label">{label}</span>
                    <code>{v.replace(/^https?:\/\//, '')}</code>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(label, v)}>
                      Copiar
                    </button>
                  </div>
                ))}
              </div>
              <p className="muted small" role="status">
                {copied ?? 'O link de controle dá acesso aos comandos: compartilhe só com quem apresenta.'}
              </p>
            </div>
          </section>
        )}

        <section className="home-areas" aria-labelledby="h-areas">
          <h2 id="h-areas">Como a demonstração funciona</h2>
          <div className="areas">
            <article>
              <span className="area-n">01</span>
              <h3>Palco</h3>
              <p>LED oval do Lek Trek, BG curvo 16:9 e fachada 9:16. Recebe reações e energia em tempo real.</p>
            </article>
            <article>
              <span className="area-n">02</span>
              <h3>Celular</h3>
              <p>Cadastro demonstrativo, pesquisa, voto no ritmo, câmera opcional, reações ao vivo e registro.</p>
            </article>
            <article>
              <span className="area-n">03</span>
              <h3>Controle</h3>
              <p>Inicia a pista, conduz a missão do drop, simula público e demonstra estados alternativos.</p>
            </article>
            <article>
              <span className="area-n">04</span>
              <h3>Demo individual</h3>
              <p>Celular simulado e palco na mesma página, para apresentar sem outros aparelhos.</p>
            </article>
          </div>
          <p className="muted small home-note">
            Protótipo para apresentação: sessões ficam em memória e são perdidas quando o servidor reinicia. Cadastro, clipe e dashboard usam
            dados demonstrativos.
          </p>
        </section>
      </main>
    </div>
  );
}
