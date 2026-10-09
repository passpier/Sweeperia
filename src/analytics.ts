interface GoatCounter {
  count(vars: { path: string; title?: string; event?: boolean }): void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

const queue: Array<{ path: string; title?: string }> = [];
let timer = 0;
let tries = 0;

function flush(): void {
  timer = 0;
  const gc = window.goatcounter;
  if (gc && typeof gc.count === 'function') {
    for (const e of queue.splice(0)) gc.count({ ...e, event: true });
    return;
  }
  // count.js is async and may be slow or blocked; give up after ~10s.
  if (++tries < 20) timer = window.setTimeout(flush, 500);
  else queue.length = 0;
}

/** Fire-and-forget custom event. No-ops when GoatCounter is blocked or not loaded. */
export function track(path: string, title?: string): void {
  queue.push({ path, title });
  if (!timer) timer = window.setTimeout(flush, 0);
}

const seenErrors = new Set<string>();

function trackError(msg: string, detail?: string): void {
  const key = msg.slice(0, 80);
  if (seenErrors.has(key) || seenErrors.size >= 10) return;
  seenErrors.add(key);
  track(`error/${key}`, detail?.slice(0, 200));
}

export function installErrorTracking(): void {
  window.addEventListener('error', (e) => trackError(e.message || 'error', `${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    trackError(r?.message ?? String(e.reason), r?.stack);
  });
}

export { trackError };
