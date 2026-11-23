/**
 * Small, dependency-free image analysis used by the ID / face camera.
 * Everything runs on the device; nothing here sends pixels anywhere.
 */

export interface Gray {
  w: number
  h: number
  d: Float32Array
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** RGBA ImageData -> grayscale (0..255) */
export function toGray(img: ImageData): Gray {
  const { width: w, height: h, data } = img
  const d = new Float32Array(w * h)
  for (let i = 0, p = 0; i < d.length; i++, p += 4) {
    d[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return { w, h, d }
}

function clampRect(g: Gray, r?: Rect): Rect {
  if (!r) return { x: 0, y: 0, w: g.w, h: g.h }
  const x = Math.max(0, Math.floor(r.x))
  const y = Math.max(0, Math.floor(r.y))
  return { x, y, w: Math.max(1, Math.min(g.w - x, Math.floor(r.w))), h: Math.max(1, Math.min(g.h - y, Math.floor(r.h))) }
}

/** Variance of the Laplacian: higher = sharper. Blurry photos score low. */
export function sharpness(g: Gray, region?: Rect): number {
  const r = clampRect(g, region)
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const i = y * g.w + x
      const lap = 4 * g.d[i] - g.d[i - 1] - g.d[i + 1] - g.d[i - g.w] - g.d[i + g.w]
      sum += lap
      sum2 += lap * lap
      n++
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return sum2 / n - mean * mean
}

export interface Exposure {
  mean: number
  /** share of nearly-white pixels (glare / reflections) */
  glare: number
  /** share of nearly-black pixels */
  dark: number
}

export function exposure(g: Gray, region?: Rect): Exposure {
  const r = clampRect(g, region)
  let sum = 0
  let hot = 0
  let black = 0
  const n = r.w * r.h
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const v = g.d[y * g.w + x]
      sum += v
      if (v >= 247) hot++
      else if (v <= 18) black++
    }
  }
  return { mean: sum / n, glare: hot / n, dark: black / n }
}

function smooth(a: Float32Array, k = 2): Float32Array {
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) {
    let s = 0
    let c = 0
    for (let j = -k; j <= k; j++) {
      const idx = i + j
      if (idx >= 0 && idx < a.length) {
        s += a[idx]
        c++
      }
    }
    out[i] = s / c
  }
  return out
}

function stats(a: Float32Array): { mean: number; std: number } {
  let s = 0
  for (const v of a) s += v
  const mean = s / a.length
  let v2 = 0
  for (const v of a) v2 += (v - mean) * (v - mean)
  return { mean, std: Math.sqrt(v2 / a.length) }
}

/** Positions that are local maxima of the profile and clearly above background. */
function peaks(p: Float32Array, from: number, to: number, threshold: number): { pos: number; val: number }[] {
  const out: { pos: number; val: number }[] = []
  for (let i = Math.max(1, from); i < Math.min(p.length - 1, to); i++) {
    if (p[i] >= threshold && p[i] >= p[i - 1] && p[i] >= p[i + 1]) out.push({ pos: i, val: p[i] })
  }
  return out
}

export interface CardBox extends Rect {
  /** 0..1: how strongly all four borders stood out */
  confidence: number
}

/**
 * Find a card-shaped object (a government ID) in a grayscale frame by looking for its four
 * straight borders: strong vertical edges on the left/right and horizontal edges on the top/bottom.
 * The outermost strong edge on each side is taken as the border.
 */
