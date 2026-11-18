// 3D draw scene: Holographic Stadium -> 3D Team Cards -> VS Clash.
//
// Layout contract with the DOM: the results screen renders empty "anchor" boxes where each card and
// the VS badge should end up. The scene reads their rects and places the cards there, so DOM text,
// lock buttons and the 3D cards always line up. Cards and effects are children of the camera
// (screen-locked); the stadium lives in world space behind them and sways with the camera.
//
// Performance rules (CLAUDE.md): unlit materials only, no lights/shadows, everything created up front,
// shaders compiled and textures uploaded before a timeline starts, no allocations while animating,
// render only while something moves, pause when the tab is hidden.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, Shape, ExtrudeGeometry, PlaneGeometry,
  BufferGeometry, Float32BufferAttribute, CanvasTexture, SRGBColorSpace, Vector2, Color, MathUtils,
} from 'three';
import { TIMING_3D } from '../config.js';
import { Timeline, ease, lerp } from './tween.js';
import { initialTier, tierSettings, FpsMonitor, saveTier, TIER_ORDER } from './quality.js';
import { createStadium } from './stadium.js';
import {
  shared, cardMaterial, glowMaterial, shockMaterial, trailMaterial, flashMaterial, vsMaterial, burstMaterial, PALETTE,
} from './materials.js';
import { CARD_W, CARD_H, TIER_COLORS, tierKey, drawFront, drawBack, drawVs, prepareImages, ensureFonts } from './cardTexture.js';

const FOV = 38;
const D = 4; // distance of the card plane in camera space
const CARD_WORLD_W = 1;
const CARD_WORLD_H = 1.5;
const MAX_PARTICLES = 900;
const FOIL_BY_TIER = { 5: 1.0, 4: 0.75, 3: 0.45, 0: 0.25 };

/** True if a WebGL context can be created (without keeping it). */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

