import { describe, expect, it } from 'vitest';
import { BUILDUP_MS, ENERGY, REACTION_RATE_LIMIT_MS, REVEAL_MS } from '../shared/config';
import { Session, SessionStore } from '../server/session';

const PID_A = 'participant-aaaa';
const PID_B = 'participant-bbbb';
const fixedRand = () => 0.1;

function liveSession(now = 1_000) {
  const s = new Session({ id: 'TEST01', number: 7, now, controlKey: 'k'.repeat(24) });
  s.join(PID_A, 'sock-a', now);
  s.setReady(PID_A, now);
  s.command({ type: 'goto', phase: 'set' }, now);
  return s;
}

describe('participantes', () => {
  it('reconexão com o mesmo id não duplica a contagem', () => {
    const s = new Session({ id: 'X', number: 1, now: 0 });
    s.join(PID_A, 'sock-1', 0);
    s.setReady(PID_A, 0);
    s.detach(PID_A, 'sock-1', 10);
    expect(s.getState(10).counts).toMatchObject({ connected: 0, known: 1, ready: 0 });
    const again = s.join(PID_A, 'sock-2', 20);
    expect('isNew' in again && again.isNew).toBe(false);
    expect(s.getState(20).counts).toMatchObject({ connected: 1, known: 1, ready: 1 });
  });

  it('rejeita ids inválidos', () => {
    const s = new Session({ id: 'X', number: 1, now: 0 });
    expect(s.join('../hack', 'sock', 0)).toEqual({ error: 'invalid_pid' });
  });

  it('votos só valem com a votação aberta e mudam a setlist', () => {
    const s = new Session({ id: 'X', number: 1, now: 0 });
    s.join(PID_A, 'a', 0);
    s.join(PID_B, 'b', 0);
    expect(s.vote(PID_A, 'funkynchicken', 0)).toBe(true);
    expect(s.vote(PID_B, 'funkynchicken', 0)).toBe(true);
    expect(s.vote(PID_B, 'nao-existe', 0)).toBe(false);
    s.command({ type: 'start' }, 1);
    expect(s.winner).toBe('funkynchicken');
    expect(s.setlist).toHaveLength(3);
    expect(s.vote(PID_A, 'rappanados', 2)).toBe(false);
  });

  it('empate é resolvido pela ordem rotativa da sessão', () => {
    const a = new Session({ id: 'A', number: 0, now: 0 });
    const b = new Session({ id: 'B', number: 1, now: 0 });
    a.command({ type: 'start' }, 0);
    b.command({ type: 'start' }, 0);
    expect(a.winner).toBe('snacknbass');
    expect(b.winner).toBe('rappanados');
  });
});

describe('reações e energia', () => {
  it('reação aceita aumenta a energia e entra no lote do palco', () => {
    const s = liveSession();
    expect(s.energy).toBe(ENERGY.start);
    expect(s.react(PID_A, 'fire', 2_000)).toBe('accepted');
    expect(s.energy).toBeCloseTo(ENERGY.start + ENERGY.basePoints);
    expect(s.drainReactions()).toEqual([{ r: 'fire', n: 1 }]);
    expect(s.drainReactions()).toEqual([]);
  });

  it('aplica limite de frequência por participante', () => {
    const s = liveSession();
    expect(s.react(PID_A, 'heart', 2_000)).toBe('accepted');
    expect(s.react(PID_A, 'heart', 2_000 + REACTION_RATE_LIMIT_MS - 1)).toBe('rate_limited');
    expect(s.react(PID_A, 'heart', 2_000 + REACTION_RATE_LIMIT_MS)).toBe('accepted');
    expect(s.totalReactions).toBe(2);
  });

  it('ignora reações fora da pista, de desconhecidos e tipos inválidos', () => {
    const s = new Session({ id: 'X', number: 1, now: 0 });
    s.join(PID_A, 'a', 0);
    expect(s.react(PID_A, 'heart', 10)).toBe('inactive');
    s.command({ type: 'goto', phase: 'set' }, 10);
    expect(s.react('desconhecido-123', 'heart', 20)).toBe('unknown');
    expect(s.react(PID_A, 'bomba', 20)).toBe('invalid');
  });

  it('pontuação diminui conforme cresce o número de participantes', () => {
    const s = liveSession();
    const solo = s.pointsPerReaction();
    for (let i = 0; i < 15; i++) {
      const pid = `participant-${i}xxxx`;
      s.join(pid, `sock-${i}`, 0);
      s.setReady(pid, 0);
    }
    expect(s.pointsPerReaction()).toBeLessThan(solo);
    expect(s.pointsPerReaction()).toBeGreaterThanOrEqual(ENERGY.minPoints);
  });

  it('energia cai após inatividade, sem passar do piso', () => {
    const s = liveSession(0);
    s.tick(ENERGY.decayDelayMs - 100, 100);
    expect(s.energy).toBe(ENERGY.start);
    let t = ENERGY.decayDelayMs;
    for (let i = 0; i < 600; i++) s.tick((t += 100), 100);
    expect(s.energy).toBe(ENERGY.floor);
  });

  it('palmas da sala somam o bônus configurado', () => {
    const s = liveSession();
    s.command({ type: 'clap' }, 5_000);
    expect(s.energy).toBe(ENERGY.start + ENERGY.clapBonus);
  });

  it('público simulado gera reações marcadas como simuladas', () => {
    const s = liveSession();
    s.command({ type: 'simulateBurst', count: 5 }, 3_000, fixedRand);
    const batch = s.drainReactions();
    expect(batch.reduce((n, b) => n + b.n, 0)).toBe(5);
    expect(batch.every((b) => b.sim)).toBe(true);
  });
});

