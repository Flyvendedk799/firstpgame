/**
 * Lightweight unsharp-ish sharpen (CAS-like approximation) — runs in linear-ish post space before output.
 */
export function makePostSharpenPass(THREE, strength = 0.35) {
  const uniforms = {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    sharpen: { value: strength }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float sharpen;
      varying vec2 vUv;
      void main(){
        vec2 px = vec2(1.0/resolution.x, 1.0/resolution.y);
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0,-px.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2( px.x,0.0)).rgb;
        vec3 w = texture2D(tDiffuse, vUv + vec2(-px.x,0.0)).rgb;
        vec3 blur = (n+s+e+w)*0.25;
        vec3 sharp = mix(c, c + (c - blur)*1.85, sharpen);
        gl_FragColor = vec4(sharp, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false
  });
  return {
    uniforms,
    material: mat,
    dispose() {
      mat.dispose();
    },
    resize(w, h) {
      uniforms.resolution.value.set(w, h);
    }
  };
}
