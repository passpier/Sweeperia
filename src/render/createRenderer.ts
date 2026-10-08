import * as THREE from 'three';
import type { Quality } from '../settings';

export type Backend = 'webgl' | 'webgpu';

export interface RendererInfo {
  renderer: THREE.WebGLRenderer;
  backend: Backend;
  /** Set when WebGPU was requested but we fell back. */
  note?: string;
}

/**
 * WebGL is the primary path. WebGPU is opt-in and loaded lazily so it never costs
 * WebGL users any bytes; any failure falls back to WebGL transparently.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  want: Backend,
  quality: Quality,
): Promise<RendererInfo> {
  let note: string | undefined;
  if (want === 'webgpu') {
    if (!('gpu' in navigator)) {
      note = '此瀏覽器不支援 WebGPU，已使用 WebGL';
    } else {
      try {
        const mod = await import('three/webgpu');
        const r = new mod.WebGPURenderer({
          canvas,
          antialias: quality !== 'low',
          powerPreference: 'high-performance',
        });
        await r.init();
        r.shadowMap.enabled = quality !== 'low';
        return { renderer: r as unknown as THREE.WebGLRenderer, backend: 'webgpu' };
      } catch (e) {
        console.warn('WebGPU init failed, falling back to WebGL', e);
        note = 'WebGPU 初始化失敗，已使用 WebGL';
        // The canvas may be bound to a failed context; swap for a fresh one.
        const fresh = canvas.cloneNode() as HTMLCanvasElement;
        canvas.replaceWith(fresh);
        canvas = fresh;
      }
    }
  }
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality !== 'low',
    powerPreference: 'high-performance',
    stencil: false,
    alpha: false,
  });
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  return { renderer, backend: 'webgl', note };
}
