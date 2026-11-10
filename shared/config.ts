/**
 * Configuração central da dinâmica Lek Trek LIVE.
 *
 * Tudo aqui é HIPÓTESE DE PROTÓTIPO, não medição real de pista. Os valores
 * podem ser ajustados sem tocar no restante do código. Ver README → "Regra de energia".
 */

export const REACTIONS = [
  { id: 'heart', emoji: '❤️', label: 'Coração' },
  { id: 'fire', emoji: '🔥', label: 'Fogo' },
  { id: 'clap', emoji: '👏', label: 'Palmas' },
  { id: 'bolt', emoji: '⚡', label: 'Raio' },
] as const;

export type ReactionId = (typeof REACTIONS)[number]['id'];
export const REACTION_IDS = REACTIONS.map((r) => r.id) as ReactionId[];
export const REACTION_EMOJI: Record<ReactionId, string> = Object.fromEntries(
  REACTIONS.map((r) => [r.id, r.emoji]),
) as Record<ReactionId, string>;

/** Nomes de trabalho herdados do roteiro v2 — sem associação a SKU nesta fase. */
export const RHYTHMS = [
  { id: 'snacknbass', name: 'SnackN’Bass', vibe: 'Grave pesado e batida quebrada', bpm: 140, style: 'bass' },
  { id: 'rappanados', name: 'Rappanados', vibe: 'Boom bap com rima na ponta', bpm: 92, style: 'rap' },
  { id: 'crunchstep', name: 'CrunchStep', vibe: 'Meio-tempo crocante e sintético', bpm: 128, style: 'step' },
  { id: 'funkynchicken', name: 'FunkyN’Chicken', vibe: 'Tamborzão pra puxar a pista', bpm: 130, style: 'funk' },
] as const;

export type RhythmId = (typeof RHYTHMS)[number]['id'];
export const RHYTHM_IDS = RHYTHMS.map((r) => r.id) as RhythmId[];
export const rhythmById = (id: string | null | undefined) => RHYTHMS.find((r) => r.id === id) ?? null;

/**
 * Pesquisa de motivação (C03) → perfil (C05).
 * HIPÓTESE: associação 1:1 entre resposta e perfil. Para trocar a regra,
 * altere o campo `profile` de cada resposta.
 */
export const PROFILES = {
  pista: { title: 'ON na pista', short: 'ON NA PISTA', line: 'Quando a batida entra, você é o primeiro a puxar a galera.' },
  coro: { title: 'ON no coro', short: 'ON NO CORO', line: 'Refrão é com você: voz alta e a galera junto.' },
  descoberta: { title: 'ON na descoberta', short: 'ON NA DESCOBERTA', line: 'Você chega antes no som que ninguém conhece ainda.' },
  galera: { title: 'ON com a galera', short: 'ON COM A GALERA', line: 'O rolê só começa quando a sua turma tá junto.' },
} as const;
export type ProfileId = keyof typeof PROFILES;

export const MOTIVATIONS = [
  { id: 'batida', label: 'A batida', profile: 'pista' },
  { id: 'refrao', label: 'O refrão', profile: 'coro' },
  { id: 'descoberta', label: 'A descoberta', profile: 'descoberta' },
  { id: 'galera', label: 'A galera', profile: 'galera' },
] as const satisfies ReadonlyArray<{ id: string; label: string; profile: ProfileId }>;
export type MotivationId = (typeof MOTIVATIONS)[number]['id'];

export function profileFor(motivation: string | null | undefined): ProfileId {
  return (MOTIVATIONS.find((m) => m.id === motivation)?.profile ?? 'pista') as ProfileId;
}

/**
 * REGRA DE ENERGIA (simulação, não medição).
 *
 * Pista ON (fase `set`):
 *   pontos por reação aceita = max(minPoints, basePoints / √(participantes ativos))
 *   – participantes ativos = prontos + público simulado pelo controle
 *   – sem reações por `decayDelayMs`, a energia cai `decayPerSecond` até `floor`
 *   – "Palmas da sala" (botão do apresentador) soma `clapBonus`
 *
 * Missão do drop (fase `mission`): novo anel de 0 a 100, sem queda.
 *   – mesma pontuação × `mission.multiplier`
 *   – janela de `mission.durationMs`; se em `assistAtMs` a carga estiver abaixo
 *     de `assistBelow` e a assistência automática estiver ligada, o Lek Trek
 *     "puxa a batida" e completa a carga até o fim da janela (sinalizado na cena)
 *   – carga 100 = pista pronta para o drop. Drop manual por padrão; automático opcional.
 */
export const ENERGY = {
  start: 35,
  floor: 20,
  max: 100,
  basePoints: 3,
  minPoints: 0.35,
  decayDelayMs: 3000,
  decayPerSecond: 1,
  clapBonus: 10,
  highBand: 75,
  lowBand: 45,
  mission: {
    durationMs: 45_000,
    assistAtMs: 30_000,
    assistBelow: 70,
    multiplier: 1.2,
  },
} as const;

/** Limite de frequência: 1 reação contabilizada por participante a cada N ms. */
export const REACTION_RATE_LIMIT_MS = 350;
/** Revelação do ritmo vencedor antes de abrir a pista. */
export const REVEAL_MS = 6_000;
/** Contagem regressiva do build-up até o drop. */
export const BUILDUP_MS = 4_000;
/** No modo automático, o drop vira encerramento após este tempo. */
export const AUTO_END_AFTER_DROP_MS = 18_000;

/** Público simulado pelo apresentador: tamanho do grupo e reações por segundo. */
export const SIMULATED_CROWD = {
  off: { size: 0, perSecond: 0 },
  low: { size: 8, perSecond: 2.5 },
  high: { size: 25, perSecond: 11 },
} as const;
export type CrowdLevel = keyof typeof SIMULATED_CROWD;

/** Etapas da sessão, na ordem do roteiro (versão de apresentação). */
export const PHASES = ['lobby', 'reveal', 'set', 'mission', 'buildup', 'drop', 'ended'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Recepção',
  reveal: 'Revelação do ritmo',
  set: 'Pista ON',
  mission: 'Missão do drop',
  buildup: 'Build-up',
  drop: 'Drop · Modo ON',
  ended: 'Encerramento',
};

export const LIVE_PHASES: Phase[] = ['set', 'mission', 'buildup', 'drop'];
export const isLivePhase = (p: Phase) => LIVE_PHASES.includes(p);
