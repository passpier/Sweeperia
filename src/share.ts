export interface ShareCard {
  title: string;
  line: string;
}

/** Copy the (already rendered) game canvas into a PNG with a caption banner. Must run right after a render. */
export function captureBoard(canvas: HTMLCanvasElement, card: ShareCard): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const sw = canvas.width;
      const sh = canvas.height;
      if (!sw || !sh) return resolve(null);
      const scale = Math.min(1, 1200 / sw);
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);
      const banner = Math.round(Math.max(64, w * 0.09));
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h + banner;
      const g = out.getContext('2d')!;
      g.drawImage(canvas, 0, 0, w, h);
      g.fillStyle = '#1b1710';
      g.fillRect(0, h, w, banner);
      g.fillStyle = '#8a6a2f';
      g.fillRect(0, h, w, 2);
      g.textBaseline = 'middle';
      g.fillStyle = '#e9c46a';
      g.font = `700 ${Math.round(banner * 0.4)}px Cinzel, "Noto Serif TC", serif`;
      g.fillText(card.title, banner * 0.35, h + banner * 0.33);
      g.fillStyle = '#f3e9d2';
      g.font = `500 ${Math.round(banner * 0.27)}px "Noto Serif TC", Cinzel, serif`;
      g.fillText(card.line, banner * 0.35, h + banner * 0.72);
      out.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

export type ShareMethod = 'file' | 'text' | 'copy' | 'cancel';

export function canShareNatively(): boolean {
  return typeof navigator.share === 'function';
}

/** Share via the system sheet (with the image when supported), else copy text+link. */
export async function shareResult(opts: { text: string; url: string; blob: Blob | null }): Promise<ShareMethod> {
  const { text, url, blob } = opts;
  if (canShareNatively()) {
    try {
      if (blob) {
        const file = new File([blob], 'sweeperia.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: `${text} ${url}` });
          return 'file';
        }
      }
      await navigator.share({ text, url });
      return 'text';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancel';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copy';
  } catch {
    return 'cancel';
  }
}
