import { ENERGY, rhythmById } from '../../../shared/config';
import { serverNow } from '../../lib/realtime';
import type { SessionState } from '../../../shared/types';

export function currentRhythm(s: SessionState) {
  return rhythmById(s.setlist[s.block] ?? s.winner) ?? null;
}

/** 0..1 — controla brilho, ondas e pulsos do ambiente. */
export function intensityOf(s: SessionState): number {
  switch (s.phase) {
    case 'lobby':
      return 0.22;
    case 'reveal':
      return 0.45;
    case 'set':
      return 0.3 + (s.energy / 100) * 0.55;
    case 'mission':
      return 0.5 + (s.dropCharge / 100) * 0.4;
    case 'buildup':
      return 0.95;
    case 'drop':
      return 1;
    case 'ended':
      return 0.3;
  }
}

/** Contagem do build-up: 3 · 2 · 1 · ON! */
export function buildupCount(s: SessionState, now = serverNow()): string | null {
  if (s.phase !== 'buildup' || !s.buildupEndsAt) return null;
  const rem = s.buildupEndsAt - now;
  return rem > 3000 ? '3' : rem > 2000 ? '2' : rem > 1000 ? '1' : 'ON!';
}

export function lekLine(s: SessionState): string {
  const r = currentRhythm(s);
  switch (s.phase) {
    case 'lobby':
      return 'A galera mantém o set ON. Escaneia e chega junto!';
    case 'reveal':
      return `Sessão ${s.number}, vocês deram o play. Quem abre essa live é… ${r?.name ?? 'a galera'}!`;
    case 'set':
      if (s.energy < ENERGY.lowBand) return 'Cadê essa pista? Reage aí que eu sigo vocês!';
      if (s.energy < ENERGY.highBand) return 'É isso! Quero ver essa pista ON!';
      return 'Essa pista tá ON! Segura esse ON!';
    case 'mission':
      if (s.dropReady) return 'Drop liberado! Celular pronto?';
      if (s.assisted) return 'Eu puxo a batida. Vocês vêm comigo!';
      return 'Essa pista tá ON. Mas o último drop é de vocês. Bora liberar?';
    case 'buildup':
      return 'Celular pronto? Galera junto? Três, dois, um…';
    case 'drop':
      return 'MODO ON ATIVADO!';
    case 'ended':
      return 'Esse ON foi de vocês. Agora leva essa live pro seu rolê!';
  }
}
