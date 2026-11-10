import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ReactionId, RhythmId } from '../../shared/config';
import type { Ack, ControlCommand, JoinParticipantData, ReactionBatchItem, SessionState } from '../../shared/types';

/** Socket no mesmo domínio da página — nunca uma URL fixa. */
function createSocket(): Socket {
  return io({ autoConnect: false, reconnectionDelay: 600, reconnectionDelayMax: 3000 });
}

let clockOffset = 0;
/** Relógio aproximado do servidor (para contagens regressivas). */
export const serverNow = () => Date.now() + clockOffset;
const syncClock = (s: SessionState) => {
  clockOffset = s.serverNow - Date.now();
};

export type ChannelStatus = 'connecting' | 'connected' | 'reconnecting' | 'not_found' | 'unauthorized' | 'error';

type ReactionListener = (batch: ReactionBatchItem[]) => void;

function emitAck<T>(socket: Socket, event: string, payload: unknown, timeoutMs = 5000): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err: unknown, res: Ack<T>) => {
      if (err) resolve({ ok: false, error: 'timeout' });
      else resolve(res);
    });
  });
}

/** Palco ou controle: recebem estado + lotes de reações. */
export function useWatcherChannel(opts: { sessionId: string; role: 'stage' | 'control'; controlKey?: string | null }) {
  const { sessionId, role, controlKey } = opts;
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<ChannelStatus>('connecting');
  const socketRef = useRef<Socket | null>(null);
  const listeners = useRef(new Set<ReactionListener>());

  useEffect(() => {
    if (role === 'control' && !controlKey) {
      setStatus('unauthorized');
      return;
    }
    const socket = createSocket();
    socketRef.current = socket;
    const join = async () => {
      const res =
        role === 'stage'
          ? await emitAck<SessionState>(socket, 'stage:join', { sessionId })
          : await emitAck<SessionState>(socket, 'control:auth', { sessionId, key: controlKey });
      if (res.ok && res.data) {
        syncClock(res.data);
        setState(res.data);
        setStatus('connected');
      } else if (!res.ok) {
        setStatus(res.error === 'not_found' ? 'not_found' : res.error === 'unauthorized' ? 'unauthorized' : 'error');
        if (res.error === 'not_found' || res.error === 'unauthorized') socket.disconnect();
      }
    };
    socket.on('connect', join);
    socket.on('disconnect', () => setStatus((s) => (s === 'not_found' || s === 'unauthorized' ? s : 'reconnecting')));
    socket.on('state', (s: SessionState) => {
      syncClock(s);
      setState(s);
    });
    socket.on('reactions', (batch: ReactionBatchItem[]) => listeners.current.forEach((l) => l(batch)));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, role, controlKey]);

  const onReactions = useCallback((l: ReactionListener) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  const command = useCallback(async (cmd: ControlCommand) => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: 'Sem conexão com o servidor.' } as Ack;
    return emitAck(socket, 'control:cmd', cmd);
  }, []);

  return { state, status, onReactions, command };
}

/** Celular do participante. */
export function useParticipantChannel(sessionId: string, pid: string, enabled = true) {
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<ChannelStatus>('connecting');
  const [me, setMe] = useState<JoinParticipantData['participant'] | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const wantReady = useRef(false);
  const pendingVote = useRef<RhythmId | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const socket = createSocket();
    socketRef.current = socket;
    let forcedTimer: number | undefined;
    socket.on('connect', async () => {
      const res = await emitAck<JoinParticipantData>(socket, 'participant:join', { sessionId, pid });
      if (res.ok && res.data) {
        syncClock(res.data.state);
        setState(res.data.state);
        setMe(res.data.participant);
        setStatus('connected');
        // Reaplica intenções locais após reconectar (idempotentes no servidor).
        if (pendingVote.current && res.data.state.votingOpen && res.data.participant.vote !== pendingVote.current) {
          socket.emit('participant:vote', { rhythm: pendingVote.current });
        }
        if (wantReady.current && res.data.participant.status !== 'ready') socket.emit('participant:ready', {});
      } else if (!res.ok) {
        setStatus(res.error === 'not_found' ? 'not_found' : 'error');
        if (res.error === 'not_found') socket.disconnect();
      }
    });
    socket.on('disconnect', (reason) => {
      setStatus((s) => (s === 'not_found' ? s : 'reconnecting'));
      if (reason === 'io server disconnect') window.setTimeout(() => socket.connect(), 1500);
    });
    socket.on('state', (s: SessionState) => {
      syncClock(s);
      setState(s);
    });
    socket.on('force-reconnect', ({ ms }: { ms: number }) => {
      socket.disconnect();
      setStatus('reconnecting');
      forcedTimer = window.setTimeout(() => socket.connect(), Math.min(ms ?? 2500, 10_000));
    });
    socket.connect();
    return () => {
      window.clearTimeout(forcedTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, pid, enabled]);

  const markReady = useCallback(() => {
    wantReady.current = true;
    socketRef.current?.connected && socketRef.current.emit('participant:ready', {});
  }, []);

  const vote = useCallback(async (rhythm: RhythmId) => {
    pendingVote.current = rhythm;
    const socket = socketRef.current;
    if (!socket?.connected) return false;
    const res = await emitAck(socket, 'participant:vote', { rhythm });
    return res.ok;
  }, []);

  /** Reações nunca são enfileiradas: offline = descartadas (sem reenvio acumulado). */
  const react = useCallback((r: ReactionId) => {
    const socket = socketRef.current;
    if (!socket?.connected) return false;
    socket.volatile.emit('participant:react', { r });
    return true;
  }, []);

  return { state, status, me, markReady, vote, react };
}

export async function createSession(): Promise<{ id: string; number: number; controlKey: string }> {
  const res = await fetch('/api/sessions', { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? 'Não foi possível criar a sessão.');
  return body;
}
