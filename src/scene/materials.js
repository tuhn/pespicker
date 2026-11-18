// All scene materials. Every one is unlit (ShaderMaterial / MeshBasicMaterial): no lights, no shadows.
// Time is a single shared uniform object so one write per frame updates everything.
import { ShaderMaterial, MeshBasicMaterial, AdditiveBlending, NormalBlending, Color, DoubleSide, Vector2 } from 'three';

export const shared = {
  uTime: { value: 0 },
  uClip: { value: 99 }, // boot dissolve: world Y above which the stadium is not built yet
  uPixelRatio: { value: 1 },
};

const C = (hex) => new Color(hex);
export const PALETTE = { neon: C('#78ff9a'), cyan: C('#5cf2ff'), lime: C('#c8ff53'), gold: C('#ffd76a'), white: C('#ffffff') };

const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending };

// ---------- hologram lines (pitch markings, stand edges) ----------
export function holoLineMaterial({ colorA = PALETTE.neon, colorB = PALETTE.cyan, opacity = 0.9 } = {}) {
  return new ShaderMaterial({
    ...additive,
    uniforms: { uTime: shared.uTime, uClip: shared.uClip, uA: { value: colorA }, uB: { value: colorB }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uClip, uOpacity; uniform vec3 uA, uB;
      varying vec3 vW;
      void main() {
        float d = uClip - vW.y;
        if (d < 0.0) discard;
        float scan = 0.62 + 0.38 * sin(vW.y * 38.0 - uTime * 4.0);
        float flick = 0.88 + 0.12 * sin(uTime * 31.0 + vW.x * 5.0);
        float front = 1.0 - smoothstep(0.0, 0.12, d);         // bright edge where it is being built
        vec3 col = mix(uA, uB, clamp(vW.y * 0.6 - 0.2, 0.0, 1.0));
        gl_FragColor = vec4(col * scan * flick + front * vec3(0.9), uOpacity * (0.55 + 0.45 * scan));
      }`,
  });
}

// ---------- hologram surfaces with fresnel rim (stand bowl, card edge glow) ----------
export function holoSurfaceMaterial({ color = PALETTE.cyan, opacity = 0.35, fresnelPow = 2.2 } = {}) {
  return new ShaderMaterial({
    ...additive,
    side: DoubleSide,
    uniforms: { uTime: shared.uTime, uClip: shared.uClip, uColor: { value: color }, uOpacity: { value: opacity }, uPow: { value: fresnelPow } },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uClip, uOpacity, uPow; uniform vec3 uColor;
      varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main() {
        float d = uClip - vW.y;
        if (d < 0.0) discard;
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        float scan = 0.7 + 0.3 * sin(vW.y * 60.0 - uTime * 5.0);
        float flick = 0.9 + 0.1 * sin(uTime * 23.0 + vW.y * 7.0);
        float front = 1.0 - smoothstep(0.0, 0.1, d);
        gl_FragColor = vec4(uColor * (fres * 1.4 + 0.08) * scan * flick + front * 0.6, uOpacity * (fres + 0.12));
      }`,
  });
}

// ---------- pitch plane: faint grid + expanding wave (5★) ----------
export function pitchMaterial() {
  return new ShaderMaterial({
    ...additive,
    uniforms: { uTime: shared.uTime, uClip: shared.uClip, uWave: { value: -1 }, uWaveColor: { value: PALETTE.gold.clone() }, uSize: { value: new Vector2(2.1, 1.36) } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uClip, uWave; uniform vec3 uWaveColor; uniform vec2 uSize;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        if (vW.y > uClip) discard;
        vec2 p = (vUv - 0.5) * uSize;
        float stripes = 0.5 + 0.5 * step(0.5, fract(vUv.x * 9.0));
        vec3 col = vec3(0.12, 0.55, 0.3) * (0.05 + 0.04 * stripes);
        float a = 0.5;
        if (uWave >= 0.0) {
          float r = length(p) - uWave * 1.6;
          float ring = exp(-r * r * 90.0) * (1.0 - uWave);
          col += uWaveColor * ring * 1.6;
        }
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ---------- projector base rings (dashed arcs) ----------
export function ringMaterial({ color = PALETTE.neon, dashes = 24, duty = 0.55, opacity = 0.9 } = {}) {
  return new ShaderMaterial({
    ...additive,
    side: DoubleSide,
    uniforms: { uTime: shared.uTime, uColor: { value: color }, uDashes: { value: dashes }, uDuty: { value: duty }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */`varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uDashes, uDuty, uOpacity; uniform vec3 uColor; varying vec2 vP;
      void main() {
        float ang = atan(vP.y, vP.x) / 6.2831853 + 0.5;
        float dash = step(fract(ang * uDashes), uDuty);
        float flick = 0.85 + 0.15 * sin(uTime * 19.0 + ang * 40.0);
        gl_FragColor = vec4(uColor * flick, uOpacity * (0.25 + 0.75 * dash));
      }`,
  });
}

// ---------- light beam cone ----------
export function beamMaterial() {
  return new ShaderMaterial({
    ...additive,
    side: DoubleSide,
    uniforms: { uTime: shared.uTime, uIntensity: { value: 0.5 }, uColor: { value: PALETTE.cyan } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uIntensity; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);                 // bright at the base
        float rays = 0.75 + 0.25 * sin(vUv.x * 62.83 + uTime * 1.5);
        float scan = 0.8 + 0.2 * sin(vUv.y * 80.0 - uTime * 6.0);
        gl_FragColor = vec4(uColor, fade * rays * scan * 0.32 * uIntensity);
      }`,
  });
}

// ---------- soft additive sprite (glows) ----------
export function glowMaterial({ color = PALETTE.neon, opacity = 0.6 } = {}) {
  return new ShaderMaterial({
    ...additive,
    depthTest: false,
    uniforms: { uColor: { value: color }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() { float d = length(vUv - 0.5) * 2.0; float g = exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d)); gl_FragColor = vec4(uColor, g * uOpacity); }`,
  });
}

// ---------- shockwave ring ----------
export function shockMaterial() {
  return new ShaderMaterial({
    ...additive,
    depthTest: false,
    uniforms: { uT: { value: 0 }, uColor: { value: PALETTE.white.clone() } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uT; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float r = d - uT;
        float ring = exp(-r * r * 260.0) + 0.35 * exp(-r * r * 30.0);
        gl_FragColor = vec4(mix(uColor, vec3(0.36, 0.95, 1.0), d), ring * (1.0 - uT) * step(d, 1.0));
      }`,
  });
}

// ---------- motion trail (stretched sprite) ----------
export function trailMaterial(color) {
  return new ShaderMaterial({
    ...additive,
    depthTest: false,
    uniforms: { uColor: { value: color }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() { float a = pow(vUv.x, 2.0) * (1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0)); gl_FragColor = vec4(uColor, a * uOpacity); }`,
  });
}

// ---------- full-screen flash ----------
export function flashMaterial() {
  return new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: AdditiveBlending });
}

// ---------- VS plate with chromatic glitch ----------
export function vsMaterial(texture) {
  return new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: NormalBlending,
    uniforms: { uMap: { value: texture }, uGlitch: { value: 0 }, uOpacity: { value: 0 }, uTime: shared.uTime },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform float uGlitch, uOpacity, uTime; varying vec2 vUv;
      void main() {
        float band = step(0.82, fract(sin(floor(vUv.y * 14.0) * 91.7 + floor(uTime * 24.0)) * 437.5));
        vec2 uv = vUv + vec2(band * uGlitch * 0.05, 0.0);
        vec2 off = vec2(uGlitch * 0.025, 0.0);
        vec4 c = texture2D(uMap, uv);
        float r = texture2D(uMap, uv + off).a;
        float b = texture2D(uMap, uv - off).a;
        vec3 col = c.rgb + vec3(r - c.a, 0.0, b - c.a) * vec3(1.0, 0.0, 1.0) * 0.9;
        float a = max(c.a, max(r, b) * uGlitch);
        gl_FragColor = vec4(col + vec3(r, 0.0, b) * uGlitch * 0.4, a * uOpacity);
      }`,
  });
}

// ---------- GPU particles: drifting motes (one draw call, motion fully in the vertex shader) ----------
export function motesMaterial() {
  return new ShaderMaterial({
    ...additive,
    uniforms: { uTime: shared.uTime, uPixelRatio: shared.uPixelRatio, uA: { value: PALETTE.neon }, uB: { value: PALETTE.cyan }, uBoost: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime, uPixelRatio, uBoost;
      varying float vFade; varying float vMix;
      void main() {
        float h = 3.6;
        float y = fract(aSeed.y + uTime * (0.015 + aSeed.w * 0.03)) * h - 0.2;
        float r = 0.6 + aSeed.x * 2.6;
        float a = aSeed.z * 6.2831853 + uTime * 0.05 * (aSeed.w - 0.5);
        vec3 p = vec3(cos(a) * r, y, sin(a) * r * 0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.5 + aSeed.w * 3.5) * uPixelRatio * (6.0 / -mv.z) * (1.0 + uBoost);
        vFade = smoothstep(-0.2, 0.4, y) * (1.0 - smoothstep(h - 1.2, h - 0.2, y));
        vMix = aSeed.x;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA, uB; uniform float uBoost; varying float vFade; varying float vMix;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(mix(uA, uB, vMix) * (1.0 + uBoost), a * vFade * 0.8);
      }`,
  });
}

// ---------- GPU particles: burst (5★ and clash). uT 0..1 drives the whole explosion ----------
export function burstMaterial() {
  return new ShaderMaterial({
    ...additive,
    depthTest: false,
    uniforms: { uT: { value: -1 }, uPixelRatio: shared.uPixelRatio, uColor: { value: PALETTE.gold.clone() }, uColor2: { value: PALETTE.white.clone() }, uRadius: { value: 1.2 } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uT, uPixelRatio, uRadius;
      varying float vA; varying float vMix;
      void main() {
        float t = clamp(uT, 0.0, 1.0);
        float th = aSeed.x * 6.2831853, ph = acos(2.0 * aSeed.y - 1.0);
        vec3 dir = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph) * 0.3);
        float travel = (1.0 - pow(1.0 - t, 3.0)) * uRadius * (0.35 + aSeed.z * 0.9);
        vec3 p = position + dir * travel + vec3(0.0, -0.4 * t * t, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSeed.w * 5.0) * uPixelRatio * (6.0 / -mv.z) * (1.0 - t * 0.6);
        vA = (uT < 0.0 || uT > 1.0) ? 0.0 : (1.0 - t);
        vMix = aSeed.w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uColor2; varying float vA; varying float vMix;
      void main() {
        if (vA <= 0.0) discard;
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(mix(uColor, uColor2, vMix * 0.6), smoothstep(0.5, 0.0, d) * vA);
      }`,
  });
}

// ---------- card: front/back from CanvasTextures + holographic foil ----------
/**
 * The card is an extruded rounded rectangle. Caps are told apart by object-space normal z
 * (+ front, - back); sides get an emissive edge in the team colour. Foil = rainbow bands that
 * shift with the view angle and card tilt; strength and a sweeping shine scale with the tier.
 */
export function cardMaterial({ front, back, size }) {
  return new ShaderMaterial({
    transparent: true,
    uniforms: {
      uFront: { value: front }, uBack: { value: back }, uSize: { value: size },
      uTime: shared.uTime,
      uReveal: { value: 1 }, // scan-in 0..1 (bottom to top)
      uFoil: { value: 0.3 }, uShine: { value: -1 }, uGold: { value: 0 },
      uTeam: { value: new Color('#78ff9a') }, uTeam2: { value: new Color('#5cf2ff') },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      uniform vec2 uSize;
      varying vec2 vUv; varying float vSide; varying vec3 vN; varying vec3 vV; varying float vYObj;
      void main() {
        vSide = abs(normal.z) > 0.5 ? sign(normal.z) : 0.0;
        vec2 uv = position.xy / uSize + 0.5;
        if (vSide < 0.0) uv.x = 1.0 - uv.x;
        vUv = uv;
        vYObj = uv.y;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uFront, uBack; uniform float uTime, uReveal, uFoil, uShine, uGold, uOpacity;
      uniform vec3 uTeam, uTeam2;
      varying vec2 vUv; varying float vSide; varying vec3 vN; varying vec3 vV; varying float vYObj;
      vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 0.333, 0.667)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        float rv = uReveal * 1.08;
        if (vYObj > rv) discard;
        float scanEdge = 1.0 - smoothstep(0.0, 0.06, rv - vYObj);
        float ndv = dot(normalize(vN), normalize(vV));
        vec3 col; float a = 1.0;
        if (vSide > 0.5) {
          vec4 t = texture2D(uFront, vUv);
          col = t.rgb; a = t.a;
          float h = vUv.x * 0.8 + vUv.y * 0.5 + (1.0 - ndv) * 2.2 + vN.x * 1.5 + vN.y;
          vec3 rainbow = mix(hue(h), vec3(1.0, 0.82, 0.38), uGold);
          float mask = 0.35 + 0.65 * smoothstep(0.25, 0.9, sin(h * 12.566) * 0.5 + 0.5);
          col += rainbow * uFoil * mask * 0.35;
          if (uShine >= 0.0) {
            float s = vUv.x + vUv.y * 0.45 - uShine * 1.9 + 0.2;
            col += vec3(1.0, 0.95, 0.8) * exp(-s * s * 160.0) * (0.6 + uGold);
          }
        } else if (vSide < -0.5) {
          vec4 t = texture2D(uBack, vUv);
          col = t.rgb + hue(vUv.y + uTime * 0.1 + (1.0 - ndv)) * 0.12;
          a = t.a;
        } else {
          col = mix(uTeam, uTeam2, vUv.y) * 1.3;
        }
        col += vec3(0.6, 1.0, 0.8) * scanEdge * 1.5;
        float scan = 0.96 + 0.04 * sin(vUv.y * 400.0 - uTime * 8.0);
        gl_FragColor = vec4(col * scan, a * uOpacity);
      }`,
  });
}
