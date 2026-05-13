/** Local irradiance peek — perspective render for subtle viewmodel / fill tint. */
export function createLightProbeWalker(opts) {
  const THREE = opts && opts.THREE;
  const renderer = opts && opts.renderer;
  const scene = opts && opts.scene;
  const getChestPosition = opts && opts.getChestPosition;
  const quality = (opts && opts.quality) || 'medium';
  const enableReadback = !!(opts && opts.enableReadback);

  const noop = {
    dispose() {},
    tick() {
      return 0;
    }
  };

  if (!enableReadback || !THREE || !renderer || !scene || typeof getChestPosition !== 'function' || quality === 'low') {
    return noop;
  }

  const period = quality === 'ultra' ? 8 : quality === 'high' ? 10 : 24;
  const side = quality === 'ultra' ? 20 : quality === 'high' ? 18 : 14;
  const cam = new THREE.PerspectiveCamera(75, 1, 0.12, 55);
  const target = new THREE.WebGLRenderTarget(side, side);
  target.texture.name = 'lightProbePeek';
  const buf = new Uint8Array(side * side * 4);
  const up = new THREE.Vector3(0, 1, 0);
  let frameAcc = 0;
  let last = 0;

  return {
    dispose() {
      try { target.dispose(); } catch (_) {}
    },
    tick() {
      frameAcc++;
      if (frameAcc % period !== 0) return last;
      const p = getChestPosition();
      if (!p) return last;
      cam.position.copy(p);
      cam.up.set(0, 0, -1);
      cam.lookAt(p.clone().add(up));
      const prev = renderer.getRenderTarget?.() || null;
      let ok = false;
      try {
        renderer.setRenderTarget(target);
        renderer.clear(true, true, true);
        renderer.render(scene, cam);
        renderer.readRenderTargetPixels(target, 0, 0, side, side, buf);
        ok = true;
      } catch (_) {
        ok = false;
      } finally {
        try {
          renderer.setRenderTarget(prev);
        } catch (_) {}
      }
      if (!ok) return last;
      let r = 0; let g = 0; let b = 0;
      let n = 0;
      const stride = Math.max(1, Math.floor(side / 10));
      for (let y = 0; y < side; y += stride) {
        for (let x = 0; x < side; x += stride) {
          const i = (y * side + x) * 4;
          r += buf[i] / 255;
          g += buf[i + 1] / 255;
          b += buf[i + 2] / 255;
          n++;
        }
      }
      if (!n) return last;
      r /= n;
      g /= n;
      b /= n;
      const lum = THREE.MathUtils.clamp(Math.max(r, Math.max(g, b)), 0, 1);
      const tint = THREE.MathUtils.clamp(lum * 0.58 + (r + g + b) * 0.11, 0.45, 1.48);
      last = tint - 1;
      return last;
    }
  };
}
