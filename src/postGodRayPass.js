/**
 * Screenspace volumetric shafts: radial smear from projected sun/light position.
 */
export function makeGodRayRadialPass(THREE) {
  const uniforms = {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(512, 512) },
    lightPos: { value: new THREE.Vector2(0.55, 0.08) }, // NDCS-like 0..1
    density: { value: 0.35 },
    decay: { value: 0.965 },
    weight: { value: 0.028 },
    samples: { value: 6 },
    fgColor: { value: new THREE.Color(1, 1, 1) },
    fgPremul: { value: 0.72 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform vec2 lightPos;
      uniform float density;
      uniform float decay;
      uniform float weight;
      uniform float samples;
      uniform vec3 fgColor;
      uniform float fgPremul;
      varying vec2 vUv;
      void main(){
        vec2 uv = vUv;
        vec2 delta = uv - lightPos;
        delta *= (1.0 / max(samples, 1.0));
        vec2 coord = uv;
        float illuminationDecay = 1.0;
        vec4 frag = texture2D(tDiffuse, uv);
        vec4 occ = frag;
        for(float i=0.0;i<48.0;i++){
          if(i>=samples+0.001)break;
          coord -= delta;
          vec4 samp = texture2D(tDiffuse, coord);
          occ.rgb = min(occ.rgb, samp.rgb);
          illuminationDecay *= decay;
        }
        float vig = clamp(1.0 - distance(uv, lightPos)*density, 0.0, 1.0);
        vec3 shafts = fgColor * (1.0 - occ.rgb) * weight * vig * illuminationDecay;
        shafts *= fgPremul;
        vec3 bg = frag.rgb + shafts;
        gl_FragColor = vec4(bg, 1.0);
      }
    `
  });
  return {
    uniforms,
    material: mat,
    dispose() {
      mat.dispose();
    },
    resize(w, h) {
      uniforms.resolution.value.set(w, h);
    },
    /** World-space dir light → approx screen UV (fallback center-top). */
    setFromDirectional(light, cam) {
      if (!light || !cam || !light.position || !light.target) return;
      const v = new THREE.Vector3();
      light.target.getWorldPosition(v);
      const t = new THREE.Vector3();
      light.getWorldDirection(t); // opposite of incoming
      const sun = v.clone().add(t.multiplyScalar(-200));
      sun.project(cam);
      const x = THREE.MathUtils.clamp(sun.x * 0.5 + 0.5, 0.05, 0.95);
      const y = THREE.MathUtils.clamp(-sun.y * 0.5 + 0.5, 0.05, 0.95);
      uniforms.lightPos.value.set(x, y);
    }
  };
}
