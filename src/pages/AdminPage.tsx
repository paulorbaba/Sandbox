import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DAY_OPTIONS, SESSIONS, summarize, type Filter } from '../admin/data';
import { Logo } from '../components/Brand';
import './pages.css';

const MOTIVATION_COLORS = ['#e30613', '#ffd200', '#f6e7c1', '#111111'];
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

interface LiveStats {
  sessionsInMemory: number;
  sessionsLive: number;
  sessionsCreated: number;
  participantsConnected: number;
  reactionsSinceBoot: number;
  uptimeSeconds: number;
}

export default function AdminPage() {
  const [filter, setFilter] = useState<Filter>({ day: 1, session: 'all' });
  const data = useMemo(() => summarize(filter), [filter]);
  const sessionOptions = SESSIONS.filter((s) => filter.day !== 'all' && s.day === filter.day);
  const [live, setLive] = useState<LiveStats | null>(null);

  useEffect(() => {
    document.title = 'Painel da experiência · Dados simulados';
    let alive = true;
    const load = () =>
      fetch('/api/stats')
        .then((r) => r.json())
        .then((s) => alive && setLive(s))
        .catch(() => undefined);
    load();
    const t = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const motivTotal = data.motivation.reduce((a, b) => a + b.n, 0);
  const voteTotal = data.votes.reduce((a, b) => a + b.n, 0);
  const deliveryTotal = Object.values(data.delivery).reduce((a, b) => a + b, 0);
  const maxVotePct = Math.max(40, ...data.votes.map((v) => Math.ceil(pctOf(v.n, voteTotal) / 10) * 10));

  // Donut
  let acc = 0;
  const arcs = data.motivation.map((m, i) => {
    const frac = motivTotal ? m.n / motivTotal : 0;
    const start = acc;
    acc += frac;
    return { ...m, start, frac, color: MOTIVATION_COLORS[i] };
  });
  const R = 80;
  const C = 2 * Math.PI * R;

  return (
    <div className="admin">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="admin-head">
        <Link to="/" aria-label="Voltar para a central">
          <Logo size={36} />
        </Link>
        <span className="admin-sep" aria-hidden="true" />
        <h1>Painel da experiência</h1>
        <span className="sim-badge">Visão administrativa · Dados simulados</span>
      </header>

      <main id="conteudo" className="admin-main">
        <div className="filters" role="group" aria-label="Filtros">
          <label>
            <span className="sr-only">Dia</span>
            <span className="f-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111" strokeWidth="2">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </span>
            <select
              value={filter.day}
              onChange={(e) => setFilter({ day: e.target.value === 'all' ? 'all' : Number(e.target.value), session: 'all' })}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
              <option value="all">Todos os dias</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sessão</span>
            <span className="f-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111" strokeWidth="2" strokeLinejoin="round">
                <path d="M12 3l9 5-9 5-9-5z" />
                <path d="M3 13l9 5 9-5" />
              </svg>
            </span>
            <select
              value={filter.session}
              disabled={filter.day === 'all'}
              onChange={(e) => setFilter((f) => ({ ...f, session: e.target.value === 'all' ? 'all' : Number(e.target.value) }))}
            >
              <option value="all">Todas as sessões</option>
              {sessionOptions.map((s) => (
                <option key={s.number} value={s.number}>
                  Sessão {s.number} · {s.time}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            {filter.day === 'all' ? 'Visão consolidada dos três dias.' : filter.session === 'all' ? `Dia ${filter.day}, todas as sessões.` : `Dia ${filter.day}, sessão ${filter.session}.`}
          </p>
        </div>

        <section className="kpis" aria-label="Indicadores principais (simulados)">
          <Kpi icon="user" label="Cadastros" value={data.cadastros} />
          <Kpi icon="users" label="Participantes" value={data.participantes} />
          <Kpi icon="check" label={filter.session === 'all' ? 'Sessões concluídas' : 'Sessão concluída'} value={data.sessoes} />
          <Kpi icon="play" label="Clipes entregues" value={data.entregues} />
        </section>

        <div className="charts">
          <section className="panel" aria-labelledby="h-motiv">
            <h2 id="h-motiv">O que coloca o público no modo ON?</h2>
            <div className="donut-wrap">
              <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Distribuição das respostas da pesquisa">
                <g transform="rotate(-90 110 110)">
                  {arcs.map((a) => (
                    <circle
                      key={a.id}
                      cx="110"
                      cy="110"
                      r={R}
                      fill="none"
                      stroke={a.color}
                      strokeWidth="44"
                      strokeDasharray={`${a.frac * C} ${C}`}
                      strokeDashoffset={-a.start * C}
                    />
                  ))}
                </g>
                <text x="110" y="122" textAnchor="middle" fontSize="38" aria-hidden="true">
                  ⚡
                </text>
              </svg>
              <ul className="legend">
                {arcs.map((a) => (
                  <li key={a.id}>
                    <i style={{ background: a.color }} />
                    <span>{a.label}</span>
                    <strong>{pctOf(a.n, motivTotal)}%</strong>
                    <span className="muted">({a.n})</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel" aria-labelledby="h-votes">
            <h2 id="h-votes">Votos por ritmo</h2>
            <div className="bars" role="img" aria-label={data.votes.map((v) => `${v.label}: ${pctOf(v.n, voteTotal)}%`).join(', ')}>
              <div className="bars-axis" aria-hidden="true">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>{Math.round((maxVotePct * (4 - i)) / 4)}%</span>
                ))}
              </div>
              <div className="bars-plot">
                {data.votes.map((v, i) => {
                  const p = pctOf(v.n, voteTotal);
                  return (
                    <div className="bar-col" key={v.id}>
                      <span className="bar-val">{p}%</span>
                      <span className="bar" style={{ height: `${(p / maxVotePct) * 100}%`, background: i % 2 ? '#e30613' : '#ffd200' }} />
                      <span className="bar-label">{v.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="muted small">Base: {voteTotal} votos registrados no cadastro.</p>
          </section>
        </div>

        <section className="panel delivery" aria-labelledby="h-deliv">
          <h2 id="h-deliv">Entrega de conteúdo</h2>
          <div className="deliv-bar" role="img" aria-label="Status de entrega">
            {(
              [
                ['pov', 'Com POV', '#e30613'],
                ['coletivo', 'Registro coletivo', '#ffd200'],
                ['processando', 'Em processamento', '#9a9083'],
                ['falha', 'Falha de entrega', '#111'],
              ] as const
            ).map(([k, , color]) => (
              <span key={k} style={{ flexGrow: data.delivery[k], background: color }} />
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">Com POV</th>
                <th scope="col">Registro coletivo</th>
                <th scope="col">Em processamento</th>
                <th scope="col">Falha de entrega</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{data.delivery.pov}</td>
                <td>{data.delivery.coletivo}</td>
                <td>{data.delivery.processando}</td>
                <td>{data.delivery.falha}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            Entregues = Com POV + Registro coletivo ({data.entregues}). Total acompanhado: {deliveryTotal} participantes.
          </p>
        </section>

        <p className="admin-foot">Perfis e votos vêm da pesquisa de entrada (base: cadastros). Participação e entrega vêm da operação (base: participantes).</p>

        <section className="panel real" aria-labelledby="h-real">
          <div className="real-head">
            <h2 id="h-real">Sala demonstrativa · dados reais desta instância</h2>
            <span className="real-badge">Não somados aos dados simulados</span>
          </div>
          {live ? (
            <dl className="real-grid">
              <div>
                <dt>Sessões em memória</dt>
                <dd>{live.sessionsInMemory}</dd>
              </div>
              <div>
                <dt>Sessões em andamento</dt>
                <dd>{live.sessionsLive}</dd>
              </div>
              <div>
                <dt>Celulares conectados agora</dt>
                <dd>{live.participantsConnected}</dd>
              </div>
              <div>
                <dt>Reações desde o início do servidor</dt>
                <dd>{live.reactionsSinceBoot}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Carregando indicadores da sala…</p>
          )}
          <p className="muted small">Atualiza a cada 5 s. Zera quando o servidor reinicia (sessões em memória).</p>
        </section>
      </main>
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  user: (
    <>
      <circle cx="16" cy="11" r="5" />
      <path d="M7 27c0-5 4-8 9-8s9 3 9 8" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="11" r="4.5" />
      <path d="M4 26c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5" />
      <circle cx="22" cy="10" r="3.5" />
      <path d="M21 17.5c4 0 7 2.5 7 7" />
    </>
  ),
  check: (
    <>
      <circle cx="16" cy="16" r="11" />
      <path d="M11 16.5l3.5 3.5 6.5-7" />
    </>
  ),
  play: (
    <>
      <rect x="4" y="7" width="24" height="18" rx="3" />
      <path d="M14 12v8l6-4z" />
    </>
  ),
};

function Kpi({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="kpi">
      <span className="kpi-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[icon]}
        </svg>
      </span>
      <div>
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value.toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
}
