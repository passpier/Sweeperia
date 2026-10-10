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
import { detectLang, setLang } from './i18n';
import { parseChallenge, type Challenge } from './share';
import { HUD } from './ui/HUD';

const DPR_CAP: Record<Quality, number> = { low: 1, balanced: 1.5, high: 2 };

async function boot(): Promise<void> {
  installErrorTracking();
  const settings = loadSettings();
  const bootEl = document.getElementById('boot');
  const barEl = bootEl?.querySelector<HTMLElement>('i');
  const showBusy = (on: boolean) => {
    if (on) bootEl?.classList.remove('hide');
    else bootEl?.classList.add('hide');
  };
  /** Takes over from the CSS "creep" animation that runs until the bundle is up. */
  const setProgress = (p: number) => {
    if (!barEl) return;
    barEl.style.animation = 'none';
    barEl.style.width = `${Math.round(p * 100)}%`;
  };
  const yieldToPaint = () => new Promise<void>((r) => setTimeout(r, 0));
  setLang(settings.lang ?? detectLang());
  track(`lang/${settings.lang ? 'chosen-' : 'auto-'}${settings.lang ?? detectLang()}`);
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const info = await createRenderer(canvas, settings.quality);
  const { renderer } = info;
  setProgress(0.4);
  track(`renderer/${info.backend}`);
  gfx.detail = settings.quality !== 'low';
  const view = new GameView(renderer.domElement);
  const stats = new FrameStats();
  const sfx = new Sfx();
  sfx.enabled = settings.sound;
  view.world.setShadows(settings.quality !== 'low', settings.quality === 'high' ? 2048 : 1024);
  motion.value = settings.quality === 'low' ? 0 : 1;
  const animated = settings.quality !== 'low';
  // The bloom pass is built after the first frame so it doesn't delay it.
  let post: Post | null = null;

  const challenge = parseChallenge(location.search);
  const startDiff = DIFFICULTIES.find((d) => d.id === (challenge?.diff ?? new URLSearchParams(location.search).get('diff'))) ?? DIFFICULTIES[3];
  const game = new Game(startDiff, challenge?.seed);
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
    settings.quality === 'high'
      ? [{ off: () => post && (post.on = false), on: () => post && (post.on = true) }]
      : [],
  );
  window.addEventListener('resize', applyPixelRatio);

  const hud = new HUD(
    game,
    {
      newGame: (id) => {
        // Picking a difficulty from the menu leaves the shared challenge.
        if (game.challenge) history.replaceState(null, '', location.pathname);
        requestNewGame(DIFFICULTIES.find((d) => d.id === id)!);
      },
      restart: () => requestNewGame(game.diff, game.challenge ?? undefined),
      openMenu: () => hud.toggleMenu(true),
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

  let busyToken = 0;
  /**
   * Closes the dialogs and hides the old board right away (so it never flashes), then builds the new one in
   * stages. The loading layer with a progress bar only appears if that takes longer than 250ms.
   */
  function requestNewGame(diff: Difficulty, ch?: Challenge): void {
    const token = ++busyToken;
    hud.toggleMenu(false);
    hud.hideEnd();
    const canvas = renderer.domElement;
    canvas.style.visibility = 'hidden';
    const timer = window.setTimeout(() => {
      setProgress(0.05);
      showBusy(true);
    }, 250);
    void (async () => {
      await yieldToPaint();
      if (token !== busyToken) return;
      newGame(diff, ch, async (p) => {
        setProgress(p);
        await yieldToPaint();
      });
    })().then(async () => {
      try {
        if (token !== busyToken) return;
        setProgress(0.85);
        await Promise.race([renderer.compileAsync(view.world.scene, view.rig.camera), new Promise((r) => setTimeout(r, 1000))]);
      } catch {
        /* the first render compiles whatever is missing */
      }
      if (token !== busyToken) return;
      // Two frames: the render loop has drawn the new board before it is revealed.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (token !== busyToken) return;
      clearTimeout(timer);
      setProgress(1);
      canvas.style.visibility = '';
      showBusy(false);
    });
  }

  function newGame(diff: Difficulty, ch?: Challenge, step?: (p: number) => Promise<void>): Promise<void> | void {
    const run = async () => {
      track(`start/${diff.id}`);
      game.reset(diff, ch?.seed);
      wire(game);
      await step?.(0.3);
      view.load(game);
      await step?.(0.7);
      game.challenge = ch ?? null;
      hud.setGame(game);
      if (ch) view.showStart(ch.at);
      hud.toggleMenu(false);
      hud.hideEnd();
      view.requestFrame(4);
    };
    return run();
  }

  wire(game);
  view.load(game);
  setProgress(0.7);
  applyPixelRatio();
  if (challenge) {
    track(`challenge/open/${challenge.diff}`);
    game.challenge = challenge;
    hud.setGame(game);
    view.showStart(challenge.at);
  } else {
    hud.toggleMenu(true);
  }

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
      else if (k === 'r') requestNewGame(game.diff, game.challenge ?? undefined);
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
  let firstFrame = true;
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
      if (firstFrame) {
        firstFrame = false;
        showBusy(false);
        // Warm up pipelines and build bloom off the critical path.
        setTimeout(() => {
          if (settings.quality === 'high') post = new Post(renderer, view.world.scene, view.rig.camera);
          renderer.compileAsync(view.world.scene, view.rig.camera).catch((e) => console.warn('shader precompile failed', e));
        }, 0);
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