export function detectCard(g: Gray, rgba?: Uint8ClampedArray): CardBox | null {
  const { w, h, d } = g
  if (w < 40 || h < 30) return null

  const colProfile = new Float32Array(w)
  const rowProfile = new Float32Array(h)

  const y0 = Math.floor(h * 0.2)
  const y1 = Math.floor(h * 0.8)
  const x0 = Math.floor(w * 0.2)
  const x1 = Math.floor(w * 0.8)

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      let gx: number
      let gy: number
      if (rgba) {
        // colour edges: a dark blue header on a dark table has almost no brightness step but a clear colour step
        const a = (i + 1) * 4, b = (i - 1) * 4, c = (i + w) * 4, e = (i - w) * 4
        gx = (Math.abs(rgba[a] - rgba[b]) + Math.abs(rgba[a + 1] - rgba[b + 1]) + Math.abs(rgba[a + 2] - rgba[b + 2])) / 3
        gy = (Math.abs(rgba[c] - rgba[e]) + Math.abs(rgba[c + 1] - rgba[e + 1]) + Math.abs(rgba[c + 2] - rgba[e + 2])) / 3
      } else {
        gx = Math.abs(d[i + 1] - d[i - 1])
        gy = Math.abs(d[i + w] - d[i - w])
      }
      if (y >= y0 && y < y1) colProfile[x] += gx
      if (x >= x0 && x < x1) rowProfile[y] += gy
    }
  }

  // average edge strength per scanned pixel, so a threshold means "this much contrast" on any frame size
  const cp = smooth(colProfile).map(v => v / Math.max(1, y1 - y0))
  const rp = smooth(rowProfile).map(v => v / Math.max(1, x1 - x0))
  const cs = stats(cp)
  const rs = stats(rp)
  // a real card border is both a clear outlier in the frame AND a clearly visible contrast step
  const MIN_EDGE = 14
  // Busy interiors (lots of text) raise the mean/std of the profile, which would hide a low-contrast
  // outer border, so only an absolute contrast level is required here.
  void cs; void rs
  const ct = MIN_EDGE
  const rt = MIN_EDGE

  const pick = (ps: { pos: number; val: number }[], side: 'min' | 'max') => {
    if (!ps.length) return null
    const top = Math.max(...ps.map(p => p.val))
    const strong = ps.filter(p => p.val >= 0.03 * top)
    return side === 'min'
      ? strong.reduce((a, b) => (b.pos < a.pos ? b : a))
      : strong.reduce((a, b) => (b.pos > a.pos ? b : a))
  }

  const left = pick(peaks(cp, Math.floor(w * 0.02), Math.floor(w * 0.55), ct), 'min')
  const right = pick(peaks(cp, Math.floor(w * 0.45), Math.floor(w * 0.98), ct), 'max')
  const top = pick(peaks(rp, Math.floor(h * 0.02), Math.floor(h * 0.55), rt), 'min')
  const bottom = pick(peaks(rp, Math.floor(h * 0.45), Math.floor(h * 0.98), rt), 'max')
  if (!left || !right || !top || !bottom) return null

  const bw = right.pos - left.pos
  const bh = bottom.pos - top.pos
  if (bw < w * 0.2 || bh < h * 0.15) return null
  const aspect = bw / bh
  if (aspect < 1.25 || aspect > 2.1) return null // not card-shaped

  const conf = Math.min(1, Math.min(left.val / ct, right.val / ct, top.val / rt, bottom.val / rt) / 2)
  return { x: left.pos, y: top.pos, w: bw, h: bh, confidence: conf }
}

/** Map a rectangle measured in one coordinate space into another (uniform scale + offset). */
export function scaleRect(r: Rect, scaleX: number, scaleY: number, offX = 0, offY = 0): Rect {
  return { x: r.x * scaleX + offX, y: r.y * scaleY + offY, w: r.w * scaleX, h: r.h * scaleY }
}

/**
 * Where a <video> with object-fit: cover ends up inside its box, so analysis can be done in the
 * same coordinates the user sees (and the same crop is cut from the real frame).
 */
export function coverMapping(boxW: number, boxH: number, videoW: number, videoH: number) {
  const s = Math.max(boxW / videoW, boxH / videoH)
  return { s, ox: (boxW - videoW * s) / 2, oy: (boxH - videoH * s) / 2 }
}

/** Eye aspect ratio from 6 eye landmarks: drops sharply when the eye closes. */
export function eyeAspectRatio(p: { x: number; y: number }[]): number {
  if (p.length < 6) return 0
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * dist(p[0], p[3]) || 1)
}

export interface BlinkState {
  /** best (largest) eye-opening seen recently: the person's own "eyes open" level */
  open: number
  closed: boolean
}

/**
 * Feed one eye-aspect-ratio reading per frame. Returns true once a full blink was seen:
 * eyes clearly open -> clearly closed -> open again. Thresholds are relative to the person's own
 * open-eye level so it works for narrow and wide eyes alike.
 */
export function stepBlink(st: BlinkState, ear: number): boolean {
  if (!(ear > 0)) return false
  st.open = Math.max(st.open * 0.995, ear)
  if (ear < st.open * 0.74) {
    st.closed = true
    return false
  }
  return st.closed && ear > st.open * 0.85
}
