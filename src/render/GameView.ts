import * as THREE from 'three';
import { FLAGGED, REVEALED } from '../core/Board';
import { Terrain } from '../core/Terrain';
import type { Game } from '../Game';
import { hash01 } from './ease';
import { AGES } from '../empire/Ages';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { NumberLayer } from './NumberLayer';
import { Picker } from './Picker';
import { Models } from './PropFactory';
import { PropLayer } from './PropLayer';
import { propMaterial, smokeMaterial, tileMaterial } from './Materials';
import { SmokeLayer } from './SmokeLayer';
import { HIDDEN_H, TileLayer } from './TileLayer';
import { WATER_Y, WaterLayer } from './WaterLayer';
import { World } from './World';

const FIRE = [0xff5a1f, 0xffb02e, 0xffe08a, 0x7a2a1a];
const FIREWORK = [0xff4d4d, 0xffd24d, 0x4dffb0, 0x4db8ff, 0xd24dff];

interface Marker {
  cell: number;
  until: number;
}

/** Owns everything drawn on screen for one Game; rebuilt per board via `load()`. */
export class GameView {
  readonly world = new World();
  readonly rig = new CameraRig(10, 10);
  readonly effects = new Effects();
  picker!: Picker;
  game!: Game;

  private tiles!: TileLayer;
  private numbers!: NumberLayer;
  private trees!: PropLayer;
  private oaks!: PropLayer;
  private groves!: PropLayer;
  private tufts!: PropLayer;
  private water!: WaterLayer;
  private smoke!: SmokeLayer;
  private rocks!: PropLayer;
  private golds!: PropLayer;
  private houses!: PropLayer;
  private landmarks!: PropLayer;
  private flags!: PropLayer;
  private mines!: PropLayer;
  private markers!: PropLayer;
  private markerTimers: Marker[] = [];
  private readonly board = new THREE.Group();
  private readonly ground: THREE.Mesh;
  private readonly hover: THREE.Mesh;
  private hoverCell = -1;
  /** Pulsing rings marking the opening cell of a shared challenge. */
  private readonly startRings: THREE.Mesh[] = [];
  private startCell = -1;
  private celebrateUntil = 0;
  private nextFirework = 0;
  private lastYaw = 0;
  /** Frames to keep rendering after the last visible change. */
  private pendingFrames = 3;

