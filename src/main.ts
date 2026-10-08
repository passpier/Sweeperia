import { Sfx } from './audio/Sfx';
import { Game, DIFFICULTIES, type Difficulty } from './Game';
import { Input } from './Input';
import { AdaptiveQuality } from './perf/AdaptiveQuality';
import { FrameStats } from './perf/FrameStats';
import { createRenderer } from './render/createRenderer';
import { GameView } from './render/GameView';
import { loadSettings, saveBest, saveSettings, type Quality, type Settings } from './settings';
import { ABILITIES } from './empire/Ages';
import { HUD } from './ui/HUD';

const DPR_CAP: Record<Quality, number> = { low: 1, balanced: 1.5, high: 2 };

async function boot(): Promise<void> {
  const settings = loadSettings();
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const info = await createRenderer(canvas, settings.renderer, settings.quality);
  const { renderer } = info;
  const view = new GameView(renderer.domElement);
  const stats = new FrameStats();
  const sfx = new Sfx();
  sfx.enabled = settings.sound;
  view.world.setShadows(settings.quality !== 'low');

  const startDiff = DIFFICULTIES.find((d) => d.id === new URLSearchParams(location.search).get('diff')) ?? DIFFICULTIES[3];
  const game = new Game(startDiff);
  const continuous = new URLSearchParams(location.search).has('continuous');

  let pixelScale = 1;
  const applyPixelRatio = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP[settings.quality]) * pixelScale);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    view.rig.resize(window.innerWidth, window.innerHeight);
    view.requestFrame(3);
  };
  const adaptive = new AdaptiveQuality(settings.quality === 'low' ? 0.5 : 0.65, (s) => {
    pixelScale = s;
    applyPixelRatio();
  });
  window.addEventListener('resize', applyPixelRatio);

  const hud = new HUD(
    game,
    {
      newGame: (id) => newGame(DIFFICULTIES.find((d) => d.id === id)!),
      restart: () => newGame(game.diff),
      openMenu: () => hud.toggleMenu(true),
      settingsChanged: (s: Settings) => {
        const reload = s.renderer !== settings.renderer || s.quality !== settings.quality;
        Object.assign(settings, s);
        saveSettings(s);
        sfx.enabled = s.sound;
        if (reload) location.reload();
      },
    },
    settings,
    () => info.note ?? (info.backend === 'webgpu' ? '渲染器：WebGPU' : '渲染器：WebGL'),
  );

  function wire(g: Game): void {
    const ev = g.events;
    ev.revealed = (c, d, n) => {
      view.onRevealed(c, d, n);
      sfx.reveal(n);
    };
    ev.flagChanged = (i, f) => {
      view.onFlag(i, f);
      sfx.flag();
    };
    ev.exploded = (i) => {
      view.onExploded(i);
      sfx.explode();
    };
    ev.shielded = (i) => {
      view.onShielded(i);
      sfx.shield();
    };
    ev.ended = (won) => {
      if (won) {
        saveBest(g.diff.id, g.elapsedMs);
        view.onWon();
        sfx.win();
      }
      hud.showEnd(won);
    };
    ev.ageChanged = (a) => {
      view.applyAge(a);
      sfx.age();
    };
    ev.highlight = (cells, ms) => {
      view.onHighlight(cells, ms);
      sfx.ability();
    };
    ev.toast = (m) => hud.toast(m);
    ev.hud = () => {
      hud.refresh();
      view.updateHover();
    };
  }

  function newGame(diff: Difficulty): void {
    game.reset(diff);
    wire(game);
    view.load(game);
    hud.setGame(game);
    hud.toggleMenu(false);
    hud.hideEnd();
    view.requestFrame(4);
  }

  wire(game);
  view.load(game);
  applyPixelRatio();
  hud.toggleMenu(true);

  new Input(renderer.domElement, () => view.rig, {
    cellAt: (x, y) => view.picker.cellAt(x, y),
    reveal: (c) => game.reveal(c),
    flag: (c) => game.flag(c),
    chord: (c) => game.chord(c),
    hover: (c) => view.setHover(c),
    gesture: () => {
      if (hud.menuOpen) return;
    },
    key: (k) => {
      if (k === 'escape') hud.toggleMenu();
      else if (hud.menuOpen) return;
      else if (k === 'r') newGame(game.diff);
      else if (k === 'f3') stats.toggle();
      else if (k === 'q') view.rig.rotate(-1);
      else if (k === 'e') view.rig.rotate(1);
      else if (k === 'g') game.advance();
      else if (k >= '1' && k <= '4') game.useAbility(ABILITIES[Number(k) - 1].id);
    },
  });
  // f3 should work even with the menu open
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      stats.toggle();
    }
  });

  setInterval(() => hud.tick(), 100);

  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const t = performance.now();
    const dtMs = t - last;
    last = t;
    const dt = Math.min(dtMs / 1000, 0.1);
    const need = view.update(dt, renderer) || continuous || stats.shown;
    if (need) {
      renderer.render(view.world.scene, view.rig.camera);
      adaptive.sample(dtMs, stats.vsyncMs);
    }
    stats.extra = `${info.backend}  dpr×${pixelScale.toFixed(2)}  draws ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`;
    stats.frame(dtMs, need);
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sw = { game, view, renderer, stats, newGame };
  if (info.note) hud.toast(info.note);
}

void boot();