describe('etapas e drop', () => {
  it('revelação abre a pista automaticamente', () => {
    const s = new Session({ id: 'X', number: 1, now: 0 });
    s.command({ type: 'start' }, 0);
    expect(s.phase).toBe('reveal');
    s.tick(REVEAL_MS, 100);
    expect(s.phase).toBe('set');
  });

  it('missão começa um novo anel sem apagar a energia da pista', () => {
    const s = liveSession();
    s.command({ type: 'setEnergy', value: 90 }, 2_000);
    s.command({ type: 'next' }, 2_100);
    expect(s.phase).toBe('mission');
    expect(s.energy).toBe(90);
    expect(s.dropCharge).toBe(0);
  });

  it('carga 100 sinaliza pista pronta; drop é manual por padrão', () => {
    const s = liveSession();
    s.command({ type: 'goto', phase: 'mission' }, 2_000);
    s.command({ type: 'setEnergy', value: 100 }, 2_100);
    expect(s.dropReady).toBe(true);
    s.tick(10_000, 100);
    expect(s.phase).toBe('mission');
    s.command({ type: 'drop' }, 10_100);
    expect(s.phase).toBe('buildup');
    s.tick(10_100 + BUILDUP_MS, 100);
    expect(s.phase).toBe('drop');
  });

  it('modo automático leva do pronto ao drop sozinho', () => {
    const s = liveSession();
    s.command({ type: 'autoDrop', value: true }, 1_500);
    s.command({ type: 'goto', phase: 'mission' }, 2_000);
    s.command({ type: 'setEnergy', value: 100 }, 2_100);
    s.tick(4_200, 100);
    expect(s.phase).toBe('buildup');
    s.tick(4_200 + BUILDUP_MS, 100);
    expect(s.phase).toBe('drop');
  });

  it('assistência do Lek Trek completa a carga até o fim da janela e fica sinalizada', () => {
    const s = liveSession(0);
    s.command({ type: 'goto', phase: 'mission' }, 0);
    let t = 0;
    while (t < ENERGY.mission.durationMs + 200) s.tick((t += 100), 100);
    expect(s.assisted).toBe(true);
    expect(s.dropCharge).toBe(100);
    expect(s.dropReady).toBe(true);
  });

  it('reiniciar volta à recepção com energia inicial e nova rodada', () => {
    const s = liveSession();
    s.react(PID_A, 'bolt', 2_000);
    const run = s.runId;
    s.command({ type: 'restart' }, 3_000);
    expect(s.phase).toBe('lobby');
    expect(s.energy).toBe(ENERGY.start);
    expect(s.totalReactions).toBe(0);
    expect(s.runId).toBe(run + 1);
    expect(s.participants.size).toBe(1);
  });
});

describe('controle e isolamento', () => {
  it('só a credencial correta da sessão autoriza comandos', () => {
    const s = new Session({ id: 'X', number: 1, now: 0, controlKey: 'abc123abc123abc123abc123' });
    expect(s.verifyControlKey('abc123abc123abc123abc123')).toBe(true);
    expect(s.verifyControlKey('abc123abc123abc123abc124')).toBe(false);
    expect(s.verifyControlKey(undefined)).toBe(false);
    expect(s.verifyControlKey('curta')).toBe(false);
  });

  it('sessões diferentes não interferem entre si', () => {
    const store = new SessionStore({ maxSessions: 10, numberStart: 1 });
    const a = store.create(0)!;
    const b = store.create(0)!;
    expect(a.id).not.toBe(b.id);
    expect(a.verifyControlKey(b.getControlKey())).toBe(false);
    a.join(PID_A, 'sa', 0);
    a.command({ type: 'goto', phase: 'set' }, 0);
    a.react(PID_A, 'fire', 1_000);
    expect(b.energy).toBe(ENERGY.start);
    expect(b.totalReactions).toBe(0);
    expect(b.participants.size).toBe(0);
    expect(store.get(a.id.toLowerCase())).toBe(a);
  });

  it('respeita o limite de sessões em memória', () => {
    const store = new SessionStore({ maxSessions: 2, numberStart: 1 });
    expect(store.create(0)).not.toBeNull();
    expect(store.create(0)).not.toBeNull();
    expect(store.create(1)).toBeNull();
  });
});
