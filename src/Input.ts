import type { CameraRig } from './render/CameraRig';

export interface InputHandlers {
  cellAt(x: number, y: number): number;
  reveal(cell: number): void;
  flag(cell: number): void;
  chord(cell: number): void;
  hover(cell: number): void;
  key(k: string): void;
  gesture(): void;
}

const DRAG_PX = 6;
const LONG_PRESS_MS = 380;

export class Input {
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private down: { id: number; x: number; y: number; lx: number; ly: number; button: number; dragged: boolean; longFired: boolean } | null = null;
  private longTimer = 0;
  private pinchDist = 0;
  private pinching = false;

  constructor(private readonly canvas: HTMLCanvasElement, private rig: () => CameraRig, private readonly h: InputHandlers) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', () => h.hover(-1));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari starts text selection / magnifier on long-press; pointer events still fire after this.
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('selectstart', (e) => e.preventDefault());
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.rig().keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.rig().keys.clear());
  }

  private onDown = (e: PointerEvent): void => {
    this.h.gesture();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      this.pinching = true;
      this.cancelLong();
      this.pinchDist = this.currentPinch();
      return;
    }
    if (this.pointers.size > 2) return;
    this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, button: e.button, dragged: false, longFired: false };
    if (e.pointerType === 'touch') {
      this.longTimer = window.setTimeout(() => {
        const d = this.down;
        if (!d || d.dragged || this.pinching) return;
        d.longFired = true;
        window.getSelection()?.removeAllRanges();
        const cell = this.h.cellAt(d.x, d.y);
        if (cell >= 0) {
          this.h.flag(cell);
          navigator.vibrate?.(15);
        }
      }, LONG_PRESS_MS);
    }
  };

  private currentPinch(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }
    if (this.pinching && this.pointers.size >= 2) {
      const d = this.currentPinch();
      if (this.pinchDist > 0 && d > 0) this.rig().zoom(this.pinchDist / d);
      this.pinchDist = d;
      return;
    }
    const d = this.down;
    if (d && d.id === e.pointerId) {
      if (!d.dragged && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_PX) {
        d.dragged = true;
        this.cancelLong();
      }
      if (d.dragged) {
        this.rig().dragPixels(e.clientX - d.lx, e.clientY - d.ly, this.canvas.clientHeight);
        this.h.hover(-1);
      }
      d.lx = e.clientX;
      d.ly = e.clientY;
    } else if (e.pointerType === 'mouse') {
      this.h.hover(this.h.cellAt(e.clientX, e.clientY));
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.cancelLong();
    if (this.pinching) {
      if (this.pointers.size === 0) this.pinching = false;
      this.down = null;
      return;
    }
    const d = this.down;
    this.down = null;
    if (!d || d.id !== e.pointerId || d.dragged || d.longFired) return;
    const cell = this.h.cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    if (d.button === 0) this.h.reveal(cell);
    else if (d.button === 2) this.h.flag(cell);
    else if (d.button === 1) this.h.chord(cell);
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.cancelLong();
    this.down = null;
    if (this.pointers.size === 0) this.pinching = false;
  };

  private cancelLong(): void {
    if (this.longTimer) clearTimeout(this.longTimer);
    this.longTimer = 0;
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.rig().zoom(Math.exp(dy * 0.0015));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    this.rig().keys.add(k);
    if (!e.repeat) this.h.key(k);
  };
}
