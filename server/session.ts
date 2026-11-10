import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AUTO_END_AFTER_DROP_MS,
  BUILDUP_MS,
  ENERGY,
  PHASES,
  REACTION_IDS,
  REACTION_RATE_LIMIT_MS,
  REVEAL_MS,
  RHYTHM_IDS,
  SIMULATED_CROWD,
  isLivePhase,
  type CrowdLevel,
  type Phase,
  type ReactionId,
  type RhythmId,
} from '../shared/config';
import type { ControlCommand, ReactionBatchItem, SessionState, StageView } from '../shared/types';

export interface Participant {
  pid: string;
  sockets: Set<string>;
  status: 'onboarding' | 'ready';
  vote: RhythmId | null;
  lastReactionAt: number;
  joinedAt: number;
}

export type ReactResult = 'accepted' | 'rate_limited' | 'inactive' | 'unknown' | 'invalid';

const MAX_PARTICIPANTS = 500;
const PID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Lógica de uma sessão (sala). Pura: recebe o relógio `now` de fora para ser testável.
 * O servidor é a única fonte de verdade de energia, carga do drop e etapa.
 */
export class Session {
  readonly id: string;
  readonly number: number;
  readonly createdAt: number;
  private readonly controlKey: string;
  lastActivity: number;

  phase: Phase = 'lobby';
  phaseStartedAt: number;
  participants = new Map<string, Participant>();
  stageSockets = new Set<string>();

  votingOpen = true;
  winner: RhythmId | null = null;
  setlist: RhythmId[] = [];
  block = 0;

  energy: number = ENERGY.start;
  dropCharge = 0;
  dropReady = false;
  dropReadyAt: number | null = null;
  assisted = false;
  assistActive = false;
  missionEndsAt: number | null = null;
  buildupEndsAt: number | null = null;
  dropAt: number | null = null;
  lastReactionAt: number;
  totalReactions = 0;

  qrVisible = true;
  view: StageView = 'main';
  autoDrop = false;
  autoAssist = true;
  crowd: CrowdLevel = 'off';
  scenario = { uploadFailure: false };
  lastClapAt: number | null = null;
  runId = 1;

  /** Incrementa a cada mudança de estado; o transporte decide quando transmitir. */
  version = 0;
  private crowdAccumulator = 0;
  private pending = new Map<string, number>();

  constructor(opts: { id: string; number: number; now: number; controlKey?: string }) {
    this.id = opts.id;
    this.number = opts.number;
    this.createdAt = opts.now;
    this.lastActivity = opts.now;
    this.phaseStartedAt = opts.now;
    this.lastReactionAt = opts.now;
    this.controlKey = opts.controlKey ?? randomBytes(18).toString('base64url');
  }

  getControlKey() {
    return this.controlKey;
  }

  verifyControlKey(key: unknown): boolean {
    if (typeof key !== 'string' || key.length !== this.controlKey.length) return false;
    return timingSafeEqual(Buffer.from(key), Buffer.from(this.controlKey));
  }

  private touch(now: number) {
    this.lastActivity = now;
    this.version++;
  }

  /* ───────────── Participantes ───────────── */

  join(pid: string, socketId: string, now: number) {
    if (!PID_RE.test(pid)) return { error: 'invalid_pid' as const };
    let p = this.participants.get(pid);
    let isNew = false;
    if (!p) {
      if (this.participants.size >= MAX_PARTICIPANTS) return { error: 'session_full' as const };
      p = { pid, sockets: new Set(), status: 'onboarding', vote: null, lastReactionAt: 0, joinedAt: now };
      this.participants.set(pid, p);
      isNew = true;
    }
    p.sockets.add(socketId);
    this.touch(now);
    return { participant: p, isNew };
  }

  detach(pid: string, socketId: string, now: number) {
    const p = this.participants.get(pid);
    if (!p) return;
    p.sockets.delete(socketId);
    this.touch(now);
  }

