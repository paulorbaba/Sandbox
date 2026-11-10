import type { Server, Socket } from 'socket.io';
import type { Ack, ControlCommand, JoinParticipantData } from '../shared/types';
import type { Session, SessionStore } from './session';

const LOOP_MS = 100;
const STATE_MIN_INTERVAL_MS = 150;
const SOCKET_EVENTS_PER_SECOND = 25;

type Role = 'stage' | 'participant' | 'control';
interface SocketData {
  role?: Role;
  sessionId?: string;
  pid?: string;
  controlFor?: string;
  bucket: { t: number; n: number };
}

const room = (id: string) => `s:${id}`;
const watchers = (id: string) => `w:${id}`;
const participantsRoom = (id: string) => `p:${id}`;

export const stats = { reactionsSinceBoot: 0, sessionsCreated: 0 };

export function attachRealtime(io: Server, store: SessionStore) {
  const lastSent = new Map<string, { version: number; at: number }>();

  const broadcast = (s: Session, now: number, force = false) => {
    const prev = lastSent.get(s.id);
    if (!force && prev && (prev.version === s.version || now - prev.at < STATE_MIN_INTERVAL_MS)) return;
    lastSent.set(s.id, { version: s.version, at: now });
    io.to(room(s.id)).emit('state', s.getState(now));
  };

  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = now - last;
    last = now;
    for (const s of store.all()) {
      s.tick(now, dt);
      const batch = s.drainReactions();
      if (batch.length) io.to(watchers(s.id)).emit('reactions', batch);
      broadcast(s, now);
    }
  }, LOOP_MS).unref();

  setInterval(() => {
    store.cleanup(Date.now());
    for (const id of lastSent.keys()) if (!store.get(id)) lastSent.delete(id);
  }, 60_000).unref();

  const allow = (socket: Socket) => {
    const d = socket.data as SocketData;
    const now = Date.now();
    if (now - d.bucket.t > 1000) d.bucket = { t: now, n: 0 };
    d.bucket.n++;
    return d.bucket.n <= SOCKET_EVENTS_PER_SECOND;
  };

  const reply = <T>(ack: unknown, payload: Ack<T>) => {
    if (typeof ack === 'function') ack(payload);
  };

  io.on('connection', (socket) => {
    (socket.data as SocketData) = { bucket: { t: Date.now(), n: 0 } };
    const data = socket.data as SocketData;

    socket.on('stage:join', (msg: unknown, ack: unknown) => {
      const s = store.get((msg as { sessionId?: unknown })?.sessionId);
      if (!s) return reply(ack, { ok: false, error: 'not_found' });
      data.role = 'stage';
      data.sessionId = s.id;
      s.stageSockets.add(socket.id);
      socket.join([room(s.id), watchers(s.id)]);
      const now = Date.now();
      s.lastActivity = now;
      s.version++;
      reply(ack, { ok: true, data: s.getState(now) });
    });

    socket.on('control:auth', (msg: unknown, ack: unknown) => {
      const m = msg as { sessionId?: unknown; key?: unknown };
      const s = store.get(m?.sessionId);
      if (!s) return reply(ack, { ok: false, error: 'not_found' });
      if (!s.verifyControlKey(m?.key)) return reply(ack, { ok: false, error: 'unauthorized' });
      data.role = 'control';
      data.sessionId = s.id;
      data.controlFor = s.id;
      socket.join([room(s.id), watchers(s.id)]);
      reply(ack, { ok: true, data: s.getState(Date.now()) });
    });

    socket.on('control:cmd', (cmd: unknown, ack: unknown) => {
      const s = store.get(data.controlFor);
      if (!s || data.role !== 'control') return reply(ack, { ok: false, error: 'unauthorized' });
      if (!cmd || typeof cmd !== 'object' || typeof (cmd as { type?: unknown }).type !== 'string') {
        return reply(ack, { ok: false, error: 'invalid' });
      }
      const now = Date.now();
      const c = cmd as ControlCommand;
      const res = s.command(c, now);
      if (res.ok && c.type === 'forceReconnect') {
        io.to(participantsRoom(s.id)).emit('force-reconnect', { ms: 2500 });
      }
      if (res.ok && c.type === 'simulateBurst') stats.reactionsSinceBoot += Math.max(0, Math.floor(c.count));
      const batch = s.drainReactions();
      if (batch.length) io.to(watchers(s.id)).emit('reactions', batch);
      broadcast(s, now, true);
      reply(ack, res.ok ? { ok: true } : { ok: false, error: res.error ?? 'error' });
    });

    socket.on('participant:join', (msg: unknown, ack: unknown) => {
      const m = msg as { sessionId?: unknown; pid?: unknown };
      const s = store.get(m?.sessionId);
      if (!s) return reply(ack, { ok: false, error: 'not_found' });
      if (typeof m.pid !== 'string') return reply(ack, { ok: false, error: 'invalid_pid' });
      const now = Date.now();
      // Um socket representa um participante por vez.
      if (data.pid && data.sessionId) store.get(data.sessionId)?.detach(data.pid, socket.id, now);
      const res = s.join(m.pid, socket.id, now);
      if ('error' in res) return reply(ack, { ok: false, error: res.error ?? 'error' });
      data.role = 'participant';
      data.sessionId = s.id;
      data.pid = m.pid;
      socket.join([room(s.id), participantsRoom(s.id)]);
      const payload: JoinParticipantData = {
        state: s.getState(now),
        participant: { status: res.participant.status, vote: res.participant.vote, isNew: res.isNew },
      };
      reply(ack, { ok: true, data: payload });
      broadcast(s, now);
    });

    socket.on('participant:ready', (_msg: unknown, ack: unknown) => {
      const s = store.get(data.sessionId);
      if (!s || data.role !== 'participant' || !data.pid) return reply(ack, { ok: false, error: 'not_joined' });
      s.setReady(data.pid, Date.now());
      reply(ack, { ok: true });
    });

    socket.on('participant:vote', (msg: unknown, ack: unknown) => {
      const s = store.get(data.sessionId);
      if (!s || data.role !== 'participant' || !data.pid) return reply(ack, { ok: false, error: 'not_joined' });
      const ok = s.vote(data.pid, String((msg as { rhythm?: unknown })?.rhythm ?? ''), Date.now());
      reply(ack, ok ? { ok: true } : { ok: false, error: 'voting_closed' });
    });

    socket.on('participant:react', (msg: unknown) => {
      if (!allow(socket)) return;
      const s = store.get(data.sessionId);
      if (!s || data.role !== 'participant' || !data.pid) return;
      const r = s.react(data.pid, String((msg as { r?: unknown })?.r ?? ''), Date.now());
      if (r === 'accepted') stats.reactionsSinceBoot++;
    });

    socket.on('disconnect', () => {
      const s = store.get(data.sessionId);
      if (!s) return;
      const now = Date.now();
      if (data.role === 'participant' && data.pid) s.detach(data.pid, socket.id, now);
      if (data.role === 'stage') {
        s.stageSockets.delete(socket.id);
        s.version++;
      }
    });
  });
}