  private readonly tileMat = tileMaterial();
  private readonly smokeMat = smokeMaterial();
  private readonly numberMat = NumberLayer.material();
  private readonly propMat = propMaterial(false);
  private readonly swayMat = propMaterial(true);
  private readonly flatMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly geo = {
    pine: Models.pine(),
    oak: Models.oak(),
    grove: Models.grove(),
    tuft: Models.tuft(),
    rock: Models.rock(),
    gold: Models.goldRock(),
    flag: Models.flag(),
    mine: Models.mine(),
    marker: Models.marker(),
    buildings: Models.buildings.map(([a, b]) => [a(), b()] as const),
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.world.scene.add(this.board, this.effects.mesh);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x3b3326 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.ground.receiveShadow = true;
    this.hover = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.06, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }),
    );
    this.hover.visible = false;
    this.hover.renderOrder = 5;
    const ringGeo = new THREE.RingGeometry(0.36, 0.46, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      r.visible = false;
      r.renderOrder = 6;
      this.startRings.push(r);
    }
    this.world.scene.add(this.ground, this.hover, ...this.startRings);
  }

  requestFrame(n = 2): void {
    if (n > this.pendingFrames) this.pendingFrames = n;
  }

  get now(): number {
    return performance.now() / 1000;
  }

  load(game: Game): void {
    this.game = game;
    const b = game.board;
    for (const c of [...this.board.children]) {
      this.board.remove(c);
      if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
      else for (const m of c.children) (m as THREE.InstancedMesh).dispose?.();
    }
    this.tiles?.dispose();
    this.numbers?.dispose();
    this.smoke?.dispose();
    const n = b.size;
    this.tiles = new TileLayer(b, game.terrain, this.tileMat);
    this.numbers = new NumberLayer(n, this.numberMat);
    this.water?.dispose();
    this.water = new WaterLayer(b.width, b.height);
    this.smoke = new SmokeLayer(n, this.smokeMat);
    this.trees = new PropLayer(this.geo.pine, this.swayMat, n, true);
    this.oaks = new PropLayer(this.geo.oak, this.swayMat, n, true);
    this.groves = new PropLayer(this.geo.grove, this.swayMat, n, true);
    this.tufts = new PropLayer(this.geo.tuft, this.swayMat, n, true, false);
    this.rocks = new PropLayer(this.geo.rock, this.propMat, n, true);
    this.golds = new PropLayer(this.geo.gold, this.propMat, n, true);
    this.houses = new PropLayer(this.geo.buildings[0][0], this.propMat, n, true);
    this.landmarks = new PropLayer(this.geo.buildings[0][1], this.propMat, n, true);
    this.flags = new PropLayer(this.geo.flag, this.propMat, n);
    this.mines = new PropLayer(this.geo.mine, this.propMat, n);
    this.markers = new PropLayer(this.geo.marker, this.flatMat, n, false, false);
    this.markerTimers.length = 0;
    this.board.add(
      this.tiles.mesh, this.numbers.group, this.trees.mesh, this.oaks.mesh, this.groves.mesh, this.tufts.mesh, this.rocks.mesh, this.golds.mesh,
      this.houses.mesh, this.landmarks.mesh, this.flags.mesh, this.mines.mesh, this.markers.mesh, this.water.mesh, this.smoke.mesh,
    );
    this.ground.scale.set(b.width + 2, b.height + 2, 1);
    this.rig.setBoard(b.width / 2, b.height / 2);
    const fog = this.world.scene.fog as THREE.Fog;
    fog.near = this.rig.maxDist * 1.3;
    fog.far = this.rig.maxDist * 3.5;
    this.picker = new Picker(this.rig.camera, this.canvas, b.width, b.height);
    this.lastYaw = 0;
    this.numbers.setYaw(0, this.now);
    this.celebrateUntil = 0;
    this.hoverCell = -1;
    this.hover.visible = false;
    this.showStart(-1);
    this.applyAge(0);
    this.world.followTarget(0, 0);
    this.requestFrame(4);
  }

  // ---- game event handlers ----

  onRevealed(cells: Int32Array, dist: Uint16Array, count: number): void {
    const g = this.game;
    const b = g.board;
    const now = this.now;
    if (this.startCell >= 0 && b.state[this.startCell] === REVEALED) this.showStart(-1);
    for (let k = 0; k < count; k++) {
      const c = cells[k];
      const delay = Math.min(dist[k] * 0.024, 1.6);
      this.tiles.reveal(c, now, delay);
      const x = this.tiles.centerX(c);
      const z = this.tiles.centerZ(c);
      const adj = b.adj[c];
      const pd = delay + 0.1;
      const t = g.terrain[c];
      const top = this.tiles.topOf(c);
      if (t === Terrain.Water) this.water.reveal(c, now, delay);
      if (adj > 0) this.numbers.add(c, adj, x, (t === Terrain.Water ? WATER_Y : top) + 0.02, z, now, pd + 0.08);
      const r = hash01(c * 7 + g.seed);
      const small = adj > 0;
      const ox = small ? 0.27 * (r < 0.5 ? -1 : 1) : (r - 0.5) * 0.3;
      const oz = small ? -0.27 : (hash01(c) - 0.5) * 0.3;
      const sc = small ? 0.5 : 0.9 + r * 0.3;
      const tint = 0.85 + hash01(c + 99) * 0.3;
      if (this.flags.has(c)) this.flags.remove(c);
      if (t === Terrain.Forest) {
        if (small) (r < 0.5 ? this.trees : this.oaks).add(c, x + ox, top, z + oz, r * 6.28, sc, now, pd, tint);
        else this.groves.add(c, x, top, z, r * 6.28, 0.95 + r * 0.15, now, pd, tint);
      } else if (t === Terrain.Rock) this.rocks.add(c, x + ox, top, z + oz, r * 6.28, sc, now, pd, tint);
      else if (t === Terrain.Gold) this.golds.add(c, x + ox, top, z + oz, r * 6.28, sc, now, pd, tint);
      else if (g.empire && adj === 0 && t !== Terrain.Water && hash01(c + 31) < 0.25) {
        const landmark = hash01(c + 57) < 0.25;
        const yaw = Math.floor(r * 4) * (Math.PI / 2);
        (landmark ? this.landmarks : this.houses).add(c, x, top, z, yaw, 1, now, pd + 0.1);
        this.smoke.add(c, x, top, z, yaw, landmark);
      } else if (t === Terrain.Grass && adj === 0 && hash01(c + 13) < 0.75) {
        this.tufts.add(c, x, top, z, r * 6.28, 0.9 + r * 0.4, now, pd, tint);
      }
    }
    this.world.dirtyShadows();
    this.requestFrame(4);
  }

  onFlag(cell: number, flagged: boolean): void {
    if (flagged) {
      const r = hash01(cell);
      this.flags.add(cell, this.tiles.centerX(cell), HIDDEN_H, this.tiles.centerZ(cell), r * 0.8 - 0.4, 1, this.now);
      this.effects.burst(this.tiles.centerX(cell), HIDDEN_H + 0.1, this.tiles.centerZ(cell), 5, [0xd1342c, 0xffffff], 1.2, 0.06);
    } else {
      this.flags.remove(cell);
    }
    this.world.dirtyShadows();
    this.requestFrame(3);
  }

  onShielded(cell: number): void {
    this.effects.burst(this.tiles.centerX(cell), HIDDEN_H, this.tiles.centerZ(cell), 28, [0x9ad0ff, 0xffffff, 0x5aa0e8], 3.5, 0.1);
  }

  onExploded(cell: number): void {
    const b = this.game.board;
    const now = this.now;
    const cx = cell % b.width;
    const cy = (cell / b.width) | 0;
    this.tiles.explode(cell);
    for (let i = 0; i < b.size; i++) {
      if (!b.mines[i] || b.state[i] === FLAGGED) continue;
      const d = Math.hypot((i % b.width) - cx, ((i / b.width) | 0) - cy);
      const delay = Math.min(d * 0.03, 1.8);
      const top = this.tiles.topOf(i);
      this.mines.add(i, this.tiles.centerX(i), top, this.tiles.centerZ(i), hash01(i) * 6, 1, now, delay);
    }
    this.effects.burst(this.tiles.centerX(cell), 0.4, this.tiles.centerZ(cell), 140, FIRE, 6, 0.16);
    this.world.dirtyShadows();
    this.requestFrame(10);
  }

  onWon(): void {
    const b = this.game.board;
    const now = this.now;
    for (let i = 0; i < b.size; i++) {
      if (b.mines[i] && b.state[i] !== FLAGGED) {
        this.flags.add(i, this.tiles.centerX(i), HIDDEN_H, this.tiles.centerZ(i), hash01(i) - 0.5, 1, now, hash01(i + 5) * 0.8);
      }
    }
    this.celebrateUntil = now + 4;
    this.nextFirework = now;
    this.world.dirtyShadows();
  }

  onHighlight(cells: number[], ms: number): void {
    const now = this.now;
    for (const c of cells) {
      if (this.game.board.state[c] === FLAGGED) continue;
      this.markers.add(c, this.tiles.centerX(c), HIDDEN_H, this.tiles.centerZ(c), 0, 1, now);
      this.markerTimers.push({ cell: c, until: now + ms / 1000 });
    }
    this.requestFrame(4);
  }

  applyAge(age: number): void {
    const a = AGES[age];
    this.tiles.setAge(age);
    this.world.setAtmosphere(a.sky, a.fog, a.sun);
    this.smoke.setAge(age);
    this.houses.setGeometry(this.geo.buildings[age][0]);
    this.landmarks.setGeometry(this.geo.buildings[age][1]);
    const now = this.now;
    this.houses.replay(now);
    this.landmarks.replay(now);
    this.world.dirtyShadows();
    this.requestFrame(6);
  }

  setHover(cell: number): void {
    if (cell === this.hoverCell) return;
    this.hoverCell = cell;
    this.updateHover();
    this.requestFrame(2);
  }

  /** Mark (or with -1 unmark) the cell the player has to open first. */
  showStart(cell: number): void {
    this.startCell = cell;
    for (const r of this.startRings) {
      r.visible = cell >= 0;
      if (cell >= 0) r.position.set(this.tiles.centerX(cell), HIDDEN_H + 0.05, this.tiles.centerZ(cell));
    }
    this.requestFrame(4);
  }

  updateHover(): void {
    const cell = this.hoverCell;
    if (cell < 0 || !this.game || this.game.over) {
      this.hover.visible = false;
      return;
    }
    const t = this.game.targeting;
    const span = t ? (t.id === 'engineer' ? 5 : 3) : 1;
    this.hover.visible = true;
    this.hover.scale.set(span, 1, span);
    this.hover.position.set(this.tiles.centerX(cell), HIDDEN_H + 0.04, this.tiles.centerZ(cell));
    (this.hover.material as THREE.MeshBasicMaterial).color.setHex(t ? 0x5ac8ff : 0xffffff);
  }

  /** Advance animations. Returns true if the frame needs a render. */
  update(dt: number): boolean {
    const now = this.now;
    this.rig.update(dt);
    let dirty = this.rig.moved;
    if (this.rig.yawChanged || this.rig.yaw !== this.lastYaw) {
      this.lastYaw = this.rig.yaw;
      this.numbers.setYaw(this.rig.yaw, now);
    }
    if (this.rig.moved) {
      this.world.followTarget(this.rig.targetX, this.rig.targetZ);
      this.rig.moved = false;
    }
    const a = this.tiles.update(now) || this.water.update(now);
    const b = this.numbers.update(now);
    let c = false;
    for (const l of [this.trees, this.oaks, this.groves, this.tufts, this.rocks, this.golds, this.houses, this.landmarks, this.flags, this.mines, this.markers]) {
      c = l.update(now) || c;
    }
    const e = this.effects.active;
    this.effects.update(dt);

    for (let i = this.markerTimers.length - 1; i >= 0; i--) {
      if (now >= this.markerTimers[i].until) {
        this.markers.remove(this.markerTimers[i].cell);
        this.markerTimers.splice(i, 1);
        dirty = true;
      }
    }
    if (now < this.celebrateUntil && now >= this.nextFirework) {
      this.nextFirework = now + 0.22;
      const b2 = this.game.board;
      const x = this.rig.targetX + (Math.random() - 0.5) * Math.min(b2.width, 24);
      const z = this.rig.targetZ + (Math.random() - 0.5) * Math.min(b2.height, 16);
      this.effects.burst(x, 2 + Math.random() * 2, z, 36, FIREWORK, 4, 0.12);
    }

    if (this.startCell >= 0) {
      this.startRings.forEach((r, i) => {
        const ph = (now * 0.8 + i * 0.5) % 1;
        r.scale.setScalar(0.8 + ph * 1.1);
        (r.material as THREE.MeshBasicMaterial).opacity = 1 - ph;
      });
      dirty = true;
    }

    const animating = a || b || c || e || this.effects.active || now < this.celebrateUntil;
    if (animating) this.world.dirtyShadows();
    this.world.flushShadows();
    if (animating || dirty || this.pendingFrames > 0) {
      if (!animating && !dirty) this.pendingFrames--;
      return true;
    }
    return false;
  }
}