  setReady(pid: string, now: number) {
    const p = this.participants.get(pid);
    if (!p) return false;
    if (p.status !== 'ready') {
      p.status = 'ready';
      this.touch(now);
    }
    return true;
  }

  vote(pid: string, rhythm: string, now: number): boolean {
    const p = this.participants.get(pid);
    if (!p || !this.votingOpen || !RHYTHM_IDS.includes(rhythm as RhythmId)) return false;
    p.vote = rhythm as RhythmId;
    this.touch(now);
    return true;
  }

  tally(): Record<RhythmId, number> {
    const votes = Object.fromEntries(RHYTHM_IDS.map((r) => [r, 0])) as Record<RhythmId, number>;
    for (const p of this.participants.values()) if (p.vote) votes[p.vote]++;
    return votes;
  }

  /** Ordem do set: mais votados primeiro; empate resolvido por ordem rotativa entre sessões. */
  computeSetlist(): RhythmId[] {
    const votes = this.tally();
    const rot = this.number % RHYTHM_IDS.length;
    const rotation = [...RHYTHM_IDS.slice(rot), ...RHYTHM_IDS.slice(0, rot)];
    return [...rotation].sort((a, b) => votes[b] - votes[a] || rotation.indexOf(a) - rotation.indexOf(b)).slice(0, 3);
  }

  /** Participantes considerados para escalar a pontuação de cada reação. */
  activeCount(): number {
    let ready = 0;
    for (const p of this.participants.values()) if (p.status === 'ready' && p.sockets.size > 0) ready++;
    return Math.max(1, ready + SIMULATED_CROWD[this.crowd].size);
  }

  pointsPerReaction(): number {
    return Math.max(ENERGY.minPoints, ENERGY.basePoints / Math.sqrt(this.activeCount()));
  }

  react(pid: string, reaction: string, now: number): ReactResult {
    if (!REACTION_IDS.includes(reaction as ReactionId)) return 'invalid';
    const p = this.participants.get(pid);
    if (!p) return 'unknown';
    if (!isLivePhase(this.phase)) return 'inactive';
    if (now - p.lastReactionAt < REACTION_RATE_LIMIT_MS) return 'rate_limited';
    p.lastReactionAt = now;
    this.applyReaction(reaction as ReactionId, now, false);
    return 'accepted';
  }

  private applyReaction(r: ReactionId, now: number, sim: boolean, points = this.pointsPerReaction()) {
    this.totalReactions++;
    this.lastReactionAt = now;
    const key = `${r}|${sim ? 1 : 0}`;
    this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
    if (this.phase === 'set') {
      this.energy = clamp(this.energy + points, ENERGY.floor, ENERGY.max);
    } else if (this.phase === 'mission') {
      this.addCharge(points * ENERGY.mission.multiplier, now);
      this.energy = clamp(this.energy + points * 0.5, ENERGY.floor, ENERGY.max);
    }
    this.touch(now);
  }

  private addCharge(points: number, now: number) {
    this.dropCharge = clamp(this.dropCharge + points, 0, 100);
    if (this.dropCharge >= 100 && !this.dropReady) {
      this.dropReady = true;
      this.dropReadyAt = now;
    }
  }

  /** Reações extras geradas pelo apresentador (público simulado). */
  addSimulated(count: number, now: number, rand: () => number = Math.random) {
    if (!isLivePhase(this.phase)) return 0;
    const n = clamp(Math.floor(count), 0, 200);
    for (let i = 0; i < n; i++) {
      const r = REACTION_IDS[Math.floor(rand() * REACTION_IDS.length)];
      this.applyReaction(r, now, true);
    }
    return n;
  }

  drainReactions(): ReactionBatchItem[] {
    if (this.pending.size === 0) return [];
    const out: ReactionBatchItem[] = [];
    for (const [key, n] of this.pending) {
      const [r, sim] = key.split('|');
      out.push(sim === '1' ? { r: r as ReactionId, n, sim: true } : { r: r as ReactionId, n });
    }
    this.pending.clear();
    return out;
  }

