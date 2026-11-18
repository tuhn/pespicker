// Card faces drawn into 512x768 canvases, uploaded once as CanvasTextures before the timeline runs.
//
// Why CanvasTexture (not a DOM overlay) for text on the 3D card: the card spins, tilts and carries a
// foil shader, so its text has to live in the texture to move with the surface. The canvas is drawn
// with the same inlined webfont (Chakra Petch, Latin + Latin Extended) so names like Curaçao or
// Türkiye render correctly; 512x768 with mipmaps + anisotropy stays sharp at the on-screen card size
// (about 150-330 CSS px wide at DPR 2). The final results screen repeats team name / player name / lock
// in crisp DOM text next to each card, so nothing important depends on texture sharpness alone.
import { FLAGS, LOGOS } from 'virtual:assets';
import { SHOW_CLUB_LOGOS } from '../config.js';
import { S } from '../ui/strings.js';

export const CARD_W = 512;
export const CARD_H = 768;
const FONT = "'Chakra Petch', system-ui, sans-serif";

export const TIER_COLORS = { 5: '#ffd76a', 4: '#dfe7ef', 3: '#e0a070', 0: '#8ab8ff' };
export function tierKey(stars) {
  if (stars == null) return 0;
  if (stars >= 5) return 5;
  if (stars >= 4) return 4;
  if (stars >= 3) return 3;
  return 0;
}

const imageCache = new Map();
/** Decode a data URI image once (decoded before any animation starts). */
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) {
    const img = new Image();
    img.src = src;
    imageCache.set(src, img.decode().then(() => img, () => null));
  }
  return imageCache.get(src);
}

export async function ensureFonts() {
  try {
    await Promise.all([document.fonts.load(`700 56px ${FONT}`), document.fonts.load(`500 28px ${FONT}`), document.fonts.load(`700 56px ${FONT}`, 'çüéôÇÜ')]);
  } catch { /* system font fallback */ }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Largest size <= `size` (and >= minSize) at which text fits maxW. Width scales linearly with size. */
function fitText(ctx, text, maxW, size, minSize, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  const s = w > maxW ? Math.max(minSize, Math.floor((size * maxW) / w)) : size;
  if (s !== size) ctx.font = `${weight} ${s}px ${FONT}`;
  return s;
}

/** Split into at most 2 lines that each fit maxW at the largest possible size. */
function layoutName(ctx, name, maxW) {
  const one = fitText(ctx, name, maxW, 64, 44);
  if (ctx.measureText(name).width <= maxW) return { lines: [name], size: one };
  const words = name.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const sa = fitText(ctx, a, maxW, 54, 30), sb = fitText(ctx, b, maxW, 54, 30);
    const s = Math.min(sa, sb);
    if (!best || s > best.size) best = { lines: [a, b], size: s };
  }
  return best || { lines: [name], size: fitText(ctx, name, maxW, 54, 26) };
}

/**
 * Draw the front face. entry: pool entry; side 0/1; name: player label.
 * Images must already be decoded (see prepareImages) so this stays synchronous.
 */
