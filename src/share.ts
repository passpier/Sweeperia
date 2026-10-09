import { DIFFICULTIES } from './Game';

/** A finished run, encoded in a link so a friend can replay the exact same map. */
export interface Challenge {
  diff: string;
  seed: number;
  /** Opening cell the mines were laid out around. */
  at: number;
  /** Clearing time in ms. */
  t: number;
  score?: number;
}

const INT = /^-?\d{1,10}$/;
const MIN_MS = 1000;
const MAX_MS = 86_400_000;
const MAX_SCORE = 10_000_000;

function int(v: string | null): number | null {
  if (v === null || !INT.test(v)) return null;
  return Number(v);
}

export function buildChallengeUrl(base: string, c: Challenge): string {
  const q = new URLSearchParams({ diff: c.diff, seed: String(c.seed), at: String(c.at), t: String(Math.round(c.t)) });
  if (c.score !== undefined) q.set('score', String(c.score));
  return `${base}?${q}`;
}

/** The query string is attacker-controlled: every field is checked, and any failure rejects the whole challenge. */
export function parseChallenge(search: string): Challenge | null {
  const q = new URLSearchParams(search);
  const diff = DIFFICULTIES.find((d) => d.id === q.get('diff'));
  const seed = int(q.get('seed'));
  const at = int(q.get('at'));
  const t = int(q.get('t'));
  if (!diff || seed === null || at === null || t === null) return null;
  if (seed < -(2 ** 31) || seed > 2 ** 31 - 1) return null;
  if (at < 0 || at >= diff.w * diff.h) return null;
  if (t < MIN_MS || t > MAX_MS) return null;
  const c: Challenge = { diff: diff.id, seed, at, t };
  if (q.has('score')) {
    const score = int(q.get('score'));
    if (score === null || score < 0 || score > MAX_SCORE) return null;
    c.score = score;
  }
  return c;
}

export type ShareMethod = 'text' | 'copy' | 'cancel';

/** The system share sheet is only worth it on phones/tablets; desktop sheets (e.g. macOS) are mostly noise. */
export function canShareNatively(): boolean {
  return typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;
}

export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    return false;
  }
}

/** Share via the system sheet when available, else copy text + link. */
export async function shareResult(opts: { text: string; url: string }): Promise<ShareMethod> {
  const { text, url } = opts;
  if (canShareNatively()) {
    try {
      await navigator.share({ text, url });
      return 'text';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancel';
    }
  }
  return (await copyText(`${text} ${url}`)) ? 'copy' : 'cancel';
}
