import { TILE, project } from '../geometry/project.ts'
import { disc } from '../view/draw.ts'
import { ART, NIGHT, box, cone, faces, hash3, light, mix, soft, type Paint } from './paint.ts'

/**
 * Vegetation kit (Visual polish, DECISIONS.md D73): trees, bushes and hedges built from clusters
 * of round lobes in three crisp tones (a shade rim toward the lower right, the body, sunlit caps
 * toward the top left) plus a few highlight specks, the way an illustrator paints foliage. Flat
 * fills, no gradients, so the shapes stay sharp and cheap. Species and the odd autumn or lime
 * tree are picked from a hash of the position, so the city's seeded RNG and layout never change.
 */

export type Species = 'round' | 'pine' | 'column'

/** The odd warm or bright tree among the greens (picked by hash, about one in seven). */
const ACCENT_TREES = [0xd9973a, 0xc8703f, 0x95c24e, 0xe0b84a] as const
const ACCENT_SHARE = 0.14

/** A screen-space ellipse polygon. */
function ellipse(x: number, y: number, rx: number, ry: number, n = 14): number[] {
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push(x + Math.cos(a) * rx, y + Math.sin(a) * ry)
  }
  return pts
}

/** One lobe of a canopy, in units of the canopy radius around its center. */
interface Lobe {
  x: number
  y: number
  r: number
}

/** Lobe layouts, back to front. `round`: a broad crown; `column`: a narrow, tall crown. */
const CROWNS: Record<'round' | 'column' | 'bush', readonly Lobe[]> = {
  round: [
    { x: -0.42, y: -0.18, r: 0.52 },
    { x: 0.4, y: -0.24, r: 0.5 },
    { x: 0, y: -0.5, r: 0.5 },
    { x: -0.5, y: 0.2, r: 0.46 },
    { x: 0.48, y: 0.22, r: 0.48 },
    { x: -0.02, y: 0.12, r: 0.62 },
  ],
  column: [
    { x: 0, y: -0.95, r: 0.36 },
    { x: -0.1, y: -0.5, r: 0.44 },
    { x: 0.12, y: -0.1, r: 0.46 },
    { x: -0.04, y: 0.3, r: 0.48 },
  ],
  bush: [
    { x: -0.5, y: 0.05, r: 0.5 },
    { x: 0.5, y: 0.08, r: 0.48 },
    { x: 0, y: -0.15, r: 0.58 },
    { x: 0.02, y: 0.22, r: 0.5 },
  ],
}

/**
 * A canopy of lobes centered on (col, row, z), `r` board units across: a shade layer offset to
 * the lower right, the body, then sunlit caps on the upper lobes and a few specks. `seed` varies
 * the lobes a little so neighbors never look stamped.
 */
export function canopy(
  p: Paint,
  col: number,
  row: number,
  z: number,
  r: number,
  color: number,
  crown: keyof typeof CROWNS = 'round',
): void {
  const c = project({ col, row, z }, p.t)
  const px = r * TILE.w * 0.5
  const seed = hash3(col, row, z)
  const f = faces(color, p.style)
  const shade = mix(f.right, p.style.shadow, 0.25)
  const lit = light(color, 0.2)
  const spark = light(color, 0.42)
  const lobes = CROWNS[crown].map((l, i) => {
    const j = hash3(seed * 97 + i, col, row)
    return { x: c.x + (l.x + (j - 0.5) * 0.12) * px, y: c.y + l.y * px, r: l.r * px * (0.92 + j * 0.16) }
  })
  for (const l of lobes) p.g.poly(ellipse(l.x + l.r * 0.12, l.y + l.r * 0.14, l.r, l.r * 0.94)).fill(shade)
  for (const l of lobes)
    p.g.poly(ellipse(l.x - l.r * 0.04, l.y - l.r * 0.05, l.r * 0.9, l.r * 0.85)).fill(color)
  // Sunlit caps on the upper half of the crown, then specks of leaf light.
  const top = Math.min(...lobes.map((l) => l.y))
  const bottom = Math.max(...lobes.map((l) => l.y))
  for (const l of lobes) {
    if (l.y > top + (bottom - top) * 0.6) continue
    p.g.poly(ellipse(l.x - l.r * 0.28, l.y - l.r * 0.3, l.r * 0.5, l.r * 0.42, 12)).fill(lit)
  }
  if (px < 3) return
  for (let i = 0; i < 3; i++) {
    const l = lobes[Math.floor(hash3(seed, i, 7) * lobes.length)]!
    const a = -2.2 + hash3(seed, i, 3) * 1.2
    p.g
      .poly(ellipse(l.x + Math.cos(a) * l.r * 0.5, l.y + Math.sin(a) * l.r * 0.5, px * 0.07, px * 0.06, 8))
      .fill(spark)
  }
}

