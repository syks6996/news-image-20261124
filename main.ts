// news-image-20261124: draws the day's news as one 1024x1024 PNG, with code only.
// Node 22 standard library only: a hand-written 5x7 bitmap font, a small raster
// canvas, and a minimal PNG encoder (zlib deflate + CRC32). No network, no
// randomness, no time: two runs write byte-identical files.
//
// The day: Tuesday 24 November 2026. Six stories, verified against the day's
// news roundups (Just Security Early Edition, The Global Eye, One Turn, Principia):
//   1. Houthis strike Riyadh's tallest tower, 2nd time in 5 days, 11 hurt
//   2. Russia warns Estonia its border-closure plan risks open war
//   3. Israeli strike in Gaza kills Hamas security chief Naeem Abu Nahel + 6
//   4. COP31 climate summit ends with no deal over fossil fuels
//   5. Nvidia reinstates Jensen Huang as CEO after Trump intervened
//   6. Senegal reinstated as 2025 Africa Cup of Nations champions by court
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 cells; '#' is ink, '.' is blank.
// All image text is uppercase, so only capitals, digits and punctuation live
// here; lowercase input is upper-cased by the text routine.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};

// Digits and punctuation (same 5x7 grid).
Object.assign(FONT, {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  ';': ['.....', '..#..', '.....', '.....', '..#..', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '#..#.', '#...#'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '•': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '°': ['.###.', '#...#', '.###.', '.....', '.....', '.....', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
});

// ---------------------------------------------------------------------------
// Minimal PNG encoder: 8-bit RGB, no filter, zlib level 9 (deterministic).
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(rgb: Buffer): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Raster canvas over one RGB buffer.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

const buf = Buffer.alloc(W * H * 3);

function px(x: number, y: number, c: RGB): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const o = (iy * W + ix) * 3;
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
}

function fill(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++, o += 3) {
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
    }
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    fill(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const outer = Math.sqrt(r * r - dy * dy);
    const inner = Math.sqrt(Math.max(0, (r - t) * (r - t) - dy * dy));
    for (let dx = -Math.floor(outer); dx <= Math.floor(outer); dx++) {
      if (Math.abs(dx) >= inner) px(cx + dx, cy + dy, c);
    }
  }
}

function tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: RGB): void {
  const minY = Math.max(0, Math.ceil(Math.min(y1, y2, y3)));
  const maxY = Math.min(H - 1, Math.floor(Math.max(y1, y2, y3)));
  const pts: [number, number][] = [[x1, y1], [x2, y2], [x3, y3]].sort((a, b) => a[1] - b[1]);
  const [ax, ay] = pts[0];
  const [bx, by] = pts[1];
  const [cx, cy] = pts[2];
  for (let y = minY; y <= maxY; y++) {
    const t1 = ay === cy ? 0 : (y - ay) / (cy - ay);
    const t2 = ay === by ? 0 : (y - ay) / (by - ay);
    const t3 = by === cy ? 0 : (y - by) / (cy - by);
    const xa = ax + (cx - ax) * t1;
    const xb = y <= by ? ax + (bx - ax) * t2 : bx + (cx - bx) * t3;
    fill(Math.min(xa, xb), y, Math.abs(xb - xa) + 1, 1, c);
  }
}

function line(x1: number, y1: number, x2: number, y2: number, c: RGB, th = 1): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fill(x1 + dx * t - th / 2, y1 + dy * t - th / 2, th, th, c);
  }
}

// ---------------------------------------------------------------------------
// Text. One glyph cell is 6 wide (5 + 1 gap) by 7 tall, times the scale.
// ---------------------------------------------------------------------------
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function text(s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') fill(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function textCenter(s: string, cx: number, y: number, scale: number, c: RGB): void {
  text(s, cx - textWidth(s, scale) / 2, y, scale, c);
}

// ---------------------------------------------------------------------------
// Colours and layout.
// ---------------------------------------------------------------------------
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [22, 22, 26];
const NAVY: RGB = [18, 32, 62];
const RED: RGB = [178, 34, 34];
const GOLD: RGB = [212, 175, 106];
const GRAY: RGB = [96, 96, 106];
const WHITE: RGB = [255, 255, 255];
const BORDER: RGB = [205, 200, 188];
const RULE: RGB = [220, 215, 205];

