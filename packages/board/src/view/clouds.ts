import { Container, FillGradient, Graphics } from 'pixi.js'
import { lightsAt } from '../art/paint.ts'
import { BOARD } from '../geometry/ring.ts'
import { project } from '../geometry/project.ts'
import { cosmeticRng, disc } from './draw.ts'

/**
 * Cloud shadows (Visual polish, DECISIONS.md D73): a few huge soft shapes drifting slowly across
 * the board by day and at dusk, gone at night. Each cloud is drawn once around its own origin
 * and only moved, so a frame costs a handful of position writes. Clouds fade in and out at the
 * board's edge instead of sliding over the table.
 *
 * A cloud is many faint puffs with a flat center and a long soft edge, in a cool blue-grey: where
 * puffs overlap the shade builds up gently, so there is no dark core and the outline stays ragged
 * and soft, like light dimming under a real cloud rather than a stain on the ground.
 */

const COUNT = 3
/** Board units per second. */
const SPEED = 0.12
/** Drift direction in board units (mostly along +col, a little +row). */
const DIR = { col: 0.92, row: 0.39 }
/** Cool blue-grey: the shade cools the ground more than it darkens it. */
const SHADE = 0x34507e
/** Per puff; about four overlap in a cloud's middle. */
const ALPHA = 0.075
/** How far past the board edge a cloud travels before it starts over on the far side. */
const MARGIN = 3

interface Cloud {
  g: Graphics
  col: number
  row: number
  /** Puffs around the center, in board units: offset and radius. */
  puffs: { dc: number; dr: number; r: number }[]
}

let gradient: FillGradient | undefined
/** Flat in the middle, then a long fade: overlapping puffs blend without dark cores. */
const rgba = (a: number) => `rgba(${(SHADE >> 16) & 0xff},${(SHADE >> 8) & 0xff},${SHADE & 0xff},${a})`
function puffFill(): FillGradient {
  gradient ??= new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: rgba(ALPHA) },
      { offset: 0.45, color: rgba(ALPHA * 0.9) },
      { offset: 0.8, color: rgba(ALPHA * 0.35) },
      { offset: 1, color: rgba(0) },
    ],
  })
  return gradient
}

export class CloudShadows {
  readonly container = new Container()
  private readonly clouds: Cloud[] = []
  private day = 1
  private on = true
  private t = 1

  constructor(seed: number) {
    this.container.eventMode = 'none'
    const rng = cosmeticRng(seed * 13 + 7)
    for (let i = 0; i < COUNT; i++) {
      // A long body of big puffs along the drift, then smaller ones that break up the outline.
      const length = 3.2 + rng() * 1.6
      const puffs = [
        ...Array.from({ length: 5 }, (_, k) => ({
          dc: (k / 4 - 0.5) * length + (rng() - 0.5) * 0.4,
          dr: (rng() - 0.5) * 0.8,
          r: 1.1 + rng() * 0.6,
        })),
        ...Array.from({ length: 7 + Math.floor(rng() * 4) }, () => ({
          dc: (rng() - 0.5) * length * 1.3,
          dr: (rng() - 0.5) * 2,
          r: 0.5 + rng() * 0.5,
        })),
      ]
      // Spread along the drift line so they never bunch up.
      const along = -MARGIN + ((i + rng() * 0.5) / COUNT) * (BOARD + 2 * MARGIN)
      const across = BOARD * (0.15 + rng() * 0.7)
      const cloud = {
        g: new Graphics(),
        col: along * DIR.col,
        row: across + along * DIR.row - BOARD * DIR.row * 0.5,
        puffs,
      }
      this.clouds.push(cloud)
      this.container.addChild(cloud.g)
    }
  }

  /** Redraws the clouds for view morph `t` (1 = isometric). */
  draw(t: number): void {
    this.t = t
    // Puffs are drawn around the cloud's own origin: board (0, 0) projects off screen origin.
    const o = project({ col: 0, row: 0, z: 0 }, t)
    for (const c of this.clouds) {
      c.g.clear()
      for (const p of c.puffs) {
        const poly = disc(p.dc, p.dr, p.r, 0, t, 24).map((v, i) => v - (i % 2 === 0 ? o.x : o.y))
        c.g.poly(poly).fill(puffFill())
      }
    }
    this.place()
  }

  /** City life switch: off hides the clouds and stops them. */
  setOn(on: boolean): void {
    this.on = on
    this.container.visible = on && this.day > 0.01
  }

  /** 0 = day, 1 = night: clouds fade out as the lights come on. */
  setNight(n: number): void {
    this.day = 1 - lightsAt(n)
    this.container.visible = this.on && this.day > 0.01
    this.place()
  }

  update(dtMs: number, frozen: boolean): void {
    if (!this.container.visible) return
    if (!frozen) {
      const d = (SPEED * dtMs) / 1000
      for (const c of this.clouds) {
        c.col += DIR.col * d
        c.row += DIR.row * d
        if (c.col > BOARD + MARGIN) {
          c.col -= BOARD + 2 * MARGIN
          c.row -= (BOARD + 2 * MARGIN) * (DIR.row / DIR.col)
        }
      }
    }
    this.place()
  }

  private place(): void {
    const mid = BOARD / 2
    for (const c of this.clouds) {
      const p = project({ col: c.col, row: c.row, z: 0 }, this.t)
      c.g.position.set(p.x, p.y)
      // Full strength over the board, fading out past its edges.
      const out = Math.max(Math.abs(c.col - mid), Math.abs(c.row - mid)) - mid
      c.g.alpha = this.day * Math.min(1, Math.max(0, 1 - out / 1.5))
    }
  }
}