  /* ───────────── Etapas ───────────── */

  private enter(phase: Phase, now: number) {
    this.phase = phase;
    this.phaseStartedAt = now;
    switch (phase) {
      case 'lobby':
        this.votingOpen = true;
        this.winner = null;
        this.setlist = [];
        this.block = 0;
        this.energy = ENERGY.start;
        this.dropCharge = 0;
        this.dropReady = false;
        this.dropReadyAt = null;
        this.assisted = false;
        this.assistActive = false;
        this.missionEndsAt = null;
        this.buildupEndsAt = null;
        this.dropAt = null;
        this.totalReactions = 0;
        this.qrVisible = true;
        this.runId++;
        break;
      case 'reveal':
        this.closeVoting();
        break;
      case 'set':
        this.closeVoting();
        this.block = 0;
        this.lastReactionAt = now;
        break;
      case 'mission':
        this.closeVoting();
        this.block = Math.min(1, this.setlist.length - 1);
        this.dropCharge = 0;
        this.dropReady = false;
        this.dropReadyAt = null;
        this.assisted = false;
        this.assistActive = false;
        this.missionEndsAt = now + ENERGY.mission.durationMs;
        break;
      case 'buildup':
        this.closeVoting();
        this.block = Math.max(0, this.setlist.length - 1);
        this.buildupEndsAt = now + BUILDUP_MS;
        break;
      case 'drop':
        this.closeVoting();
        this.dropAt = now;
        this.energy = ENERGY.max;
        this.dropCharge = 100;
        this.buildupEndsAt = null;
        break;
      case 'ended':
        this.closeVoting();
        this.assistActive = false;
        this.qrVisible = false;
        break;
    }
    this.touch(now);
  }

  private closeVoting() {
    if (!this.votingOpen && this.setlist.length) return;
    this.votingOpen = false;
    this.setlist = this.computeSetlist();
    this.winner = this.setlist[0] ?? null;
  }

  private nextPhase(): Phase | null {
    const i = PHASES.indexOf(this.phase);
    return i >= 0 && i < PHASES.length - 1 ? PHASES[i + 1] : null;
  }

