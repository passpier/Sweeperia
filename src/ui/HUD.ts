import './hud.css';
import { ABILITIES, AGES, MAX_AGE, RES, type Cost } from '../empire/Ages';
import { DIFFICULTIES, type Game } from '../Game';
import { loadBest, type Settings } from '../settings';
import { ABILITY_EMBLEMS, AGE_EMBLEMS, LAUREL, RESTART_ICON } from './emblems';

const ICON = { food: '🌾', wood: '🪵', stone: '🪨', gold: '🪙' } as const;
const NAME = { food: '食物', wood: '木材', stone: '石材', gold: '黃金' } as const;

function el<T extends HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export interface HudActions {
  newGame(diffId: string): void;
  restart(): void;
  settingsChanged(s: Settings): void;
  openMenu(): void;
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : String(s).padStart(3, '0');
}

export class HUD {
  private readonly root = document.getElementById('ui')!;
  private readonly resBox = el('<div class="panel res"></div>');
  private readonly timeEl = el('<b>000</b>');
  private readonly minesEl = el('<b>0</b>');
  private readonly face = el<HTMLButtonElement>(`<button class="face" title="重新開始 (R)" aria-label="重新開始">${RESTART_ICON}</button>`);
  private readonly ageEl = el('<div class="panel age"></div>');
  private readonly bottom = el('<div class="bottom"></div>');
  private readonly tip = el('<div class="panel tip"></div>');
  private suppressClick = false;
  private readonly toastEl = el('<div class="panel toast"></div>');
  private readonly menu = el('<div class="overlay"></div>');
  private readonly endBox = el('<div class="overlay"></div>');
  private readonly resEls = {} as Record<string, HTMLElement>;
  private readonly advBtn = el<HTMLButtonElement>('<button class="btn panel act"></button>');
  private readonly actBtns: HTMLButtonElement[] = [];
  private toastTimer = 0;
  private lastKey = '';

  constructor(private game: Game, private readonly actions: HudActions, private settings: Settings, private backendNote: () => string) {
    const top = el('<div class="top"></div>');
    for (const r of RES) {
      const s = el(`<span title="${NAME[r]}">${ICON[r]} <i>0</i></span>`);
      this.resEls[r] = s.querySelector('i')!;
      this.resBox.appendChild(s);
    }
    const center = el('<div class="panel center"></div>');
    center.append(el('<span class="ico">💣</span>'), this.minesEl, this.face, this.timeEl, el('<span class="ico">⏱</span>'));
    const menuBtn = el<HTMLButtonElement>('<button class="btn" title="選單 (Esc)">☰</button>');
    menuBtn.onclick = () => actions.openMenu();
    const right = el('<div class="right"></div>');
    right.append(this.ageEl, menuBtn);
    top.append(this.resBox, center, right);

    this.advBtn.onclick = () => this.guard(this.advBtn, () => this.game.advance());
    this.attachTip(this.advBtn, () => this.advTip());
    this.bottom.appendChild(this.advBtn);
    ABILITIES.forEach((a, i) => {
      const b = el<HTMLButtonElement>(`<button class="btn panel act"><span class="emb">${ABILITY_EMBLEMS[a.id]}</span><span class="key">${i + 1}</span><b class="nm">${a.name}</b><em class="sh">${a.short}</em><small></small><div class="cd"></div></button>`);
      b.onclick = () => this.guard(b, () => this.game.useAbility(a.id));
      this.attachTip(b, () => this.abilityTip(i));
      this.actBtns.push(b);
      this.bottom.appendChild(b);
    });
    this.face.onclick = () => actions.restart();
    this.root.append(top, this.bottom, this.tip, this.toastEl, this.menu, this.endBox);
    this.buildMenu();
    this.refresh();
  }

  setGame(g: Game): void {
    this.game = g;
    this.endBox.classList.remove('show');
    this.lastKey = '';
    this.refresh();
    this.buildMenu();
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }

  private costHtml(c: Cost): string {
    const e = this.game.economy;
    return RES.filter((r) => c[r]).map((r) => `<span class="cost ${e[r] >= c[r]! ? '' : 'no'}">${ICON[r]}${c[r]}</span>`).join(' ');
  }

  /** Disabled look without `disabled`, so hover/long-press tooltips still work on locked buttons. */
  private setOff(b: HTMLButtonElement, off: boolean): void {
    if (b.classList.contains('off') !== off) {
      b.classList.toggle('off', off);
      b.setAttribute('aria-disabled', String(off));
    }
  }