// ---------------------------------------------------------------------------
// Small drawn icons, each inside an 84x84 box at (ox, oy).
// ---------------------------------------------------------------------------
function iconTower(ox: number, oy: number): void {
  const navy: RGB = [24, 42, 80];
  const orange: RGB = [230, 110, 30];
  // burst at the top
  circle(ox + 42, oy + 14, 9, orange);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(ox + 42 + Math.cos(a) * 11, oy + 14 + Math.sin(a) * 11, ox + 42 + Math.cos(a) * 20, oy + 14 + Math.sin(a) * 20, orange, 3);
  }
  // spire + tower body
  tri(ox + 42, oy + 22, ox + 30, oy + 36, ox + 54, oy + 36, navy);
  fill(ox + 28, oy + 36, 28, 48, navy);
  // lit windows
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) fill(ox + 33 + c * 12, oy + 44 + r * 10, 5, 5, GOLD);
}

function iconWarning(ox: number, oy: number): void {
  const yellow: RGB = [240, 200, 40];
  tri(ox + 42, oy + 8, ox + 6, oy + 76, ox + 78, oy + 76, yellow);
  line(ox + 42, oy + 8, ox + 6, oy + 76, INK, 4);
  line(ox + 6, oy + 76, ox + 78, oy + 76, INK, 4);
  line(ox + 78, oy + 76, ox + 42, oy + 8, INK, 4);
  fill(ox + 39, oy + 32, 6, 26, INK);
  circle(ox + 42, oy + 66, 4, INK);
}

function iconSmoke(ox: number, oy: number): void {
  const gray: RGB = [150, 150, 155];
  const dark: RGB = [110, 110, 120];
  circle(ox + 30, oy + 26, 8, gray);
  circle(ox + 44, oy + 18, 10, gray);
  circle(ox + 58, oy + 28, 7, gray);
  fill(ox + 16, oy + 38, 52, 46, dark);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) fill(ox + 22 + c * 12, oy + 44 + r * 12, 6, 6, [70, 70, 80]);
  tri(ox + 28, oy + 84, ox + 56, oy + 84, ox + 42, oy + 62, [230, 110, 30]);
}

function iconGlobe(ox: number, oy: number): void {
  const blue: RGB = [40, 110, 180];
  const green: RGB = [60, 160, 90];
  circle(ox + 42, oy + 42, 34, blue);
  circle(ox + 30, oy + 32, 10, green);
  circle(ox + 54, oy + 50, 12, green);
  circle(ox + 36, oy + 56, 7, green);
  ring(ox + 42, oy + 42, 34, 3, WHITE);
}

function iconChip(ox: number, oy: number): void {
  const dark: RGB = [30, 30, 36];
  const mid: RGB = [70, 70, 82];
  const green: RGB = [30, 160, 70];
  // pins
  for (let i = 0; i < 4; i++) {
    fill(ox + 18 + i * 11, oy + 20, 5, 6, INK);
    fill(ox + 18 + i * 11, oy + 62, 5, 6, INK);
    fill(ox + 8, oy + 30 + i * 9, 6, 5, INK);
    fill(ox + 62, oy + 30 + i * 9, 6, 5, INK);
  }
  fill(ox + 14, oy + 26, 44, 36, dark);
  fill(ox + 26, oy + 36, 20, 16, mid);
  // green up arrow
  tri(ox + 70, oy + 26, ox + 60, oy + 44, ox + 80, oy + 44, green);
  fill(ox + 67, oy + 42, 6, 16, green);
}

function iconTrophy(ox: number, oy: number): void {
  const gold: RGB = [212, 175, 55];
  fill(ox + 20, oy + 14, 44, 8, gold);
  tri(ox + 22, oy + 22, ox + 62, oy + 22, ox + 42, oy + 52, gold);
  fill(ox + 12, oy + 22, 8, 14, gold);
  fill(ox + 64, oy + 22, 8, 14, gold);
  fill(ox + 39, oy + 52, 6, 14, gold);
  fill(ox + 28, oy + 66, 28, 8, gold);
}