/** Soft round shadow on the ground, cast toward +col (screen lower right). */
function groundShadow(p: Paint, col: number, row: number, z: number, r: number): void {
  if (!ART.rich) return
  soft(p.g, disc(col + r * 0.35, row + r * 0.12, r * 1.15, z + 0.001, p.t, 18), p.style.shadow, 0.5)
}

/** Picks a species and color for a tree at a spot: mostly the given green, sometimes an accent. */
export function treeColor(col: number, row: number, color: number): number {
  const k = hash3(col * 3.1, row * 2.7, 11)
  return k < ACCENT_SHARE ? ACCENT_TREES[Math.floor((k / ACCENT_SHARE) * ACCENT_TREES.length)]! : color
}

/**
 * A tree sized by `s` (about 0.08 to 0.25): trunk plus a lobed crown, a tiered pine, or a slim
 * column. `pine` keeps the old callers' choice; otherwise a hash picks round or column.
 */
export function tree(p: Paint, col: number, row: number, z: number, s: number, color: number, pine = false) {
  const species: Species = pine ? 'pine' : hash3(col, row, 5) < 0.18 ? 'column' : 'round'
  const tint = pine ? color : treeColor(col, row, color)
  groundShadow(p, col, row, z, s * (species === 'round' ? 0.75 : 0.5))
  const trunk = species === 'column' ? s * 0.3 : s * 0.5
  box(
    p,
    { col0: col - 0.014, row0: row - 0.014, col1: col + 0.014, row1: row + 0.014, z0: z, z1: z + trunk },
    p.style.trunk,
  )
  if (!ART.rich) {
    if (pine) cone(p, col, row, s * 0.55, z + s * 0.35, z + s * 2.2, color)
    else blob(p, col, row, z + s * 1.15, s * 0.62, color)
    return
  }
  if (species === 'pine') {
    // Three tiers, each a little narrower and lighter; the top one ends in a point.
    const base = light(color, 0.08)
    for (const [k, w] of [
      [0, 0.6],
      [0.42, 0.47],
      [0.8, 0.33],
    ] as const)
      cone(p, col, row, s * w, z + s * (0.25 + k), z + s * (0.95 + k), light(base, k * 0.1))
    return
  }
  if (species === 'column') canopy(p, col, row, z + s * 1.0, s * 0.6, tint, 'column')
  else canopy(p, col, row, z + s * 0.82, s * 0.95, tint)
}

/** A low bush, `s` across (about 0.05 to 0.12), sitting on the ground at z. */
export function bush(p: Paint, col: number, row: number, z: number, s: number, color: number): void {
  groundShadow(p, col, row, z, s * 0.6)
  canopy(p, col, row, z + s * 0.35, s * 0.7, color, 'bush')
}

/** A trimmed hedge from (c0, r0) to (c1, r1): a row of overlapping bush lobes, drawn back to front. */
export function hedge(
  p: Paint,
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  z: number,
  color: number,
): void {
  const len = Math.hypot(c1 - c0, r1 - r0)
  const n = Math.max(2, Math.round(len / 0.05))
  for (let i = 0; i <= n; i++) {
    const k = i / n
    bush(p, c0 + (c1 - c0) * k, r0 + (r1 - r0) * k, z, 0.075, color)
  }
}

/**
 * A knee-high garden light among trees: a short post by day; at night a warm pool on the grass.
 * It does not start its own lights part (no `mark`, unlike a street lamp), so its glow may spill
 * over the foliage in front of it, which reads as lit leaves and saves draw calls.
 */
export function gardenLight(p: Paint, col: number, row: number, z: number): void {
  box(
    p,
    { col0: col - 0.01, row0: row - 0.01, col1: col + 0.01, row1: row + 0.01, z0: z, z1: z + 0.06 },
    0x475569,
  )
  const lights = p.lights
  if (!lights) return
  soft(lights, disc(col, row, 0.3, z + 0.002, p.t, 20), NIGHT.lamp, 0.5)
  soft(lights, disc(col, row, 0.05, z + 0.06, p.t, 12), 0xfff4d6, 0.9)
}

/**
 * Round low-poly canopy floating at height z (kept for small props: flower heads, topiary, the
 * fountain spray): a shade crescent, the body, and a sunlit cap toward the top left.
 */
export function blob(p: Paint, col: number, row: number, z: number, r: number, color: number) {
  const c = project({ col, row, z }, p.t)
  const px = r * TILE.w * 0.5
  const f = faces(color, p.style)
  p.g.poly(ellipse(c.x + px * 0.1, c.y + px * 0.1, px, px * 0.94)).fill(f.right)
  p.g.poly(ellipse(c.x - px * 0.04, c.y - px * 0.05, px * 0.9, px * 0.85)).fill(color)
  p.g.poly(ellipse(c.x - px * 0.3, c.y - px * 0.32, px * 0.48, px * 0.4, 12)).fill(light(color, 0.22))
}
