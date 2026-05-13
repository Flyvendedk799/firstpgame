// Preserve default Three.js light shader chunks so CSM can be torn down cleanly.
import { ShaderChunk } from 'three';

const saved = {
  lights_fragment_begin: ShaderChunk.lights_fragment_begin,
  lights_pars_begin: ShaderChunk.lights_pars_begin
};

/** Call after disposing CSM to restore vanilla directional shadow shading. */
export function restoreLightsShaderChunks() {
  ShaderChunk.lights_fragment_begin = saved.lights_fragment_begin;
  ShaderChunk.lights_pars_begin = saved.lights_pars_begin;
}