  command(cmd: ControlCommand, now: number, rand: () => number = Math.random): { ok: boolean; error?: string } {
    switch (cmd.type) {
      case 'start':
        if (this.phase !== 'lobby') return { ok: false, error: 'A pista já foi iniciada.' };
        this.enter('reveal', now);
        this.qrVisible = false;
        return { ok: true };
      case 'next': {
        const n = this.nextPhase();
        if (!n) return { ok: false, error: 'Sessão já encerrada.' };
        this.enter(n, now);
        if (n === 'reveal') this.qrVisible = false;
        return { ok: true };
      }
      case 'goto':
        if (!PHASES.includes(cmd.phase)) return { ok: false, error: 'Etapa inválida.' };
        this.enter(cmd.phase, now);
        return { ok: true };
      case 'nextBlock':
        if (!this.setlist.length) return { ok: false, error: 'Setlist ainda não definida.' };
        this.block = (this.block + 1) % this.setlist.length;
        this.touch(now);
        return { ok: true };
      case 'drop':
        if (this.phase === 'set' || this.phase === 'mission' || this.phase === 'reveal') {
          this.enter('buildup', now);
          return { ok: true };
        }
        if (this.phase === 'buildup') {
          this.enter('drop', now);
          return { ok: true };
        }
        return { ok: false, error: 'O drop só pode ser acionado durante a pista.' };
      case 'end':
        this.enter('ended', now);
        return { ok: true };
      case 'restart':
        this.enter('lobby', now);
        return { ok: true };
      case 'clap':
        if (!isLivePhase(this.phase)) return { ok: false, error: 'Palmas valem só com a pista aberta.' };
        this.lastClapAt = now;
        this.lastReactionAt = now;
        if (this.phase === 'set') this.energy = clamp(this.energy + ENERGY.clapBonus, ENERGY.floor, ENERGY.max);
        if (this.phase === 'mission') this.addCharge(ENERGY.clapBonus, now);
        this.touch(now);
        return { ok: true };
      case 'setEnergy':
        if (typeof cmd.value !== 'number' || Number.isNaN(cmd.value)) return { ok: false, error: 'Valor inválido.' };
        if (this.phase === 'mission') this.dropCharge = clamp(cmd.value, 0, 100);
        else this.energy = clamp(cmd.value, ENERGY.floor, ENERGY.max);
        if (this.phase === 'mission') this.addCharge(0, now);
        this.lastReactionAt = now;
        this.touch(now);
        return { ok: true };
      case 'resetEnergy':
        this.energy = ENERGY.start;
        this.dropCharge = 0;
        this.dropReady = false;
        this.dropReadyAt = null;
        this.assistActive = false;
        this.assisted = false;
        this.lastReactionAt = now;
        this.touch(now);
        return { ok: true };
      case 'assist':
        if (this.phase !== 'mission') return { ok: false, error: 'Assistência só existe na missão do drop.' };
        this.assistActive = true;
        this.assisted = true;
        this.touch(now);
        return { ok: true };
      case 'crowd':
        if (!(cmd.level in SIMULATED_CROWD)) return { ok: false, error: 'Nível inválido.' };
        this.crowd = cmd.level;
        this.touch(now);
        return { ok: true };
      case 'simulateBurst':
        if (!isLivePhase(this.phase)) return { ok: false, error: 'Abra a pista para simular reações.' };
        this.addSimulated(cmd.count, now, rand);
        return { ok: true };
      case 'qr':
        this.qrVisible = !!cmd.visible;
        this.touch(now);
        return { ok: true };
      case 'view':
        if (cmd.view !== 'main' && cmd.view !== 'fachada') return { ok: false, error: 'Visão inválida.' };
        this.view = cmd.view;
        this.touch(now);
        return { ok: true };
      case 'autoDrop':
        this.autoDrop = !!cmd.value;
        this.touch(now);
        return { ok: true };
      case 'autoAssist':
        this.autoAssist = !!cmd.value;
        this.touch(now);
        return { ok: true };
      case 'scenario':
        this.scenario = { uploadFailure: !!cmd.uploadFailure };
        this.touch(now);
        return { ok: true };
      case 'forceReconnect':
        return { ok: true };
      default:
        return { ok: false, error: 'Comando desconhecido.' };
    }
  }

  /** Avança o relógio da sessão. Retorna true se algo mudou. */
  tick(now: number, dtMs: number, rand: () => number = Math.random): boolean {
    const before = this.version;
    const dt = clamp(dtMs, 0, 2000);

    if (this.phase === 'reveal' && now - this.phaseStartedAt >= REVEAL_MS) this.enter('set', now);

    if (isLivePhase(this.phase) && this.crowd !== 'off') {
      this.crowdAccumulator += (SIMULATED_CROWD[this.crowd].perSecond * dt) / 1000;
      const n = Math.floor(this.crowdAccumulator);
      if (n > 0) {
        this.crowdAccumulator -= n;
        this.addSimulated(n, now, rand);
      }
    }

    if (this.phase === 'set' && now - this.lastReactionAt > ENERGY.decayDelayMs && this.energy > ENERGY.floor) {
      this.energy = Math.max(ENERGY.floor, this.energy - (ENERGY.decayPerSecond * dt) / 1000);
      this.version++;
    }

    if (this.phase === 'mission' && this.missionEndsAt) {
      const elapsed = now - this.phaseStartedAt;
      if (
        !this.assistActive &&
        this.autoAssist &&
        !this.dropReady &&
        elapsed >= ENERGY.mission.assistAtMs &&
        this.dropCharge < ENERGY.mission.assistBelow
      ) {
        this.assistActive = true;
        this.assisted = true;
        this.version++;
      }
      if (this.assistActive && !this.dropReady) {
        const remaining = Math.max(1, this.missionEndsAt - now);
        const step = ((100 - this.dropCharge) * dt) / remaining;
        this.addCharge(now >= this.missionEndsAt ? 100 : step, now);
        this.version++;
      }
      if (this.autoDrop && this.dropReady && this.dropReadyAt && now - this.dropReadyAt >= 2000) {
        this.enter('buildup', now);
      }
    }

    if (this.phase === 'buildup' && this.buildupEndsAt && now >= this.buildupEndsAt) this.enter('drop', now);

    if (this.phase === 'drop' && this.autoDrop && this.dropAt && now - this.dropAt >= AUTO_END_AFTER_DROP_MS) {
      this.enter('ended', now);
    }

    return this.version !== before;
  }

