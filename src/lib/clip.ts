import { IMG } from '../components/Brand';
import { drawCover, extFor, pickMime } from './camera';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const YELLOW = '#ffd200';
const RED = '#e30613';
const INK = '#111111';

function powerIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, lw: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - r - lw * 0.3);
  ctx.lineTo(x, y - r * 0.05);
  ctx.stroke();
  ctx.restore();
}

function logo(ctx: CanvasRenderingContext2D, cx: number, y: number, size: number, onDark = false) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${size * 1.12}px "Barlow Condensed", Poppins, sans-serif`;
  const sadiaW = ctx.measureText('Sadia').width;
  ctx.font = `900 ${size}px Poppins, sans-serif`;
  const nW = ctx.measureText('N').width;
  const iconW = size * 0.86;
  const total = sadiaW + iconW + nW + size * 0.06;
  let x = cx - total / 2;
  ctx.font = `700 ${size * 1.12}px "Barlow Condensed", Poppins, sans-serif`;
  ctx.fillStyle = RED;
  ctx.fillText('Sadia', x, y);
  x += sadiaW + size * 0.04;
  const c = onDark ? '#fff' : INK;
  powerIcon(ctx, x + iconW / 2, y - size * 0.36, size * 0.33, c, size * 0.13);
  x += iconW;
  ctx.font = `900 ${size}px Poppins, sans-serif`;
  ctx.fillStyle = c;
  ctx.fillText('N', x, y);
  ctx.restore();
}

function headline(ctx: CanvasRenderingContext2D, lines: Array<[string, string]>, cx: number, y: number, size: number) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `italic 900 ${size}px Poppins, sans-serif`;
  lines.forEach(([text, color], i) => {
    ctx.fillStyle = color;
    ctx.fillText(text.toUpperCase(), cx, y + i * size * 0.95);
  });
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

export interface CardData {
  profile: string;
  rhythm: string | null;
  sessionNumber: number;
  reactions?: number;
}

/** Card do participante em PNG (1080×1350) — gerado no aparelho. */
export async function renderCard(d: CardData): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(0, 1350);
  ctx.quadraticCurveTo(560, 1180, 1080, 1230);
  ctx.lineTo(1080, 1350);
  ctx.fill();
  logo(ctx, 540, 140, 84);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = 'italic 800 54px Poppins, sans-serif';
  ctx.fillText('Meu modo ON:', 540, 260);
  headline(ctx, [[d.profile, INK]], 540, 360, 104);
  const lek = await loadImage(IMG.lekPoint);
  ctx.drawImage(lek, 540 - 360, 420, 720, 600);
  ctx.fillStyle = INK;
  ctx.font = '700 40px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.rhythm ? `Ritmo de abertura: ${d.rhythm}` : 'Escolha da galera', 540, 1090);
  ctx.font = '600 34px Poppins, sans-serif';
  const extra = d.reactions ? ` · ${d.reactions} reações da galera` : '';
  ctx.fillText(`Lek Trek LIVE · Sessão ${d.sessionNumber}${extra}`, 540, 1146);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 900 44px Poppins, sans-serif';
  ctx.fillText('ATIVE SEU MODO ON', 540, 1300);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface ClipInput extends CardData {
  /** Vídeo real gravado pelo participante (fica no aparelho). */
  personalVideo?: Blob | null;
  /** Registro simulado com renders (modo demonstração). */
  simulatedPov?: boolean;
  collective?: boolean;
  onProgress?: (p: number) => void;
}

export const clipSupported = () => !!pickMime() && typeof HTMLCanvasElement.prototype.captureStream === 'function';

/**
 * Monta um clipe vertical de demonstração (≈7 s) no próprio aparelho, em tempo real.
 * Estrutura inspirada no roteiro de edição: abertura → sessão → POV/registro → drop → assinatura.
 */
export async function composeClip(input: ClipInput): Promise<{ blob: Blob; url: string; ext: string }> {
  const mime = pickMime();
  if (!mime || !clipSupported()) throw new Error('clip_unsupported');
  await document.fonts?.ready;
  const [pista, pov, selfie, drop, lekUp] = await Promise.all([
    loadImage(IMG.pista),
    loadImage(IMG.pov),
    loadImage(IMG.selfie),
    loadImage(IMG.drop),
    loadImage(IMG.lekUp),
  ]);
  const W = 540;
  const H = 960;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  let video: HTMLVideoElement | null = null;
  let videoUrl: string | null = null;
  if (input.personalVideo && !input.collective) {
    videoUrl = URL.createObjectURL(input.personalVideo);
    video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve) => {
      video!.onloadeddata = () => resolve();
      video!.onerror = () => resolve();
      window.setTimeout(resolve, 2500);
    });
  }

  const total = 7000;
  const personal = !input.collective && (video || input.simulatedPov);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const kenBurns = (img: HTMLImageElement, t: number, focusX = 0.5) => {
    const s = 1.05 + t * 0.08;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.translate(-W / 2 + (0.5 - focusX) * 140, -H / 2);
    drawCover(ctx, img, img.width, img.height, W, H);
    ctx.restore();
  };
  const scrim = () => {
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  const frame = (ms: number) => {
    const t = ms / total;
    ctx.textAlign = 'center';
    if (ms < 1500) {
      ctx.fillStyle = YELLOW;
      ctx.fillRect(0, 0, W, H);
      logo(ctx, W / 2, 120, 56);
      ctx.fillStyle = INK;
      ctx.font = 'italic 800 30px Poppins, sans-serif';
      ctx.fillText(personal ? 'Meu modo ON no Lolla' : 'O ON da nossa galera', W / 2, 200);
      headline(ctx, [[input.profile, INK]], W / 2, 270, 54);
      const k = Math.min(1, ms / 500);
      ctx.drawImage(lekUp, W / 2 - 250, H - 440 * k + 0, 500, 446);
    } else if (ms < 3000) {
      kenBurns(pista, (ms - 1500) / 1500, 0.4);
      scrim();
      ctx.fillStyle = YELLOW;
      ctx.font = '800 26px Poppins, sans-serif';
      ctx.fillText(`SESSÃO ${input.sessionNumber} · A GALERA ESCOLHEU`, W / 2, H - 190);
      headline(ctx, [[input.rhythm ?? 'Lek Trek LIVE', '#fff']], W / 2, H - 120, 58);
    } else if (ms < 5200) {
      const lt = (ms - 3000) / 2200;
      if (video && video.readyState >= 2) {
        drawCover(ctx, video, video.videoWidth, video.videoHeight, W, H);
      } else if (personal) {
        kenBurns(lt < 0.5 ? pov : selfie, lt, 0.6);
      } else {
        kenBurns(pov, lt, 0.6);
      }
      scrim();
      ctx.fillStyle = '#fff';
      ctx.font = 'italic 900 40px Poppins, sans-serif';
      ctx.fillText(personal ? (video ? 'MEU PONTO DE VISTA' : 'POV · DEMONSTRAÇÃO') : 'A PISTA RESPONDE JUNTO', W / 2, H - 110);
      ctx.font = '48px sans-serif';
      ['❤️', '🔥', '👏', '⚡'].forEach((e, i) => {
        const y = H - 260 - ((ms / 6 + i * 90) % 380);
        ctx.globalAlpha = 0.9;
        ctx.fillText(e, i % 2 ? W - 60 : 60, y);
      });
      ctx.globalAlpha = 1;
    } else if (ms < 6200) {
      kenBurns(drop, (ms - 5200) / 1000, 0.7);
      ctx.fillStyle = `rgba(255,210,0,${Math.min(0.85, (ms - 5200) / 600)})`;
      ctx.fillRect(0, 0, W, H);
      headline(ctx, [
        ['Modo ON', INK],
        ['Ativado', RED],
      ], W / 2, H / 2 - 20, 84);
    } else {
      ctx.fillStyle = YELLOW;
      ctx.fillRect(0, 0, W, H);
      logo(ctx, W / 2, H / 2 - 40, 84);
      ctx.fillStyle = INK;
      ctx.font = 'italic 900 34px Poppins, sans-serif';
      ctx.fillText('ATIVE SEU MODO ON', W / 2, H / 2 + 50);
      ctx.font = '600 22px Poppins, sans-serif';
      ctx.fillText('Clipe de demonstração · protótipo', W / 2, H - 60);
    }
    input.onProgress?.(Math.min(1, t));
  };

  frame(0);
  rec.start(250);
  if (video) {
    video.currentTime = 0;
    window.setTimeout(() => video?.play().catch(() => undefined), 3000);
  }
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const ms = performance.now() - start;
      if (ms >= total) return resolve();
      frame(ms);
      window.setTimeout(tick, 1000 / 30);
    };
    tick();
  });
  const blob = await new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    rec.stop();
  });
  stream.getTracks().forEach((tr) => tr.stop());
  video?.pause();
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  if (!blob.size) throw new Error('clip_empty');
  return { blob, url: URL.createObjectURL(blob), ext: extFor(mime) };
}
