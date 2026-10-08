export type Quality = 'low' | 'balanced' | 'high';

export interface Settings {
  renderer: 'webgl' | 'webgpu';
  quality: Quality;
  sound: boolean;
}

const KEY = 'sweeperia.settings.v1';
const DEFAULTS: Settings = { renderer: 'webgl', quality: 'high', sound: true };

export function loadSettings(): Settings {
  const s: Settings = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch {
    /* storage unavailable */
  }
  const q = new URLSearchParams(location.search);
  const r = q.get('renderer');
  if (r === 'webgpu' || r === 'webgl') s.renderer = r;
  const ql = q.get('quality');
  if (ql === 'low' || ql === 'balanced' || ql === 'high') s.quality = ql;
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadBest(id: string): number | null {
  try {
    const v = localStorage.getItem(`sweeperia.best.${id}`);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function saveBest(id: string, ms: number): boolean {
  const prev = loadBest(id);
  if (prev !== null && prev <= ms) return false;
  try {
    localStorage.setItem(`sweeperia.best.${id}`, String(Math.round(ms)));
  } catch {
    /* ignore */
  }
  return true;
}
