import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RHYTHMS, type Phase, type RhythmId } from '../../shared/config';

/**
 * Trilha de demonstração sintetizada no navegador (Web Audio).
 * Não há áudio fornecido na pasta de referências; estas batidas são originais,
 * geradas em tempo real, e só começam após um toque explícito.
 */

type Style = (typeof RHYTHMS)[number]['style'];
interface Pattern {
  kick: number[];
  snare: number[];
  hat: number[];
  bass: Array<number | null>; // semitons relativos à fundamental
  swing?: number;
}
const S = (s: string) => s.split('').map((c) => (c === 'x' ? 1 : c === 'o' ? 0.6 : 0));
const PATTERNS: Record<Style, Pattern> = {
  funk: {
    kick: S('x..x..x.x..x..x.'),
    snare: S('....x.......x..o'),
    hat: S('x.x.x.x.x.x.x.x.'),
    bass: [0, null, null, 0, null, null, 3, null, 0, null, null, 0, null, null, 5, null],
  },
  rap: {
    kick: S('x......x..x.....'),
    snare: S('....x.......x...'),
    hat: S('x.x.x.x.x.x.x.xo'),
    bass: [0, null, null, null, null, null, null, -2, null, null, 0, null, null, null, null, null],
    swing: 0.14,
  },
  step: {
    kick: S('x...x...x...x...'),
    snare: S('....x.......x...'),
    hat: S('..x...x...x...x.'),
    bass: [null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, 3, null],
  },
  bass: {
    kick: S('x.........x.....'),
    snare: S('........x.......'),
    hat: S('x.x.x.x.x.x.x.x.'),
    bass: [0, null, 0, null, null, null, 0, 0, null, null, 7, null, null, 5, null, null],
  },
};
const ROOT: Record<Style, number> = { funk: 43.65, rap: 49, step: 55, bass: 41.2 };

class Synth {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
  timer = 0;
  step = 0;
  nextTime = 0;
  style: Style = 'funk';
  bpm = 130;
  intensity = 0.5;
  phase: Phase | 'preview' = 'preview';
  playing = false;

  constructor() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  configure(opts: { rhythm?: RhythmId | null; intensity?: number; phase?: Phase | 'preview' }) {
    const r = RHYTHMS.find((x) => x.id === opts.rhythm) ?? null;
    if (r) {
      this.style = r.style;
      this.bpm = r.bpm;
    }
    if (typeof opts.intensity === 'number') this.intensity = opts.intensity;
    if (opts.phase) this.phase = opts.phase;
  }

  async start(volume = 0.55) {
    await this.ctx.resume();
    if (!this.playing) {
      this.playing = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.06;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.08);
  }

  stop(fade = 0.25) {
    if (!this.playing) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    window.setTimeout(() => {
      window.clearInterval(this.timer);
      this.playing = false;
    }, fade * 1000 + 60);
  }

  private schedule() {
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const p = PATTERNS[this.style];
      const sw = p.swing && this.step % 2 === 1 ? stepDur * p.swing : 0;
      this.playStep(this.step % 16, this.nextTime + sw, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(i: number, t: number, stepDur: number) {
    const p = PATTERNS[this.style];
    const I = this.intensity;
    const calm = this.phase === 'lobby' || this.phase === 'ended' || this.phase === 'reveal';
    const big = this.phase === 'drop';
    const breakdown = this.phase === 'mission' && I < 0.7;
    if (this.phase === 'buildup') {
      // rufar crescente
      if (i % (this.step % 64 > 32 ? 1 : 2) === 0) this.snare(t, 0.25 + (this.step % 64) / 120);
      if (i % 4 === 0) this.kick(t, 0.8);
      return;
    }
    if (p.kick[i] && !(breakdown && i % 8 !== 0)) this.kick(t, (calm ? 0.55 : 0.9) * p.kick[i]);
    if (!calm && p.snare[i] && I > 0.32) this.snare(t, 0.5 * p.snare[i] + (big ? 0.2 : 0));
    if (p.hat[i] && (!calm || i % 4 === 0)) this.hat(t, (0.12 + I * 0.16) * p.hat[i], big && i % 2 === 1);
    if (!calm && I > 0.55 && p.hat[i] === 0 && i % 2 === 1 && I > 0.8) this.hat(t, 0.08, false);
    const note = p.bass[i];
    if (note !== null && (I > 0.45 || big) && !breakdown) this.bass(t, note, stepDur * 1.8, big ? 0.5 : 0.36);
  }

  private env(g: GainNode, t: number, peak: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  private kick(t: number, v: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this.env(g, t, v, 0.38);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.42);
  }

  private noiseHit(t: number, v: number, decay: number, type: BiquadFilterType, freq: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, t, v, decay);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + decay + 0.02);
  }

  private snare(t: number, v: number) {
    this.noiseHit(t, v, 0.18, 'bandpass', 1800);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    this.env(g, t, v * 0.5, 0.09);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, v: number, open: boolean) {
    this.noiseHit(t, v, open ? 0.16 : 0.04, 'highpass', 7500);
  }

  private bass(t: number, semis: number, dur: number, v: number) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = ROOT[this.style] * 2 ** (semis / 12);
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(180 + this.intensity * 600, t);
    f.frequency.exponentialRampToValueAtTime(90, t + dur);
    this.env(g, t, v, dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

let shared: Synth | null = null;
function synth(): Synth | null {
  if (typeof window === 'undefined') return null;
  if (!shared) {
    try {
      shared = new Synth();
    } catch {
      return null;
    }
  }
  return shared;
}

export const audioSupported = () =>
  typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

/** Prévia de ritmo (C04): toca ~8 s; uma prévia por vez; não altera o voto. */
export function useRhythmPreview() {
  const [playing, setPlaying] = useState<RhythmId | null>(null);
  const t = useRef<number>(undefined);
  const stop = useCallback(() => {
    window.clearTimeout(t.current);
    synth()?.stop();
    setPlaying(null);
  }, []);
  const toggle = useCallback(
    async (id: RhythmId) => {
      const s = synth();
      if (!s) return;
      if (playing === id) return stop();
      s.configure({ rhythm: id, intensity: 0.85, phase: 'preview' });
      await s.start(0.5);
      setPlaying(id);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(stop, 8000);
    },
    [playing, stop],
  );
  useEffect(() => stop, [stop]);
  return { playing, toggle, stop };
}

/** Trilha do palco: segue etapa, ritmo e intensidade da sessão. */
export function useStageAudio() {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const last = useRef<{ phase: Phase; rhythm: RhythmId | null; intensity: number } | null>(null);
  const api = useMemo(
    () => ({
      update(cfg: { phase: Phase; rhythm: RhythmId | null; intensity: number }) {
        last.current = cfg;
        if (!enabledRef.current) return;
        synth()?.configure(cfg);
      },
      accent() {
        /* reservado: sem efeito sonoro por reação para evitar poluição */
      },
    }),
    [],
  );
  const toggle = useCallback(async () => {
    const s = synth();
    if (!s) return;
    if (enabledRef.current) {
      s.stop(0.6);
      enabledRef.current = false;
      setEnabled(false);
    } else {
      if (last.current) s.configure(last.current);
      await s.start(0.6);
      enabledRef.current = true;
      setEnabled(true);
    }
  }, []);
  useEffect(() => () => synth()?.stop(0.1), []);
  return { ...api, enabled, toggle, supported: audioSupported() };
}
