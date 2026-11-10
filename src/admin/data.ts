import { MOTIVATIONS, RHYTHMS, type MotivationId, type RhythmId } from '../../shared/config';

/**
 * DADOS SIMULADOS para o dashboard administrativo.
 * Gerados de forma determinística por registro individual (cadastro → sessão → entrega),
 * para que totais, gráficos e filtros sejam sempre coerentes entre si.
 * Dia 1 reproduz os números do guia do protótipo.
 */

export type DeliveryStatus = 'pov' | 'coletivo' | 'processando' | 'falha';

export interface Registration {
  day: number;
  session: number;
  motivation: MotivationId;
  vote: RhythmId;
  attended: boolean;
  delivery: DeliveryStatus | null;
}

export interface SessionInfo {
  day: number;
  number: number;
  time: string;
}

interface DaySpec {
  day: number;
  sessions: number;
  startMin: number;
  cadastros: number;
  delivery: Record<DeliveryStatus, number>;
  motivation: number[]; // % por resposta (ordem MOTIVATIONS)
  votes: number[]; // % por ritmo (ordem RHYTHMS)
}

const DAYS: DaySpec[] = [
  { day: 1, sessions: 14, startMin: 12 * 60, cadastros: 480, delivery: { pov: 260, coletivo: 130, processando: 20, falha: 10 }, motivation: [40, 25, 15, 20], votes: [22, 18, 24, 36] },
  { day: 2, sessions: 16, startMin: 12 * 60, cadastros: 530, delivery: { pov: 300, coletivo: 140, processando: 18, falha: 10 }, motivation: [38, 27, 14, 21], votes: [25, 16, 22, 37] },
  { day: 3, sessions: 12, startMin: 13 * 60, cadastros: 395, delivery: { pov: 228, coletivo: 104, processando: 12, falha: 8 }, motivation: [41, 22, 17, 20], votes: [20, 19, 27, 34] },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Distribui `total` itens segundo percentuais, com arredondamento pelo maior resto (soma exata). */
function exactCounts(total: number, pcts: number[]): number[] {
  const raw = pcts.map((p) => (total * p) / 100);
  const base = raw.map(Math.floor);
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k++, rest--) base[order[k % order.length][1]]++;
  return base;
}

function expand<T>(values: readonly T[], counts: number[]): T[] {
  return values.flatMap((v, i) => Array.from({ length: counts[i] }, () => v));
}

function buildDay(spec: DaySpec) {
  const rand = mulberry32(2027 * 100 + spec.day);
  const attendedTotal = Object.values(spec.delivery).reduce((a, b) => a + b, 0);
  const motivations = shuffle(expand(MOTIVATIONS.map((m) => m.id), exactCounts(spec.cadastros, spec.motivation)), rand);
  const votes = shuffle(expand(RHYTHMS.map((r) => r.id), exactCounts(spec.cadastros, spec.votes)), rand);
  const deliveries = shuffle(
    expand(['pov', 'coletivo', 'processando', 'falha'] as DeliveryStatus[], [spec.delivery.pov, spec.delivery.coletivo, spec.delivery.processando, spec.delivery.falha]),
    rand,
  );
  // Presentes distribuídos o mais uniformemente possível entre as sessões (capacidade de referência: 30).
  const perSession = exactCounts(attendedTotal, Array.from({ length: spec.sessions }, () => 100 / spec.sessions));
  const attendedSession = shuffle(perSession.flatMap((n, i) => Array.from({ length: n }, () => i + 1)), rand);
  const noShowSession = Array.from({ length: spec.cadastros - attendedTotal }, () => 1 + Math.floor(rand() * spec.sessions));
  const regs: Registration[] = [];
  for (let i = 0; i < spec.cadastros; i++) {
    const attended = i < attendedTotal;
    regs.push({
      day: spec.day,
      session: attended ? attendedSession[i] : noShowSession[i - attendedTotal],
      motivation: motivations[i],
      vote: votes[i],
      attended,
      delivery: attended ? deliveries[i] : null,
    });
  }
  const sessions: SessionInfo[] = Array.from({ length: spec.sessions }, (_, i) => {
    const m = spec.startMin + i * 25;
    return { day: spec.day, number: i + 1, time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` };
  });
  return { regs, sessions };
}

const built = DAYS.map(buildDay);
export const REGISTRATIONS: Registration[] = built.flatMap((b) => b.regs);
export const SESSIONS: SessionInfo[] = built.flatMap((b) => b.sessions);
export const DAY_OPTIONS = DAYS.map((d) => d.day);

export interface Filter {
  day: number | 'all';
  session: number | 'all';
}

export function summarize(f: Filter) {
  const regs = REGISTRATIONS.filter((r) => (f.day === 'all' || r.day === f.day) && (f.session === 'all' || r.session === f.session));
  const att = regs.filter((r) => r.attended);
  const sessions = SESSIONS.filter((s) => (f.day === 'all' || s.day === f.day) && (f.session === 'all' || s.number === f.session));
  const delivery: Record<DeliveryStatus, number> = { pov: 0, coletivo: 0, processando: 0, falha: 0 };
  att.forEach((r) => r.delivery && delivery[r.delivery]++);
  const motivation = MOTIVATIONS.map((m) => ({ id: m.id, label: m.label, n: regs.filter((r) => r.motivation === m.id).length }));
  const votes = RHYTHMS.map((r) => ({ id: r.id, label: r.name, n: regs.filter((x) => x.vote === r.id).length }));
  return {
    cadastros: regs.length,
    participantes: att.length,
    sessoes: sessions.length,
    entregues: delivery.pov + delivery.coletivo,
    delivery,
    motivation,
    votes,
  };
}
