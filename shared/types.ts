import type { CrowdLevel, Phase, ReactionId, RhythmId } from './config';

export type StageView = 'main' | 'fachada';

/** Estado público da sessão — idêntico para palco, controle e celulares. Sem dados pessoais. */
export interface SessionState {
  id: string;
  number: number;
  phase: Phase;
  phaseStartedAt: number;
  serverNow: number;
  votingOpen: boolean;
  votes: Record<RhythmId, number>;
  winner: RhythmId | null;
  setlist: RhythmId[];
  block: number;
  counts: { connected: number; ready: number; known: number; stages: number };
  energy: number;
  dropCharge: number;
  dropReady: boolean;
  assisted: boolean;
  missionEndsAt: number | null;
  buildupEndsAt: number | null;
  totalReactions: number;
  qrVisible: boolean;
  view: StageView;
  autoDrop: boolean;
  autoAssist: boolean;
  crowd: CrowdLevel;
  scenario: { uploadFailure: boolean };
  lastClapAt: number | null;
  runId: number;
}

export interface ReactionBatchItem {
  r: ReactionId;
  n: number;
  sim?: boolean;
}

export type ControlCommand =
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'goto'; phase: Phase }
  | { type: 'nextBlock' }
  | { type: 'drop' }
  | { type: 'end' }
  | { type: 'restart' }
  | { type: 'clap' }
  | { type: 'setEnergy'; value: number }
  | { type: 'resetEnergy' }
  | { type: 'assist' }
  | { type: 'crowd'; level: CrowdLevel }
  | { type: 'simulateBurst'; count: number }
  | { type: 'qr'; visible: boolean }
  | { type: 'view'; view: StageView }
  | { type: 'autoDrop'; value: boolean }
  | { type: 'autoAssist'; value: boolean }
  | { type: 'scenario'; uploadFailure: boolean }
  | { type: 'forceReconnect' };

export type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export interface JoinParticipantData {
  state: SessionState;
  participant: { status: 'onboarding' | 'ready'; vote: RhythmId | null; isNew: boolean };
}
