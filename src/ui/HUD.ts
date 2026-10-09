import './hud.css';
import { ABILITIES, AGES, MAX_AGE, RES, type Cost } from '../empire/Ages';
import { diffLabel, diffName, getLang, t, type Lang, type StrKey } from '../i18n';
import { shareResult } from '../share';
import { track } from '../analytics';
import { DIFFICULTIES, type Game } from '../Game';
import { loadBest, type Settings } from '../settings';
import { ABILITY_EMBLEMS, AGE_EMBLEMS, LAUREL, RESTART_ICON } from './emblems';

const ICON = { food: '🌾', wood: '🪵', stone: '🪨', gold: '🪙' } as const;
const ageName = (id: number) => t(`age.${id}` as StrKey);
const abName = (id: string) => t(`ab.${id}.name` as StrKey);
const abShort = (id: string) => t(`ab.${id}.short` as StrKey);
const abDesc = (id: string) => t(`ab.${id}.desc` as StrKey);

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
  /** Board screenshot taken when the game was won (null if unavailable). */
  winShot(): Promise<Blob | null>;
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
  private readonly face = el<HTMLButtonElement>(`<button class="face" title="${t('hud.restart')}" aria-label="${t('hud.restartAria')}">${RESTART_ICON}</button>`);
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
  private endTimer = 0;
  private lastKey = '';

  constructor(private game: Game, private readonly actions: HudActions, private settings: Settings) {
    const top = el('<div class="top"></div>');
    for (const r of RES) {
      const s = el(`<span title="${t(`res.${r}` as StrKey)}">${ICON[r]} <i>0</i></span>`);
      this.resEls[r] = s.querySelector('i')!;
      this.resBox.appendChild(s);
    }
    const center = el('<div class="panel center"></div>');
    center.append(el('<span class="ico">💣</span>'), this.minesEl, this.face, this.timeEl, el('<span class="ico">⏱</span>'));
    const menuBtn = el<HTMLButtonElement>(`<button class="btn" title="${t('hud.menu')}">☰</button>`);
    menuBtn.onclick = () => actions.openMenu();
    const right = el('<div class="right"></div>');
    right.append(this.ageEl, menuBtn);
    top.append(this.resBox, center, right);

    this.advBtn.onclick = () => this.guard(this.advBtn, () => this.game.advance());
    this.attachTip(this.advBtn, () => this.advTip());
    this.bottom.appendChild(this.advBtn);
    ABILITIES.forEach((a, i) => {
      const b = el<HTMLButtonElement>(`<button class="btn panel act"><span class="emb">${ABILITY_EMBLEMS[a.id]}</span><span class="key">${i + 1}</span><b class="nm">${abName(a.id)}</b><em class="sh">${abShort(a.id)}</em><small></small><div class="cd"></div></button>`);
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
    return `<h4>${abName(a.id)}${locked ? ` · 🔒 ${t('hud.unlocksAt', { age: ageName(a.minAge) })}` : ''}</h4><p>${abDesc(a.id)}</p><p class="m">${t('hud.cost')} ${this.costHtml(a.cost)} · ${t('hud.cooldown', { s: a.cooldownMs / 1000 })}${a.targeted ? ` · ${t('hud.needTarget')}` : ''} · ${t('hud.hotkey', { k: i + 1 })}</p>`;
  }

  private advTip(): string {
    const next = this.game.nextAge;
    if (!next) return `<h4>${ageName(MAX_AGE)}</h4><p>${t('hud.maxAge')}</p>`;
    const unlocks = ABILITIES.filter((a) => a.minAge === next.id).map((a) => abName(a.id));
    return `<h4>${t('hud.upgradeTo', { name: ageName(next.id) })}</h4><p>${unlocks.length ? t('hud.unlocks', { list: unlocks.join(t('hud.listSep')) }) : t('hud.unlocksNone')}</p><p class="m">${t('hud.cost')} ${this.costHtml(next.cost)} · ${t('hud.hotkey', { k: 'G' })}</p>`;
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
    this.ageEl.textContent = `${ageName(g.age)}${g.shield ? `  🛡${g.shield}` : ''}`;
    const next = g.nextAge;
    const key = `${g.age}|${g.shield}|${e.food}|${e.wood}|${e.stone}|${e.gold}|${g.targeting?.id}|${g.over}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (next) {
      this.advBtn.innerHTML = `<span class="emb">${AGE_EMBLEMS[next.id]}</span><span class="key">G</span><b class="nm">${ageName(next.id)}</b><em class="sh">${t('hud.advance')}</em><small>${this.costHtml(next.cost)}</small><div class="cd"></div>`;
      this.advBtn.style.setProperty('--accent', next.accent);
      this.setOff(this.advBtn, !g.canAdvance());
    } else {
      this.advBtn.innerHTML = `<span class="emb">${AGE_EMBLEMS[MAX_AGE]}</span><b class="nm">${ageName(MAX_AGE)}</b><em class="sh">${t('hud.maxAge')}</em><small></small>`;
      this.advBtn.style.setProperty('--accent', AGES[MAX_AGE].accent);
      this.setOff(this.advBtn, true);
    }
    ABILITIES.forEach((a, i) => {
      const b = this.actBtns[i];
      const locked = g.age < a.minAge;
      b.querySelector('small')!.innerHTML = locked ? `🔒 ${ageName(a.minAge)}` : this.costHtml(a.cost);
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
    const t0 = g.elapsedMs;
    const empire = g.empire;
    const secs = (t0 / 1000).toFixed(1);
    this.endBox.innerHTML = '';
    const box = el(`<div class="panel dialog end"><h1>${won ? 'VICTORIA' : 'CLADES'}</h1><p class="sub">${won ? t('end.win') : t('end.lose')}</p>
      <p>${diffLabel(g.diff)} · ${t('end.time', { s: secs })}${won && best !== null ? ` · ${t('end.best', { s: (best / 1000).toFixed(1) })}` : ''}</p>
      ${empire ? `<p>${ageName(g.age)} · ${t('end.resources', { n: g.economy.total })}${won ? ` · ${t('end.score', { n: this.score() })}` : ''}</p>` : ''}
      <div class="grid"><button class="btn" data-a="again">${t('end.again')}</button><button class="btn" data-a="menu">${t('end.menu')}</button>
      ${won ? `<button class="btn wide" data-a="share">🏆 ${t('end.share')}</button>` : ''}</div></div>`);
    box.querySelector('[data-a=again]')!.addEventListener('click', () => this.actions.restart());
    box.querySelector('[data-a=menu]')!.addEventListener('click', () => this.actions.openMenu());
    if (won) {
      const shot = this.actions.winShot();
      const text = t('end.shareText', { diff: diffLabel(g.diff), s: secs, score: empire ? t('end.shareScore', { n: this.score() }) : '' });
      const url = `${location.origin}${location.pathname}?diff=${g.diff.id}`;
      box.querySelector('[data-a=share]')!.addEventListener('click', async () => {
        const blob = await shot;
        const method = await shareResult({ text, url, blob });
        if (method === 'cancel') return;
        track(`share/${method}`);
        if (method === 'copy') {
          this.toast(t('toast.copied'));
          if (blob) this.offerDownload(box, blob);
        }
      });
    }
    this.endBox.appendChild(box);
    clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(() => this.endBox.classList.add('show'), won ? 1200 : 1500);
  }

  /** Browsers without a share sheet (e.g. desktop Firefox): let the player save the image to post manually. */
  private offerDownload(box: HTMLElement, blob: Blob): void {
    if (box.querySelector('[data-a=download]')) return;
    const a = document.createElement('a');
    a.className = 'btn wide';
    a.dataset.a = 'download';
    a.textContent = `⬇ ${t('end.download')}`;
    a.href = URL.createObjectURL(blob);
    a.download = 'sweeperia.png';
    box.querySelector('.grid')!.appendChild(a);
  }

  private score(): number {
    const g = this.game;
    return Math.max(0, Math.round(10000 / (1 + g.elapsedMs / 60000) + g.economy.total + g.age * 500));
  }

  hideEnd(): void {
    clearTimeout(this.endTimer);
    this.endBox.classList.remove('show');
  }

  get menuOpen(): boolean {
    return this.menu.classList.contains('show');
  }

  toggleMenu(open = !this.menuOpen): void {
    this.menu.classList.toggle('show', open);
    if (open) this.hideEnd();
    else if (this.game.over) this.endBox.classList.add('show');
  }

  private buildMenu(): void {
    const s = this.settings;
    this.menu.innerHTML = '';
    const d = el(`<div class="panel dialog"><div class="laurel">${LAUREL}</div><h1>SWEEPERIA</h1><p>${t('menu.tagline')}</p>
      <div class="grid" id="diffs"></div>
      <div class="row">${t('menu.quality')}<select id="s-quality"><option value="high">${t('menu.q.high')}</option><option value="balanced">${t('menu.q.balanced')}</option><option value="low">${t('menu.q.low')}</option></select></div>
      <div class="row">${t('menu.sound')}<select id="s-sound"><option value="1">${t('menu.on')}</option><option value="0">${t('menu.off')}</option></select></div>
      <div class="row">${t('menu.lang')}<select id="s-lang"><option value="zh">中文</option><option value="en">English</option></select></div>
      <div class="row"><span></span><button class="btn" id="close">${t('menu.close')}</button></div>
      <div class="help">${t('menu.help1')}<br>
      ${t('menu.help2')}<br>
      ${t('menu.help3')}<br>
      <a href="https://github.com/passpier/Sweeperia" target="_blank" rel="noopener">GitHub · passpier/Sweeperia</a></div></div>`);
    const grid = d.querySelector('#diffs')!;
    for (const df of DIFFICULTIES) {
      const best = loadBest(df.id);
      const b = el<HTMLButtonElement>(`<button class="btn ${df.id === this.game.diff.id ? 'sel' : ''}"><b>${diffName(df)}</b> <span class="sz">${df.w}×${df.h}</span><small>${df.mode === 'empire' ? t('menu.modeEmpire') : t('menu.modeClassic')}${best !== null ? ` · 🏆${(best / 1000).toFixed(1)}s` : ''}</small></button>`);
      b.onclick = () => {
        this.actions.newGame(df.id);
        this.toggleMenu(false);
      };
      grid.appendChild(b);
    }
    const sel = (id: string) => d.querySelector<HTMLSelectElement>(id)!;
    sel('#s-quality').value = s.quality;
    sel('#s-sound').value = s.sound ? '1' : '0';
    sel('#s-lang').value = getLang();
    const change = () => {
      this.settings = { quality: sel('#s-quality').value as Settings['quality'], sound: sel('#s-sound').value === '1', lang: sel('#s-lang').value as Lang };
      this.actions.settingsChanged(this.settings);
    };
    for (const id of ['#s-quality', '#s-sound', '#s-lang']) sel(id).onchange = change;
    d.querySelector<HTMLElement>('#close')!.onclick = () => this.toggleMenu(false);
    this.menu.appendChild(d);
  }
}