  private guard(b: HTMLButtonElement, fn: () => void): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (!b.classList.contains('off')) fn();
  }

  private abilityTip(i: number): string {
    const a = ABILITIES[i];
    const locked = this.game.age < a.minAge;
    return `<h4>${a.name}${locked ? ` · 🔒 ${AGES[a.minAge].name}解鎖` : ''}</h4><p>${a.desc}</p><p class="m">費用 ${this.costHtml(a.cost)} · 冷卻 ${a.cooldownMs / 1000} 秒${a.targeted ? ' · 需點選目標格' : ''} · 快捷鍵 ${i + 1}</p>`;
  }

  private advTip(): string {
    const next = this.game.nextAge;
    if (!next) return `<h4>${AGES[MAX_AGE].name}</h4><p>已達最高時代</p>`;
    const unlocks = ABILITIES.filter((a) => a.minAge === next.id).map((a) => a.name);
    return `<h4>升級至 ${next.name}</h4><p>${unlocks.length ? `解鎖技能：${unlocks.join('、')}` : '地貌與天色改變，開啟新時代'}</p><p class="m">費用 ${this.costHtml(next.cost)} · 快捷鍵 G</p>`;
  }

  /** Hover tooltip on mouse; ~0.4s long-press on touch (the release then does not trigger the button). */
  private attachTip(b: HTMLButtonElement, html: () => string): void {
    const show = () => {
      this.tip.innerHTML = html();
      this.tip.classList.add('show');
      const r = b.getBoundingClientRect();
      const w = this.tip.offsetWidth;
      this.tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      this.tip.style.bottom = `${window.innerHeight - r.top + 8}px`;
    };
    const hide = () => this.tip.classList.remove('show');
    let timer = 0;
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show());
    b.addEventListener('pointerleave', () => {
      clearTimeout(timer);
      hide();
    });
    b.addEventListener('pointerdown', (e) => {
      this.suppressClick = false;
      if (e.pointerType === 'mouse') return;
      timer = window.setTimeout(() => {
        this.suppressClick = true;
        show();
      }, 400);
    });
    const end = () => {
      clearTimeout(timer);
      if (this.suppressClick) setTimeout(hide, 1800);
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', () => {
      clearTimeout(timer);
      this.suppressClick = false;
      hide();
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** State-driven refresh. Cheap: only touches the DOM when the rendered key changes. */
  refresh(): void {
    const g = this.game;
    const e = g.economy;
    const empire = g.empire;
    this.resBox.style.display = empire ? '' : 'none';
    this.ageEl.style.display = empire ? '' : 'none';
    this.bottom.style.display = empire ? '' : 'none';
    this.minesEl.textContent = String(g.minesLeft);
    this.face.dataset.state = g.board.status;
    if (!empire) return;
    for (const r of RES) this.resEls[r].textContent = String(e[r]);
    this.ageEl.textContent = `${AGES[g.age].name}${g.shield ? `  🛡${g.shield}` : ''}`;
    const next = g.nextAge;
    const key = `${g.age}|${g.shield}|${e.food}|${e.wood}|${e.stone}|${e.gold}|${g.targeting?.id}|${g.over}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (next) {
      this.advBtn.innerHTML = `<span class="emb">${AGE_EMBLEMS[next.id]}</span><span class="key">G</span><b class="nm">${next.name}</b><em class="sh">升級時代</em><small>${this.costHtml(next.cost)}</small><div class="cd"></div>`;
      this.advBtn.style.setProperty('--accent', next.accent);
      this.setOff(this.advBtn, !g.canAdvance());
    } else {
      this.advBtn.innerHTML = `<span class="emb">${AGE_EMBLEMS[MAX_AGE]}</span><b class="nm">${AGES[MAX_AGE].name}</b><em class="sh">已達最高時代</em><small></small>`;
      this.advBtn.style.setProperty('--accent', AGES[MAX_AGE].accent);
      this.setOff(this.advBtn, true);
    }
    ABILITIES.forEach((a, i) => {
      const b = this.actBtns[i];
      const locked = g.age < a.minAge;
      b.querySelector('small')!.innerHTML = locked ? `🔒 ${AGES[a.minAge].name}` : this.costHtml(a.cost);
      this.setOff(b, locked || !e.canAfford(a.cost) || g.over);
      b.classList.toggle('locked', locked);
      b.classList.toggle('active', g.targeting === a);
    });
  }

  /** Timers and cooldown bars; called ~10x/s. */
  tick(): void {
    const g = this.game;
    this.timeEl.textContent = fmtTime(g.elapsedMs);
    if (!g.empire) return;
    const now = performance.now();
    ABILITIES.forEach((a, i) => {
      const left = (g.cooldownUntil[a.id] ?? 0) - now;
      const bar = this.actBtns[i].querySelector<HTMLElement>('.cd')!;
      bar.style.width = left > 0 ? `${Math.min(100, (left / a.cooldownMs) * 100)}%` : '0';
      const b = this.actBtns[i];
      const dis = g.age < a.minAge || left > 0 || !g.economy.canAfford(a.cost) || g.over;
      this.setOff(b, dis);
    });
  }

  showEnd(won: boolean): void {
    const g = this.game;
    const best = loadBest(g.diff.id);
    const t = g.elapsedMs;
    const empire = g.empire;
    this.endBox.innerHTML = '';
    const box = el(`<div class="panel dialog end"><h1>${won ? 'VICTORIA' : 'CLADES'}</h1><p class="sub">${won ? '勝利！' : '失敗'}</p>
      <p>${g.diff.label} · 用時 ${(t / 1000).toFixed(1)} 秒${won && best !== null ? ` · 最佳 ${(best / 1000).toFixed(1)} 秒` : ''}</p>
      ${empire ? `<p>${AGES[g.age].name} · 資源 ${g.economy.total}${won ? ` · 分數 ${this.score()}` : ''}</p>` : ''}
      <div class="grid"><button class="btn" data-a="again">再來一局</button><button class="btn" data-a="menu">選單</button></div></div>`);
    box.querySelector('[data-a=again]')!.addEventListener('click', () => this.actions.restart());
    box.querySelector('[data-a=menu]')!.addEventListener('click', () => this.actions.openMenu());
    this.endBox.appendChild(box);
    setTimeout(() => this.endBox.classList.add('show'), won ? 1200 : 1500);
  }

  private score(): number {
    const g = this.game;
    return Math.max(0, Math.round(10000 / (1 + g.elapsedMs / 60000) + g.economy.total + g.age * 500));
  }

  hideEnd(): void {
    this.endBox.classList.remove('show');
  }

  get menuOpen(): boolean {
    return this.menu.classList.contains('show');
  }

  toggleMenu(open = !this.menuOpen): void {
    this.menu.classList.toggle('show', open);
  }

  private buildMenu(): void {
    const s = this.settings;
    this.menu.innerHTML = '';
    const d = el(`<div class="panel dialog"><div class="laurel">${LAUREL}</div><h1>SWEEPERIA</h1><p>帝國掃雷 — 從石器時代揭開世界</p>
      <div class="grid" id="diffs"></div>
      <div class="row">畫質<select id="s-quality"><option value="high">高</option><option value="balanced">中</option><option value="low">低（最快）</option></select></div>
      <div class="row">音效<select id="s-sound"><option value="1">開</option><option value="0">關</option></select></div>
      <div class="row"><span id="s-note" style="color:var(--muted);font-size:12px"></span><button class="btn" id="close">繼續</button></div>
      <div class="help">左鍵 揭開 ／ 右鍵 插旗 ／ 點數字 或 中鍵 快速開格<br>
      拖曳 或 <kbd>WASD</kbd> 移動 · 滾輪 縮放 · <kbd>Q</kbd><kbd>E</kbd> 旋轉 · <kbd>R</kbd> 重開 · <kbd>F3</kbd> 效能<br>
      手機：點按揭開、長按插旗、雙指縮放。帝國模式：<kbd>1</kbd>–<kbd>4</kbd> 技能、<kbd>G</kbd> 升級時代</div></div>`);
    const grid = d.querySelector('#diffs')!;
    for (const df of DIFFICULTIES) {
      const best = loadBest(df.id);
      const b = el<HTMLButtonElement>(`<button class="btn ${df.id === this.game.diff.id ? 'sel' : ''}">${df.label}<small>${df.mode === 'empire' ? '資源 · 時代 · 技能' : '經典規則'}${best !== null ? ` · 🏆${(best / 1000).toFixed(1)}s` : ''}</small></button>`);
      b.onclick = () => {
        this.actions.newGame(df.id);
        this.toggleMenu(false);
      };
      grid.appendChild(b);
    }
    const sel = (id: string) => d.querySelector<HTMLSelectElement>(id)!;
    sel('#s-quality').value = s.quality;
    sel('#s-sound').value = s.sound ? '1' : '0';
    d.querySelector<HTMLElement>('#s-note')!.textContent = this.backendNote();
    const change = () => {
      this.settings = { quality: sel('#s-quality').value as Settings['quality'], sound: sel('#s-sound').value === '1' };
      this.actions.settingsChanged(this.settings);
    };
    for (const id of ['#s-quality', '#s-sound']) sel(id).onchange = change;
    d.querySelector<HTMLElement>('#close')!.onclick = () => this.toggleMenu(false);
    this.menu.appendChild(d);
  }
}
