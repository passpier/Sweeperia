import { Sfx } from './audio/Sfx';
import { Game, DIFFICULTIES, type Difficulty } from './Game';
import { Input } from './Input';
import { AdaptiveQuality } from './perf/AdaptiveQuality';
import { FrameStats } from './perf/FrameStats';
import { Post } from './render/Post';
import { gfx, motion } from './render/Materials';
import { createRenderer } from './render/createRenderer';
import { GameView } from './render/GameView';
import { loadSettings, saveBest, saveSettings, type Quality, type Settings } from './settings';
import { ABILITIES } from './empire/Ages';
import { installErrorTracking, track, trackError } from './analytics';
import { detectLang, diffLabel, setLang, t } from './i18n';
import { captureBoard } from './share';
import { HUD } from './ui/HUD';

const DPR_CAP: Record<Quality, number> = { low: 1, balanced: 1.5, high: 2 };

async function boot(): Promise<void> {
  installErrorTracking();
  const settings = loadSettings();
  setLang(settings.lang ?? detectLang());
  track(`lang/${settings.lang ? 'chosen-' : 'auto-'}${settings.lang ?? detectLang()}`);
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const info = await createRenderer(canvas, settings.quality);
  const { renderer } = info;
  track(`renderer/${info.backend}`);
  gfx.detail = settings.quality !== 'low';
  const view = new GameView(renderer.domElement);
  const stats = new FrameStats();
  const sfx = new Sfx();
  sfx.enabled = settings.sound;
  view.world.setShadows(settings.quality !== 'low', settings.quality === 'high' ? 2048 : 1024);
  motion.value = settings.quality === 'low' ? 0 : 1;
  const animated = settings.quality !== 'low';
  const post = settings.quality === 'high' ? new Post(renderer, view.world.scene, view.rig.camera) : null;

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
  const adaptive = new AdaptiveQuality(
    0.5,
    (s) => {
      pixelScale = s;
      applyPixelRatio();
    },
    post ? [{ off: () => (post.on = false), on: () => (post.on = true) }] : [],
  );
  window.addEventListener('resize', applyPixelRatio);

  // The WebGL back buffer is only readable right after a render, so the win screenshot is taken from inside the render loop.
  let winShot: Promise<Blob | null> = Promise.resolve(null);
  let captureNext: ((c: HTMLCanvasElement) => void) | null = null;

  const hud = new HUD(
    game,
    {
      newGame: (id) => newGame(DIFFICULTIES.find((d) => d.id === id)!),
      restart: () => newGame(game.diff),
      openMenu: () => hud.toggleMenu(true),
      winShot: () => winShot,
      settingsChanged: (s: Settings) => {
        const reload = s.quality !== settings.quality || s.lang !== settings.lang;
        Object.assign(settings, s);
        saveSettings(s);
        sfx.enabled = s.sound;
        if (reload) location.reload();
      },
    },
    settings,
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
      track(`${won ? 'win' : 'lose'}/${g.diff.id}`);
      if (won) {
        saveBest(g.diff.id, g.elapsedMs);
        view.onWon();
        sfx.win();
        winShot = new Promise((resolve) => {
          const card = { title: 'SWEEPERIA', line: `${diffLabel(g.diff)} · ${t('end.time', { s: (g.elapsedMs / 1000).toFixed(1) })}` };
          const giveUp = window.setTimeout(() => {
            captureNext = null;
            resolve(null);
          }, 5000);
          window.setTimeout(() => {
            view.requestFrame(3);
            captureNext = (c) => {
              clearTimeout(giveUp);
              void captureBoard(c, card).then(resolve);
            };
          }, 900);
        });
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
    track(`start/${diff.id}`);
    captureNext = null;
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

  try {
    // Don't let a slow/stalled precompile (e.g. a backgrounded tab) block the first frame.
    await Promise.race([renderer.compileAsync(view.world.scene, view.rig.camera), new Promise((r) => setTimeout(r, 1500))]);
  } catch (e) {
    console.warn('shader precompile failed', e);
  }
  setInterval(() => hud.tick(), 100);

  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const t = performance.now();
    const dtMs = t - last;
    last = t;
    const dt = Math.min(dtMs / 1000, 0.1);
    const need = view.update(dt) || continuous || animated || stats.shown;
    if (need) {
      if (post?.on) post.render();
      else renderer.render(view.world.scene, view.rig.camera);
      adaptive.sample(dtMs, stats.vsyncMs);
      if (captureNext) {
        const cb = captureNext;
        captureNext = null;
        cb(renderer.domElement);
      }
    }
    stats.extra = `${info.backend}${post?.on ? '+bloom' : ''}  dpr×${pixelScale.toFixed(2)}  draws ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`;
    stats.frame(dtMs, need);
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sw = { game, view, renderer, stats, newGame };
}

boot().catch((e) => {
  console.error(e);
  trackError(`boot: ${(e as Error)?.message ?? e}`, (e as Error)?.stack);
});