export function createScene({ debug = false, onContextLost } = {}) {
  let tier = initialTier();
  const settings = () => tierSettings(tier);

  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, antialias: settings().antialias, alpha: false, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor('#07130f', 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.debug.checkShaderErrors = debug; // getProgramInfoLog is a sync GPU round trip
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  scene.add(camera);

  // ---------- stadium ----------
  const stadium = createStadium(MAX_PARTICLES);
  scene.add(stadium.root);

  // ---------- screen-locked layer ----------
  const hud = new Group();
  camera.add(hud);

  // cards
  const shape = new Shape();
  const w = CARD_WORLD_W, h = CARD_WORLD_H, r = 0.07;
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const cardGeo = new ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, curveSegments: 5 });
  cardGeo.translate(0, 0, -0.01);

  const backCanvas = makeCanvas(CARD_W, CARD_H);
  const backTex = texture(backCanvas);
  const glowGeo = new PlaneGeometry(1.7, 2.25);
  const trailGeo = new PlaneGeometry(1, 0.85);
  trailGeo.translate(-0.5, 0, 0);
  const cards = [0, 1].map((side) => {
    const canvasF = makeCanvas(CARD_W, CARD_H);
    const front = texture(canvasF);
    const material = cardMaterial({ front, back: backTex, size: new Vector2(CARD_WORLD_W, CARD_WORLD_H) });
    const mesh = new Mesh(cardGeo, material);
    const glow = new Mesh(glowGeo, glowMaterial({ color: new Color(side ? '#5cf2ff' : '#78ff9a'), opacity: 0.5 }));
    glow.position.z = -0.08;
    glow.renderOrder = -1;
    const pivot = new Group();
    pivot.add(glow, mesh);
    pivot.visible = false;
    hud.add(pivot);
    const trail = new Mesh(trailGeo, trailMaterial(new Color(side ? '#5cf2ff' : '#78ff9a')));
    trail.renderOrder = 5;
    trail.visible = false;
    hud.add(trail);
    return {
      side, canvas: canvasF, front, material, pivot, glow, trail, key: null,
      target: { x: 0, y: 0, s: 0.5 }, // layout rect in camera space
      tilt: { x: 0, y: 0, tx: 0, ty: 0 }, zoom: 0, zoomTo: 0,
    };
  });

  // effects
  const flash = new Mesh(new PlaneGeometry(1, 1), flashMaterial());
  flash.position.z = -0.5; flash.renderOrder = 20; hud.add(flash);
  const shock = new Mesh(new PlaneGeometry(2.6, 2.6), shockMaterial());
  shock.position.z = -D + 0.05; shock.renderOrder = 10; shock.visible = false; hud.add(shock);
  const vsCanvas = makeCanvas(256, 256);
  const vsTex = texture(vsCanvas);
  const vs = new Mesh(new PlaneGeometry(1, 1), vsMaterial(vsTex));
  vs.position.z = -D + 0.1; vs.renderOrder = 15; vs.visible = false; hud.add(vs);
  const burstGeo = new BufferGeometry();
  const BURST = 160;
  const seeds = new Float32Array(BURST * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  burstGeo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
  burstGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(BURST * 3), 3));
  const burst = new Points(burstGeo, burstMaterial());
  burst.frustumCulled = false; burst.renderOrder = 12; hud.add(burst);

  // ---------- state ----------
  let W = 1, H = 1, hV = 1, hW = 1, camDist = 8;
  let timeline = null;
  let running = false;
  let lost = false;
  let idleUntil = 0;
  let shake = 0;
  let bootDolly = 0; // 0..1 extra distance during boot
  let swayT = 0;
  let last = 0;
  let getRects = null;
  let shown = false;
  let bench = null;
  const monitor = new FpsMonitor(tier, applyTier);
  let hudEl = null;
  const frameLog = debug ? [] : null;

  applyTier(tier);

  function applyTier(t) {
    tier = t;
    monitor.tier = t;
    const s = settings();
    const dpr = Math.min(window.devicePixelRatio || 1, s.dpr);
    renderer.setPixelRatio(dpr);
    shared.uPixelRatio.value = dpr;
    stadium.setParticleCount(s.particles);
    resize();
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // Fit ~3.1 units of stadium width; portrait phones pull the camera back.
    camDist = MathUtils.clamp(3.1 / (2 * Math.tan(MathUtils.degToRad(FOV / 2)) * camera.aspect), 6, 12);
    camera.updateProjectionMatrix();
    hV = 2 * D * Math.tan(MathUtils.degToRad(FOV / 2));
    hW = hV * camera.aspect;
    const fh = 2 * 0.5 * Math.tan(MathUtils.degToRad(FOV / 2)) * 1.1;
    flash.scale.set(fh * camera.aspect, fh, 1);
    readLayout();
    poke();
  }

  /** DOM rect -> camera-space position/scale on the card plane. */
  function toCam(rect) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    return { x: (cx / W - 0.5) * hW, y: (0.5 - cy / H) * hV, s: (rect.height / H) * hV / CARD_WORLD_H, sv: (rect.height / H) * hV };
  }
  let vsTarget = { x: 0, y: 0, s: 0.3 };
  function readLayout() {
    if (!getRects) return;
    const rects = getRects();
    if (!rects) return;
    rects.cards.forEach((rc, i) => { if (rc) cards[i].target = toCam(rc); });
    if (rects.vs) { const v = toCam(rects.vs); vsTarget = { x: v.x, y: v.y, s: v.sv }; }
  }

  function updateCamera(dt) {
    swayT += dt;
    const sway = Math.sin(swayT * 0.35) * 0.07;
    const dist = camDist * (1 + bootDolly * 0.35);
    camera.position.set(Math.sin(sway) * dist, 2.1 + Math.sin(swayT * 0.5) * 0.05 + bootDolly * 0.8, Math.cos(sway) * dist);
    camera.lookAt(0, 1.05, 0);
    if (shake > 0) {
      hud.position.set((Math.random() - 0.5) * 0.06 * shake, (Math.random() - 0.5) * 0.06 * shake, 0);
    } else hud.position.set(0, 0, 0);
  }

  function updateCards(dt) {
    const k = 1 - Math.exp(-dt * 10);
    for (const c of cards) {
      c.tilt.x += (c.tilt.tx - c.tilt.x) * k;
      c.tilt.y += (c.tilt.ty - c.tilt.y) * k;
      c.zoom += (c.zoomTo - c.zoom) * k;
      if (c.settled) {
        const s = lerp(c.target.s, Math.min(hV * 0.62 / CARD_WORLD_H, (hW * 0.82) / CARD_WORLD_W), c.zoom);
        c.pivot.position.set(lerp(c.target.x, 0, c.zoom), lerp(c.target.y, 0, c.zoom), -D + c.zoom * 0.5);
        c.pivot.scale.setScalar(s);
        c.pivot.rotation.set(c.tilt.x, c.tilt.y, 0);
        c.pivot.renderOrder = c.zoom > 0.01 ? 30 : 0;
      }
    }
  }

  function frame(now) {
    const dtMs = last ? Math.min(now - last, 100) : 16.7;
    last = now;
    const dt = dtMs / 1000;
    shared.uTime.value += dt;
    if (timeline && !timeline.done) timeline.update(dtMs);
    stadium.tick(dt);
    updateCamera(dt);
    updateCards(dt);
    renderer.render(scene, camera);
    if (bench) {
      bench.t += dtMs; if (bench.t > 200) { bench.sum += dtMs; bench.n++; }
      if (bench.t >= 1000) {
        const fps = bench.n ? 1000 / (bench.sum / bench.n) : 60;
        bench = null;
        if (fps < 45) monitor.downgrade();
      }
    } else monitor.frame(dtMs, now);
    if (frameLog) frameLog.push(now);
    if (hudEl) updateHud(dtMs);
    const busy = (timeline && !timeline.done) || cards.some((c) => Math.abs(c.zoom - c.zoomTo) > 0.002 || Math.abs(c.tilt.x - c.tilt.tx) > 0.002 || Math.abs(c.tilt.y - c.tilt.ty) > 0.002);
    if (!busy && now > idleUntil) stop();
  }

  function start() {
    if (running || lost || document.hidden || !shown) return;
    running = true;
    last = 0;
    renderer.setAnimationLoop(frame);
  }
  function stop() { running = false; renderer.setAnimationLoop(null); }
  /** Keep rendering for at least `ms` more (interactions, settle). */
  function poke(ms = 400) { idleUntil = Math.max(idleUntil, performance.now() + ms); start(); }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (shown) poke(); });
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    stop();
    timeline?.skip();
    onContextLost?.();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    for (const t of [backTex, vsTex, ...cards.map((c) => c.front)]) t.needsUpdate = true;
    for (const c of cards) c.key = null;
    compiled = false;
    warm = null;
  });

  // ---------- preparation (before any timeline) ----------
  let compiled = false;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /**
   * One-time warm-up, run when the browser is idle after the setup screen painted: fonts, shared
   * textures, shader compilation. Keeps the first Draw tap free of compile stalls.
   */
  let warm = null;
  function warmup() {
    if (!warm) {
      warm = (async () => {
        await ensureFonts();
        drawBack(backCanvas); backTex.needsUpdate = true;
        drawVs(vsCanvas); vsTex.needsUpdate = true;
        renderer.initTexture(backTex);
        renderer.initTexture(vsTex);
        await nextFrame();
        // Allocate the two card-face textures now (first upload allocates GPU storage + mipmaps,
        // later draws only update it), and warm the canvas glyph cache for the card font sizes.
        for (const c of cards) {
          const ctx2 = c.canvas.getContext('2d');
          ctx2.drawImage(backCanvas, 0, 0);
          for (const px of [128, 64, 60, 54, 48, 34, 28, 26, 24, 18]) {
            ctx2.font = `700 ${px}px 'Chakra Petch', system-ui, sans-serif`;
            ctx2.fillText('0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz çüéôí·★—', -4000, -4000);
          }
          c.front.needsUpdate = true;
          renderer.initTexture(c.front);
          await nextFrame();
        }
        if (!compiled) {
          const vis = cards.map((c) => c.pivot.visible);
          for (const c of cards) c.pivot.visible = true;
          vs.visible = shock.visible = true;
          for (const c of cards) c.trail.visible = true;
          if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
          else renderer.compile(scene, camera);
          renderer.render(scene, camera); // first draw finishes program linking off the critical path
          vs.visible = shock.visible = false;
          cards.forEach((c, i) => { c.pivot.visible = vis[i]; c.trail.visible = false; });
          compiled = true;
        }
      })();
    }
    return warm;
  }

  /**
   * Per-draw preparation. Work is spread over frames (one card face drawn per frame, one texture
   * upload per frame) so no single frame takes long, even on a throttled CPU.
   */
  async function prepare(entries, names) {
    await warmup();
    for (const c of cards) {
      const i = c.side;
      const e = entries[i];
      const key = `${e.id}|${names[i]}|${i}`;
      const tk = tierKey(e.stars);
      const u = c.material.uniforms;
      u.uFoil.value = FOIL_BY_TIER[tk];
      u.uGold.value = tk === 5 ? 1 : 0;
      u.uTeam.value.set(e.team.colors?.[0] || '#78ff9a');
      u.uTeam2.value.set(e.team.colors?.[1] || '#5cf2ff');
      c.glow.material.uniforms.uColor.value.set(TIER_COLORS[tk]);
      if (c.key === key) continue;
      const images = await prepareImages(e.team);
      await nextFrame();
      drawFront(c.canvas, e, i, names[i], images);
      c.front.needsUpdate = true;
      c.key = key;
      await nextFrame();
      renderer.initTexture(c.front);
    }
    if (!compiled) { compiled = false; warm = null; await warmup(); } // after a context restore
  }

  // ---------- sequences ----------
  /**
   * Play the draw. opts: { entries, names, animateSides: [bool,bool], boot: bool, onBars() }
   * Returns { finished, speedUp(), skip() }.
   */
  async function play({ entries, names, animateSides, boot, onBars, onSide }) {
    await prepare(entries, names);
    readLayout();
    timeline?.skip();
    const T = TIMING_3D;
    const tl = new Timeline();
    timeline = tl;
    let t = 0;

    if (boot) {
      shared.uClip.value = -0.1;
      bootDolly = 1;
      stadium.beam.material.uniforms.uIntensity.value = 0;
      for (const c of cards) c.pivot.visible = false;
      vs.visible = false;
      tl.add(0, T.boot, (k) => { shared.uClip.value = lerp(-0.1, 2.8, k); }, ease.outCubic);
      tl.add(0, T.boot, (k) => { bootDolly = 1 - k; stadium.beam.material.uniforms.uIntensity.value = k; }, ease.inOutCubic);
      bench = { t: 0, sum: 0, n: 0 };
      t = T.boot;
    } else {
      shared.uClip.value = 2.8; bootDolly = 0;
    }

    // Locked side(s): already in place, front facing.
    for (const c of cards) {
      if (!animateSides[c.side]) settle(c);
    }
    vs.visible = false;

    for (const c of cards) {
      if (!animateSides[c.side]) continue;
      const u = c.material.uniforms;
      const five = entries[c.side].stars === 5;
      const center = { x: 0, y: hV * 0.04, s: (hV * 0.5) / CARD_WORLD_H };
      tl.call(t, () => {
        c.settled = false;
        c.pivot.visible = true;
        c.pivot.position.set(center.x, center.y, -D);
        c.pivot.scale.setScalar(center.s);
        c.pivot.rotation.set(0, Math.PI, 0);
        u.uReveal.value = 0; u.uShine.value = -1;
        c.tilt.x = c.tilt.y = c.tilt.tx = c.tilt.ty = 0;
        c.zoom = c.zoomTo = 0;
      });
      tl.add(t, T.cardScan, (k) => { u.uReveal.value = k; stadium.beam.material.uniforms.uIntensity.value = 1 + Math.sin(k * Math.PI) * 1.5; });
      t += T.cardScan;
      tl.add(t, T.cardSpin, (k) => { c.pivot.rotation.y = Math.PI + k * Math.PI * 3; }, (x) => ease.outBack(x, 0.9));
      t += T.cardSpin;
      if (five) {
        tl.add(t, T.cardFlash, (k) => { flash.material.color.copy(PALETTE.gold); flash.material.opacity = (1 - k) * 0.75; }, ease.outQuad);
        tl.call(t, () => { burst.position.set(center.x, center.y, -D + 0.2); burst.material.uniforms.uColor.value.copy(PALETTE.gold); burst.material.uniforms.uRadius.value = 1.4; });
        tl.add(t, 900, (k) => { burst.material.uniforms.uT.value = k >= 1 ? -1 : k; });
        tl.add(t, 1000, (k) => { stadium.pitch.material.uniforms.uWave.value = k >= 1 ? -1 : k; });
        tl.add(t, 650, (k) => { u.uShine.value = k >= 1 ? -1 : k; });
      }
      const from = { ...center };
      tl.add(t, T.cardSlide, (k, raw) => {
        const to = c.target;
        c.pivot.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k), -D);
        c.pivot.scale.setScalar(lerp(from.s, to.s, k));
        c.pivot.rotation.set(Math.sin(k * Math.PI) * 0.25, 0, 0);
        if (raw >= 1) { settle(c); onSide?.(c.side); }
      }, ease.inOutCubic);
      t += T.cardSlide + T.cardPause;
    }

    // ---- VS clash ----
    const start = cards.map(() => ({ x: 0, y: 0, s: 1 }));
    const meet = cards.map(() => ({ x: 0, y: 0 }));
    tl.call(t, () => {
      readLayout();
      cards.forEach((c, i) => {
        c.settled = false;
        Object.assign(start[i], c.target);
        const dir = i === 0 ? 1 : -1;
        meet[i].x = vsTarget.x;
        meet[i].y = vsTarget.y + dir * c.target.s * CARD_WORLD_H * 0.42;
        const tr = c.trail;
        tr.visible = true;
        const dx = meet[i].x - start[i].x, dy = meet[i].y - start[i].y;
        tr.rotation.z = Math.atan2(dy, dx);
        tr.scale.set(Math.hypot(dx, dy) * 0.9, c.target.s * 0.9, 1);
      });
    });
    tl.add(t, T.clashRush, (k) => {
      cards.forEach((c, i) => {
        const dir = i === 0 ? 1 : -1;
        const x = lerp(start[i].x, meet[i].x, k), y = lerp(start[i].y, meet[i].y, k);
        c.pivot.position.set(x, y, -D);
        c.pivot.scale.setScalar(start[i].s);
        c.pivot.rotation.set(dir * 0.55 * k, 0, dir * 0.12 * k);
        c.trail.position.set(x, y, -D - 0.05);
        c.trail.material.uniforms.uOpacity.value = Math.sin(k * Math.PI * 0.95) * 0.9;
      });
    }, ease.inCubic);
    t += T.clashRush;
    // impact
    tl.call(t, () => {
      for (const c of cards) c.trail.visible = false;
      flash.material.color.set('#ffffff');
      shock.visible = true;
      shock.position.set(vsTarget.x, vsTarget.y, -D + 0.05);
      burst.position.set(vsTarget.x, vsTarget.y, -D + 0.2);
      burst.material.uniforms.uColor.value.set('#5cf2ff');
      burst.material.uniforms.uRadius.value = 1.1;
      vs.visible = true;
      vs.position.set(vsTarget.x, vsTarget.y, -D + 0.1);
    });
    tl.add(t, T.clashImpact, (k) => { flash.material.opacity = k < 0.15 ? 1 : (1 - k) * 0.6; shake = k >= 1 ? 0 : 1 - k; }, ease.linear);
    tl.add(t, 520, (k) => { shock.material.uniforms.uT.value = k; shock.scale.setScalar(0.6 + k * 1.6); if (k >= 1) shock.visible = false; }, ease.outCubic);
    tl.add(t, 700, (k) => { burst.material.uniforms.uT.value = k >= 1 ? -1 : k; });
    tl.add(t, 420, (k) => {
      vs.scale.setScalar(vsTarget.s * lerp(2.4, 1, k));
      vs.material.uniforms.uOpacity.value = Math.min(1, k * 3);
      vs.material.uniforms.uGlitch.value = 1 - k;
    }, (x) => ease.outBack(x, 1.6));
    t += T.clashImpact;
    tl.add(t, T.clashSeparate, (k, raw) => {
      cards.forEach((c, i) => {
        const dir = i === 0 ? 1 : -1;
        const to = c.target;
        c.pivot.position.set(lerp(meet[i].x, to.x, k), lerp(meet[i].y, to.y, k), -D);
        c.pivot.scale.setScalar(lerp(start[i].s, to.s, k));
        c.pivot.rotation.set(dir * 0.55 * (1 - k), 0, dir * 0.12 * (1 - k));
        if (raw >= 1) settle(c);
      });
    }, (x) => ease.outBack(x, 1.1));
    t += T.clashSeparate;
    tl.call(t, () => onBars?.());
    tl.add(t, T.bars, () => {});

    tl.finished.then(() => {
      flash.material.opacity = 0; shake = 0; bootDolly = 0; shared.uClip.value = 2.8;
      for (const c of cards) { settle(c); c.trail.visible = false; }
      vs.visible = true; vs.scale.setScalar(vsTarget.s); vs.position.set(vsTarget.x, vsTarget.y, -D + 0.1);
      vs.material.uniforms.uOpacity.value = 1; vs.material.uniforms.uGlitch.value = 0;
      if (timeline === tl) timeline = null;
      poke(1200);
    });
    show();
    poke();
    return {
      finished: tl.finished,
      speedUp() { tl.rate = T.speedUp; },
      skip() { tl.skip(); poke(); },
    };
  }

  function settle(c) {
    c.settled = true;
    c.pivot.visible = true;
    c.material.uniforms.uReveal.value = 1;
    c.pivot.position.set(c.target.x, c.target.y, -D);
    c.pivot.scale.setScalar(c.target.s);
    c.pivot.rotation.set(c.tilt.x, c.tilt.y, 0);
  }

  /** Static results (after swap, resize, returning to the screen). */
  async function showResult({ entries, names }) {
    await prepare(entries, names);
    readLayout();
    shared.uClip.value = 2.8;
    bootDolly = 0;
    for (const c of cards) { c.zoomTo = c.zoom = 0; settle(c); }
    vs.visible = true; vs.scale.setScalar(vsTarget.s); vs.position.set(vsTarget.x, vsTarget.y, -D + 0.1);
    vs.material.uniforms.uOpacity.value = 1; vs.material.uniforms.uGlitch.value = 0;
    show();
    poke(600);
  }

  function show() {
    if (!canvas.isConnected) document.body.prepend(canvas);
    canvas.style.visibility = 'visible';
    shown = true;
  }
  function hide() {
    shown = false;
    stop();
    timeline?.skip();
    canvas.style.visibility = 'hidden';
    for (const c of cards) { c.zoomTo = c.zoom = 0; }
  }

  // ---------- interaction ----------
  const interaction = {
    tilt(i, nx, ny) { const c = cards[i]; c.tilt.ty = MathUtils.clamp(nx, -1, 1) * 0.45; c.tilt.tx = MathUtils.clamp(-ny, -1, 1) * 0.35; poke(); },
    release(i) { const c = cards[i]; c.tilt.tx = c.tilt.ty = 0; poke(800); },
    toggleZoom(i) {
      for (const c of cards) if (c.side !== i) c.zoomTo = 0;
      cards[i].zoomTo = cards[i].zoomTo ? 0 : 1;
      poke(900);
      return cards[i].zoomTo === 1;
    },
    unzoom() { for (const c of cards) c.zoomTo = 0; poke(900); },
  };

  // ---------- debug HUD ----------
  let hudAcc = 0, hudFrames = 0, hudMs = 0;
  if (debug) {
    hudEl = document.createElement('pre');
    hudEl.className = 'debug-hud';
    document.body.append(hudEl);
  }
  function updateHud(dtMs) {
    hudAcc += dtMs; hudFrames++; hudMs += dtMs;
    if (hudAcc < 250) return;
    const info = renderer.info.render;
    hudEl.textContent = `fps ${(1000 / (hudMs / hudFrames)).toFixed(0)}  ${(hudMs / hudFrames).toFixed(1)} ms\ncalls ${info.calls}  tris ${info.triangles}\ntier ${tier}  dpr ${renderer.getPixelRatio()}`;
    hudAcc = 0; hudFrames = 0; hudMs = 0;
  }

  resize();
  return {
    canvas,
    get tier() { return tier; },
    setTier(t) { if (TIER_ORDER.includes(t)) { saveTier(t); applyTier(t); } },
    setLayoutSource(fn) { getRects = fn; readLayout(); },
    play, showResult, show, hide, resize, warmup, ...interaction,
    get frameLog() { return frameLog; },
    get lost() { return lost; },
    info: () => ({ ...renderer.info.render, memory: { ...renderer.info.memory }, tier, dpr: renderer.getPixelRatio() }),
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // Software-backed 2D canvas: uploading it to WebGL is a plain copy. A GPU-accelerated canvas would
  // need a GPU->CPU readback on every texImage2D, which shows up as a long frame on phones.
  c.getContext('2d', { willReadFrequently: true });
  return c;
}
function texture(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