// ---------------------------------------------------------------------------
// One story panel: 480 x 252.
// ---------------------------------------------------------------------------
interface Story {
  color: RGB;
  kicker: string;
  head: [string, string];
  sub: [string, string];
  place: string;
  icon: (ox: number, oy: number) => void;
}

function panel(x: number, y: number, s: Story): void {
  const w = 480;
  const h = 252;
  fill(x, y, w, h, BORDER);
  fill(x + 2, y + 2, w - 4, h - 4, WHITE);
  fill(x + 2, y + 2, w - 4, 10, s.color);
  text(s.kicker, x + 18, y + 26, 3, s.color);
  s.icon(x + 376, y + 22);
  text(s.head[0], x + 18, y + 62, 5, INK);
  text(s.head[1], x + 18, y + 104, 5, INK);
  text(s.sub[0], x + 18, y + 152, 3, GRAY);
  text(s.sub[1], x + 18, y + 180, 3, GRAY);
  fill(x + 18, y + 214, w - 36, 2, RULE);
  text(s.place, x + 18, y + 226, 2, s.color);
}

const STORIES: Story[] = [
  {
    color: [168, 50, 38],
    kicker: 'MIDDLE EAST',
    head: ['RIYADH TOWER', 'HIT AGAIN'],
    sub: ['HOUTHIS STRIKE TALLEST', 'TOWER, 11 HURT'],
    place: 'RIYADH, SAUDI ARABIA',
    icon: iconTower,
  },
  {
    color: [26, 82, 118],
    kicker: 'EUROPE • NATO',
    head: ['RUSSIA WARNS', 'ESTONIA'],
    sub: ['BORDER CLOSURE PLAN', 'RISKS OPEN WAR'],
    place: 'TALLINN, ESTONIA',
    icon: iconWarning,
  },
  {
    color: [108, 52, 131],
    kicker: 'GAZA',
    head: ['HAMAS CHIEF', 'KILLED'],
    sub: ['ISRAELI STRIKE KILLS', 'NAEEM ABU NAHEL + 6'],
    place: 'GAZA',
    icon: iconSmoke,
  },
  {
    color: [30, 132, 73],
    kicker: 'CLIMATE • COP31',
    head: ['CLIMATE', 'SUMMIT FAILS'],
    sub: ['TALKS FAIL OVER', 'FOSSIL FUELS'],
    place: 'GLOBAL',
    icon: iconGlobe,
  },
  {
    color: [17, 122, 101],
    kicker: 'TECH • MARKETS',
    head: ['HUANG BACK', 'AT NVIDIA'],
    sub: ['CEO REINSTATED AFTER', 'TRUMP INTERVENED'],
    place: 'SANTA CLARA, USA',
    icon: iconChip,
  },
  {
    color: [202, 111, 30],
    kicker: 'SPORT • AFRICA',
    head: ['SENEGAL ARE', 'CHAMPIONS'],
    sub: ['COURT RESTORES 2025', 'AFCON TITLE'],
    place: 'DAKAR, SENEGAL',
    icon: iconTrophy,
  },
];

// ---------------------------------------------------------------------------
// Compose the page and write it.
// ---------------------------------------------------------------------------
function build(): void {
  fill(0, 0, W, H, PAPER);
  // Masthead
  fill(0, 0, W, 150, NAVY);
  textCenter('24 NOVEMBER 2026', W / 2, 26, 8, WHITE);
  textCenter('TUESDAY • THE WORLD IN ONE DAY', W / 2, 98, 4, GOLD);
  fill(0, 150, W, 8, RED);
  // Story grid: 2 columns x 3 rows
  const xs = [24, 520];
  const ys = [178, 446, 714];
  for (let i = 0; i < STORIES.length; i++) {
    panel(xs[i % 2], ys[Math.floor(i / 2)], STORIES[i]);
  }
  // Footer
  textCenter('REPORTED 24 NOVEMBER 2026 • AP • REUTERS • BBC', W / 2, 984, 3, GRAY);
}

build();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
writeFileSync(join(outDir, 'entry.png'), encodePNG(buf));
