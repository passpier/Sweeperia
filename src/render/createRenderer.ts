import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import type { Quality } from '../settings';

export type Backend = 'webgl' | 'webgpu';

export interface RendererInfo {
  renderer: WebGPURenderer;
  backend: Backend;
}

/**
 * WebGPURenderer picks WebGPU when available and silently falls back to its own WebGL2 backend,
 * so every material is written once (TSL) and runs on both. `?renderer=webgl` forces WebGL for debugging.
 */
export async function createRenderer(canvas: HTMLCanvasElement, quality: Quality): Promise<RendererInfo> {
  let forceWebGL = new URLSearchParams(location.search).get('renderer') === 'webgl';
  for (let attempt = 0; ; attempt++) {
    try {
      const renderer = new WebGPURenderer({
        canvas,
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        forceWebGL,
      });
      await renderer.init();
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = quality !== 'low';
      renderer.shadowMap.type = THREE.PCFShadowMap;
      const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl';
      return { renderer, backend };
    } catch (e) {
      if (attempt > 0) throw e;
      console.warn('Renderer init failed, retrying with WebGL', e);
      forceWebGL = true;
      // The canvas may be bound to a failed context; swap for a fresh one.
      const fresh = canvas.cloneNode() as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
  }
}