export function drawFront(canvas, entry, side, name, images) {
  const ctx = canvas.getContext('2d');
  const { team, rating } = entry;
  const tier = TIER_COLORS[tierKey(entry.stars)];
  const [c1, c2] = team.colors || ['#2a4a3c', '#f3fff8'];
  const accent = side === 0 ? '#78ff9a' : '#5cf2ff';
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  roundRect(ctx, 4, 4, CARD_W - 8, CARD_H - 8, 40);
  ctx.clip();
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#12352a');
  bg.addColorStop(1, '#06140f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // team colour sweep
  const sweep = ctx.createLinearGradient(0, 0, CARD_W, CARD_H * 0.6);
  sweep.addColorStop(0, hexA(c1, 0.55));
  sweep.addColorStop(0.55, hexA(c1, 0.0));
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = hexA(c2, 0.25);
  ctx.beginPath(); ctx.moveTo(CARD_W, 0); ctx.lineTo(CARD_W, 160); ctx.lineTo(CARD_W - 220, 0); ctx.fill();
  // fine scanlines
  ctx.fillStyle = 'rgba(120,255,154,0.035)';
  for (let y = 0; y < CARD_H; y += 4) ctx.fillRect(0, y, CARD_W, 1);
  ctx.restore();

  // tier frame
  roundRect(ctx, 8, 8, CARD_W - 16, CARD_H - 16, 36);
  ctx.lineWidth = 8; ctx.strokeStyle = tier; ctx.stroke();
  roundRect(ctx, 22, 22, CARD_W - 44, CARD_H - 44, 26);
  ctx.lineWidth = 2; ctx.strokeStyle = hexA(tier, 0.35); ctx.stroke();

  // player chip
  ctx.font = `700 28px ${FONT}`;
  const label = name.toUpperCase();
  const pw = Math.min(CARD_W - 120, ctx.measureText(label).width + 44);
  roundRect(ctx, (CARD_W - pw) / 2, 36, pw, 48, 14);
  ctx.fillStyle = accent; ctx.fill();
  ctx.fillStyle = '#07130f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, label, pw - 30, 28, 18);
  ctx.fillText(label, CARD_W / 2, 61);

  // OVR column
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = tier;
  ctx.font = `700 128px ${FONT}`;
  ctx.shadowColor = hexA(tier, 0.5); ctx.shadowBlur = 18;
  ctx.fillText(entry.ovr != null ? String(entry.ovr) : '—', 40, 230);
  ctx.shadowBlur = 0;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = '#a8b9b0';
  ctx.fillText(S.stats.ovr, 46, 266);
  if (rating?.estimated) { ctx.fillStyle = '#5cf2ff'; ctx.fillText(S.est, 112, 266); }

  // emblem
  const ex = 340, ey = 196;
  if (team.type === 'national' && images.flag) {
    const w = 236, hgt = 177;
    ctx.save();
    roundRect(ctx, ex - w / 2, ey - hgt / 2, w, hgt, 14); ctx.clip();
    ctx.drawImage(images.flag, ex - w / 2, ey - hgt / 2, w, hgt);
    ctx.restore();
    roundRect(ctx, ex - w / 2, ey - hgt / 2, w, hgt, 14);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  } else if (images.logo) {
    // light plate so dark crests (e.g. Juventus) stay visible on the dark card
    const g = ctx.createRadialGradient(ex, ey, 10, ex, ey, 118);
    g.addColorStop(0, 'rgba(243,255,248,0.97)'); g.addColorStop(0.85, 'rgba(214,232,222,0.9)'); g.addColorStop(1, 'rgba(214,232,222,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 118, 0, Math.PI * 2); ctx.fill();
    const s = 170 / Math.max(images.logo.naturalWidth || 1, images.logo.naturalHeight || 1);
    const lw = (images.logo.naturalWidth || 170) * s, lh = (images.logo.naturalHeight || 170) * s;
    ctx.drawImage(images.logo, ex - lw / 2, ey - lh / 2, lw, lh);
    if (images.flag) {
      ctx.save(); roundRect(ctx, ex + 52, ey + 66, 64, 48, 6); ctx.clip();
      ctx.drawImage(images.flag, ex + 52, ey + 66, 64, 48); ctx.restore();
      roundRect(ctx, ex + 52, ey + 66, 64, 48, 6); ctx.lineWidth = 4; ctx.strokeStyle = '#07130f'; ctx.stroke();
    }
  } else {
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(ex, ey, 100, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
    ctx.fillStyle = c2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, team.shortName || team.name.slice(0, 3), 160, 64, 30);
    ctx.fillText(team.shortName || team.name.slice(0, 3).toUpperCase(), ex, ey + 4);
  }

  // name
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#f3fff8';
  const nl = layoutName(ctx, team.name, CARD_W - 80);
  ctx.font = `700 ${nl.size}px ${FONT}`;
  const nameY = nl.lines.length === 1 ? 392 : 372;
  nl.lines.forEach((l, i) => ctx.fillText(l, CARD_W / 2, nameY + i * (nl.size + 4)));
  const sub = team.type === 'club' ? [team.league, team.country].filter(Boolean).join(' · ') : team.region;
  ctx.fillStyle = '#a8b9b0';
  fitText(ctx, sub || '', CARD_W - 90, 26, 18, 500);
  ctx.fillText(sub || '', CARD_W / 2, nl.lines.length === 1 ? 440 : 470);

  // stars
  const starY = 530;
  if (entry.stars != null) {
    // Five glyphs, centred; half stars are clipped at the glyph's real width. No numeric label.
    ctx.font = `56px ${FONT}`;
    ctx.textAlign = 'center';
    const step = 64;
    const x0 = CARD_W / 2 - step * 2;
    const gw = ctx.measureText('★').width;
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * step;
      ctx.fillStyle = 'rgba(168,185,176,0.28)';
      ctx.fillText('★', x, starY);
      const fill = Math.max(0, Math.min(1, entry.stars - i));
      if (fill > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(x - gw / 2, starY - 60, gw * fill, 72); ctx.clip();
        ctx.fillStyle = tier; ctx.fillText('★', x, starY); ctx.restore();
      }
    }
  } else {
    ctx.font = `700 30px ${FONT}`; ctx.fillStyle = '#a8b9b0'; ctx.fillText(S.noStars, CARD_W / 2, starY);
  }

  // divider + stats
  ctx.fillStyle = hexA(tier, 0.4); ctx.fillRect(56, 572, CARD_W - 112, 2);
  const stats = ['att', 'mid', 'def'];
  if (stats.some((k) => rating?.[k] != null)) {
    stats.forEach((k, i) => {
      const x = 110 + i * 146;
      ctx.fillStyle = '#a8b9b0'; ctx.font = `700 24px ${FONT}`; ctx.fillText(S.stats[k], x, 622);
      ctx.fillStyle = '#f3fff8'; ctx.font = `700 60px ${FONT}`; ctx.fillText(rating[k] != null ? String(rating[k]) : '—', x, 684);
    });
  } else {
    ctx.fillStyle = '#5cf2ff'; ctx.font = `700 26px ${FONT}`;
    ctx.fillText(rating?.estimated ? S.estTitle.toUpperCase() : '', CARD_W / 2, 650);
  }
  ctx.fillStyle = 'rgba(168,185,176,0.5)'; ctx.font = `700 18px ${FONT}`;
  ctx.fillText(S.appTitle.toUpperCase(), CARD_W / 2, 735);
}

/** Shared hologram back face, drawn once. */
export function drawBack(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  roundRect(ctx, 4, 4, CARD_W - 8, CARD_H - 8, 40); ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#0b2a22'); bg.addColorStop(0.5, '#05211b'); bg.addColorStop(1, '#0a1f2c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_W, CARD_H);
  // hex grid
  ctx.strokeStyle = 'rgba(92,242,255,0.12)'; ctx.lineWidth = 2;
  const r = 34;
  for (let row = -1; row < CARD_H / (r * 1.5) + 1; row++) {
    for (let col = -1; col < CARD_W / (r * 1.732) + 1; col++) {
      const cx = col * r * 1.732 + (row % 2 ? r * 0.866 : 0), cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.closePath(); ctx.stroke();
    }
  }
  // concentric rings + logo
  const cx = CARD_W / 2, cy = CARD_H / 2;
  for (const [rad, col, w] of [[150, 'rgba(120,255,154,0.55)', 4], [118, 'rgba(92,242,255,0.4)', 2], [86, 'rgba(200,255,83,0.5)', 3]]) {
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  }
  ctx.fillStyle = '#78ff9a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 54px ${FONT}`; ctx.fillText('TEAM', cx, cy - 26);
  ctx.fillStyle = '#5cf2ff'; ctx.fillText('DRAW', cx, cy + 30);
  ctx.fillStyle = 'rgba(120,255,154,0.04)';
  for (let y = 0; y < CARD_H; y += 3) ctx.fillRect(0, y, CARD_W, 1);
  ctx.restore();
  roundRect(ctx, 8, 8, CARD_W - 16, CARD_H - 16, 36);
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(92,242,255,0.75)'; ctx.stroke();
}

/** VS plate, drawn once. */
export function drawVs(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(200,255,83,0.95)'); g.addColorStop(0.62, 'rgba(120,255,154,0.95)'); g.addColorStop(0.64, 'rgba(7,19,15,1)'); g.addColorStop(0.72, 'rgba(7,19,15,1)'); g.addColorStop(0.73, 'rgba(120,255,154,0.6)'); g.addColorStop(1, 'rgba(120,255,154,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#07130f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(W * 0.34)}px ${FONT}`;
  ctx.fillText(S.vs, W / 2, H / 2 + W * 0.02);
}

/** Decode the flag/logo a card needs. */
export async function prepareImages(team) {
  const [flag, logo] = await Promise.all([
    loadImage(FLAGS[team.flagIso]),
    team.type === 'club' && SHOW_CLUB_LOGOS ? loadImage(LOGOS[team.id]) : null,
  ]);
  return { flag, logo };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
