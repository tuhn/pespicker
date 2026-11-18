// Holographic Stadium: projector base (counter-rotating dashed rings + glow), light cone,
// a floating low-poly stadium (pitch plane, glowing pitch markings, bowl-shaped stands drawn as
// fresnel surface + wire edges) and GPU motes. ~10 draw calls, a few thousand triangles.
import {
  Group, Mesh, LineSegments, Points, BufferGeometry, Float32BufferAttribute, RingGeometry,
  CircleGeometry, PlaneGeometry, CylinderGeometry,
} from 'three';
import {
  holoLineMaterial, holoSurfaceMaterial, pitchMaterial, ringMaterial, beamMaterial, glowMaterial,
  motesMaterial, PALETTE,
} from './materials.js';

const PITCH_W = 2.1; // 105 m
const PITCH_D = 1.36; // 68 m
const FLOAT_Y = 1.25;

export function createStadium(maxParticles) {
  const root = new Group();

  // ---- projector base ----
  const base = new Group();
  const rings = [
    new Mesh(new RingGeometry(1.15, 1.2, 96, 1), ringMaterial({ color: PALETTE.neon, dashes: 36, duty: 0.6 })),
    new Mesh(new RingGeometry(0.88, 0.95, 96, 1), ringMaterial({ color: PALETTE.cyan, dashes: 12, duty: 0.7 })),
    new Mesh(new RingGeometry(0.55, 0.58, 64, 1), ringMaterial({ color: PALETTE.lime, dashes: 6, duty: 0.8, opacity: 0.7 })),
  ];
  for (const r of rings) { r.rotation.x = -Math.PI / 2; base.add(r); }
  const baseGlow = new Mesh(new CircleGeometry(1.5, 48), glowMaterial({ color: PALETTE.neon, opacity: 0.35 }));
  baseGlow.rotation.x = -Math.PI / 2;
  baseGlow.material.depthTest = true;
  base.add(baseGlow);
  root.add(base);

  // ---- light cone from the base up to the stadium ----
  const beamGeo = new CylinderGeometry(1.55, 0.6, FLOAT_Y + 0.4, 48, 1, true);
  beamGeo.translate(0, (FLOAT_Y + 0.4) / 2, 0);
  const beam = new Mesh(beamGeo, beamMaterial());
  root.add(beam);

  // ---- floating stadium ----
  const stadium = new Group();
  stadium.position.y = FLOAT_Y;
  const pitch = new Mesh(new PlaneGeometry(PITCH_W, PITCH_D), pitchMaterial());
  pitch.rotation.x = -Math.PI / 2;
  stadium.add(pitch);
  const lines = new LineSegments(pitchLines(), holoLineMaterial({ colorA: PALETTE.neon, colorB: PALETTE.lime }));
  lines.position.y = 0.002;
  stadium.add(lines);
  const bowlGeo = bowlGeometry();
  stadium.add(new Mesh(bowlGeo, holoSurfaceMaterial({ color: PALETTE.cyan, opacity: 0.32 })));
  stadium.add(new LineSegments(bowlEdges(), holoLineMaterial({ colorA: PALETTE.cyan, colorB: PALETTE.neon, opacity: 0.55 })));
  root.add(stadium);

  // ---- motes ----
  const motesGeo = new BufferGeometry();
  const seeds = new Float32Array(maxParticles * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  motesGeo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
  motesGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(maxParticles * 3), 3));
  motesGeo.boundingSphere = null;
  const motes = new Points(motesGeo, motesMaterial());
  motes.frustumCulled = false;
  root.add(motes);

  return {
    root, stadium, rings, beam, pitch, motes,
    setParticleCount(n) { motesGeo.setDrawRange(0, Math.min(n, maxParticles)); },
    /** Per-frame idle motion. dt in seconds. */
    tick(dt) {
      rings[0].rotation.z += dt * 0.25;
      rings[1].rotation.z -= dt * 0.45;
      rings[2].rotation.z += dt * 0.8;
      stadium.rotation.y += dt * 0.12;
    },
  };
}

/** Pitch markings as line segments in the XZ plane (y = 0). */
function pitchLines() {
  const P = [];
  const w = PITCH_W / 2, d = PITCH_D / 2;
  const seg = (x1, z1, x2, z2) => P.push(x1, 0, z1, x2, 0, z2);
  const rect = (x1, z1, x2, z2) => { seg(x1, z1, x2, z1); seg(x2, z1, x2, z2); seg(x2, z2, x1, z2); seg(x1, z2, x1, z1); };
  const arc = (cx, cz, r, a0, a1, n = 32) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      seg(cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r);
    }
  };
  const m = PITCH_W / 105; // metres -> units
  rect(-w, -d, w, d);
  seg(0, -d, 0, d);
  arc(0, 0, 9.15 * m, 0, Math.PI * 2, 48);
  for (const s of [-1, 1]) {
    rect(s * w, -20.16 * m, s * (w - 16.5 * m), 20.16 * m); // penalty area
    rect(s * w, -9.16 * m, s * (w - 5.5 * m), 9.16 * m); // goal area
    const px = s * (w - 11 * m);
    const half = Math.acos(5.5 / 9.15);
    arc(px, 0, 9.15 * m, s > 0 ? Math.PI - half : -half, s > 0 ? Math.PI + half : half, 16); // penalty arc
    rect(s * w, -3.66 * m, s * (w + 2 * m), 3.66 * m); // goal
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(P, 3));
  return g;
}

/** Elliptical bowl around the pitch: TIERS rows rising outward, as one triangle strip mesh. */
const SEGMENTS = 48;
const TIERS = [
  { rx: 1.3, rz: 0.92, y: 0.0 },
  { rx: 1.55, rz: 1.12, y: 0.2 },
  { rx: 1.78, rz: 1.32, y: 0.42 },
  { rx: 1.92, rz: 1.46, y: 0.58 },
];
function ringPoint(t, i) {
  const a = (i / SEGMENTS) * Math.PI * 2;
  // squircle-ish ellipse so the stands follow the pitch shape
  const c = Math.cos(a), s = Math.sin(a);
  const k = 0.6;
  const x = Math.sign(c) * Math.abs(c) ** k * t.rx;
  const z = Math.sign(s) * Math.abs(s) ** k * t.rz;
  return [x, t.y, z];
}
function bowlGeometry() {
  const pos = [];
  const idx = [];
  for (const t of TIERS) for (let i = 0; i < SEGMENTS; i++) pos.push(...ringPoint(t, i));
  for (let r = 0; r < TIERS.length - 1; r++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = r * SEGMENTS + i, b = r * SEGMENTS + ((i + 1) % SEGMENTS);
      const c = a + SEGMENTS, d = b + SEGMENTS;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function bowlEdges() {
  const P = [];
  for (const t of TIERS) {
    for (let i = 0; i < SEGMENTS; i++) P.push(...ringPoint(t, i), ...ringPoint(t, (i + 1) % SEGMENTS));
  }
  for (let i = 0; i < SEGMENTS; i += 3) {
    for (let r = 0; r < TIERS.length - 1; r++) P.push(...ringPoint(TIERS[r], i), ...ringPoint(TIERS[r + 1], i));
  }
  // floodlight masts at the four corners
  for (const a of [0.12, 0.38, 0.62, 0.88]) {
    const i = Math.round(a * SEGMENTS) % SEGMENTS;
    const [x, y, z] = ringPoint(TIERS[TIERS.length - 1], i);
    P.push(x, y, z, x * 1.04, y + 0.45, z * 1.04);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(P, 3));
  return g;
}
