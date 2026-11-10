export type Facing = 'environment' | 'user';
export type CameraFailure = 'denied' | 'unavailable' | 'insecure';

export function cameraSupport(): 'ok' | CameraFailure {
  if (typeof window === 'undefined') return 'unavailable';
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
  return 'ok';
}

export async function openCamera(facing: Facing): Promise<MediaStream> {
  const support = cameraSupport();
  if (support !== 'ok') throw Object.assign(new Error(support), { failure: support });
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    const failure: CameraFailure = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
    throw Object.assign(new Error(failure), { failure });
  }
}

export const failureOf = (e: unknown): CameraFailure => ((e as { failure?: CameraFailure })?.failure ?? 'unavailable');

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? null;
}

export const extFor = (mime: string) => (mime.includes('mp4') ? 'mp4' : 'webm');

export function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, w: number, h: number, mirror = false) {
  if (!sw || !sh) return;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * Grava a câmera através de um canvas: a troca traseira ↔ frontal não interrompe
 * a gravação. O arquivo fica só no aparelho (download local).
 */
export class CanvasRecorder {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement | null = null;
  private mirror = false;
  private raf = 0;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  readonly mime: string | null = pickMime();

  constructor(w = 720, h = 1280) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.draw();
    };
    loop();
  }

  setSource(video: HTMLVideoElement | null, mirror: boolean) {
    this.video = video;
    this.mirror = mirror;
  }

  private draw() {
    const v = this.video;
    const { width: w, height: h } = this.canvas;
    if (v && v.readyState >= 2) drawCover(this.ctx, v, v.videoWidth, v.videoHeight, w, h, this.mirror);
    // assinatura discreta no registro
    this.ctx.save();
    this.ctx.font = '700 30px Poppins, sans-serif';
    this.ctx.fillStyle = 'rgba(255,255,255,.85)';
    this.ctx.shadowColor = 'rgba(0,0,0,.5)';
    this.ctx.shadowBlur = 8;
    this.ctx.fillText('Sadia ON · Lek Trek LIVE', 28, h - 34);
    this.ctx.restore();
  }

  get supported() {
    return !!this.mime && typeof this.canvas.captureStream === 'function';
  }

  start() {
    if (!this.supported || !this.mime) throw new Error('recorder_unsupported');
    this.chunks = [];
    const stream = this.canvas.captureStream(30);
    this.rec = new MediaRecorder(stream, { mimeType: this.mime, videoBitsPerSecond: 3_000_000 });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(500);
  }

  stop(): Promise<Blob | null> {
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => resolve(this.chunks.length ? new Blob(this.chunks, { type: this.mime ?? 'video/webm' }) : null);
      rec.stop();
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    this.rec = null;
    this.video = null;
  }
}
