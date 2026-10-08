import type * as THREE from 'three';
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

/** High-quality tier only: a restrained bloom so lit windows, gold, water glints and fireworks glow. */
export class Post {
  on = true;
  private readonly pipeline: RenderPipeline;

  constructor(renderer: WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.pipeline = new RenderPipeline(renderer);
    const color = pass(scene, camera).getTextureNode('output');
    this.pipeline.outputNode = color.add(bloom(color, 0.45, 0.6, 1.05));
  }

  render(): void {
    this.pipeline.render();
  }
}