  getState(now: number): SessionState {
    let connected = 0;
    let ready = 0;
    for (const p of this.participants.values()) {
      if (p.sockets.size > 0) {
        connected++;
        if (p.status === 'ready') ready++;
      }
    }
    return {
      id: this.id,
      number: this.number,
      phase: this.phase,
      phaseStartedAt: this.phaseStartedAt,
      serverNow: now,
      votingOpen: this.votingOpen,
      votes: this.tally(),
      winner: this.winner,
      setlist: this.setlist,
      block: this.block,
      counts: { connected, ready, known: this.participants.size, stages: this.stageSockets.size },
      energy: Math.round(this.energy * 10) / 10,
      dropCharge: Math.round(this.dropCharge * 10) / 10,
      dropReady: this.dropReady,
      assisted: this.assisted,
      missionEndsAt: this.missionEndsAt,
      buildupEndsAt: this.buildupEndsAt,
      totalReactions: this.totalReactions,
      qrVisible: this.qrVisible,
      view: this.view,
      autoDrop: this.autoDrop,
      autoAssist: this.autoAssist,
      crowd: this.crowd,
      scenario: this.scenario,
      lastClapAt: this.lastClapAt,
      runId: this.runId,
    };
  }

  hasSockets() {
    if (this.stageSockets.size) return true;
    for (const p of this.participants.values()) if (p.sockets.size) return true;
    return false;
  }
}

const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class SessionStore {
  private sessions = new Map<string, Session>();
  private counter: number;
  constructor(private opts: { maxSessions: number; numberStart: number }) {
    this.counter = opts.numberStart;
  }

  private newId(): string {
    for (;;) {
      const bytes = randomBytes(6);
      const id = Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
      if (!this.sessions.has(id)) return id;
    }
  }

  create(now: number): Session | null {
    if (this.sessions.size >= this.opts.maxSessions) {
      this.cleanup(now, true);
      if (this.sessions.size >= this.opts.maxSessions) return null;
    }
    const s = new Session({ id: this.newId(), number: this.counter++, now });
    this.sessions.set(s.id, s);
    return s;
  }

  get(id: unknown): Session | undefined {
    if (typeof id !== 'string') return undefined;
    return this.sessions.get(id.toUpperCase());
  }

  all() {
    return this.sessions.values();
  }

  get size() {
    return this.sessions.size;
  }

  /** Remove sessões ociosas. `aggressive` libera espaço quando o limite é atingido. */
  cleanup(now: number, aggressive = false) {
    const idleLimit = aggressive ? 20 * 60_000 : 6 * 60 * 60_000;
    const endedLimit = aggressive ? 5 * 60_000 : 60 * 60_000;
    for (const [id, s] of this.sessions) {
      const idle = now - s.lastActivity;
      if (s.hasSockets() && !aggressive) continue;
      if (idle > idleLimit || (s.phase === 'ended' && idle > endedLimit)) this.sessions.delete(id);
    }
  }
}
