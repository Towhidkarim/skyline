import { Container, Graphics } from 'pixi.js'
import { SPACES } from '@skyline/engine'
import { Spring } from '../anim/spring.ts'
import type { Lot } from '../art/buildings.ts'
import { drawLot, type Family } from '../art/lots.ts'
import { drawSpecial, type Special } from '../art/specials.ts'
import { NIGHT, lightsAt, mix, nightTint } from '../art/paint.ts'
import { BOARD_STYLE } from '../art/style.ts'
import { projectPoly, zScale } from '../geometry/project.ts'
import { LOT_Z, lotRect, ringFootprint, tilePoint, uvRect, type Footprint } from '../geometry/ring.ts'
import { groupColors, palette, shade } from '../palette.ts'
import { disc, isoBox, rect } from './draw.ts'

const GAP = 0.035
const THICK = 0.1
const LIFT_HOVER = 0.14
const LIFT_SELECT = 0.2

/**
 * Architecture family per color group, cheap to expensive: houses on the first streets, glass on
 * the last. Fixed for now; the seeded city (DECISIONS.md D25) will vary it per game.
 */
export const GROUP_FAMILY: readonly Family[] = [
  'cottage',
  'cottage',
  'brick',
  'brick',
  'modern',
  'modern',
  'glass',
  'glass',
]

/** The building plot: the part of a property tile behind the pieces' standing strip (ring.ts). */
export const lotOf = (fp: Footprint): Lot => ({ ...lotRect(fp), z: LOT_Z })

/** How far a building fades while it would cover pieces on the neighboring tile. */
const VEIL = 0.55

/** Game-state decoration on a tile: owner color, buildings, mortgage. */
export interface TileDeco {
  /** Owner's color, or null when unowned. */
  owner: number | null
  /** 0..4 houses, 5 = hotel. */
  level: number
  mortgaged: boolean
}

const EMPTY_DECO: TileDeco = { owner: null, level: 0, mortgaged: false }

/** How a newly built house falls into place. */
export interface DropTuning {
  dropHeight: number
  gravity: number
  bounce: number
}

/** A building in mid-fall: height above its slot and vertical speed (z units, per second). */
interface Drop {
  z: number
  v: number
  bounced: boolean
  tune: DropTuning
}

/** One of the 40 ring tiles: code-drawn geometry, lift spring, highlight rim, game decoration. */
export class TileView {
  readonly container = new Container()
  private readonly base = new Graphics()
  private readonly decoG = new Graphics()
  /** Landing-odds tint on the tile top (see setOdds). */
  private readonly oddsG = new Graphics()
  private odds: { k: number; color: number | null } = { k: 0, color: null }
  private oddsOn = false
  /**
   * The lot's building with its lights and beacons. It lives in the board's actor layer (not this
   * tile's container) so it depth-sorts with the city and the pieces; it follows the tile's lift.
   */
  readonly tower = new Container()
  /** The building on a property lot; moved as a whole while it drops in. */
  private readonly building = new Graphics()
  /** Its lit windows at night (never tinted). */
  private readonly buildingLights = new Graphics()
  private night = 0
  /** Mortgage dimming of the building (1 = none). */
  private baseAlpha = 1
  /** Eased 0..1 fade while the building would cover pieces on the tile behind it. */
  private veil = 0
  /** Set by the board when pieces rest on the tile this building could cover. */
  veiled = false
  /** 0..1 window flare after a build (see flareLights). */
  private flare = 0
  /** Ring light wave passing over this tile (set by the board each frame) and its color. */
  wave = 0
  waveColor = 0xffffff
  /** A hotel's blinking roof beacon (the board blinks it). */
  private readonly buildingBeacons = new Graphics()
  private readonly rim = new Graphics()
  private readonly fp: Footprint
  private readonly family: Family | null
  private readonly groupColor: number | null
  /** The prop on a non-property side tile (station, pylon, coins, cards, chest). */
  private readonly special: Special | null
  readonly lift = new Spring(0, 260, 18)
  hovered = false
  selected = false
  /** The "for sale" board on an unowned lot, drawn apart so it can wobble (D77). */
  private readonly sign = new Graphics()
  private signAt: { x: number; y: number } | null = null
  /** The sign's tilt in radians: an underdamped swing after a piece arrives. */
  private readonly wobble = new Spring(0, 240, 6)
  /** 0..1 flash from path previews, decays each frame. */
  flash = 0
  /**
   * 0..1 warning while a piece heads for this tile and would owe rent (set by the board as the
   * piece approaches): the rim beats in the owner's color, faster as it rises.
   */
  danger = 0
  dangerColor = 0xffffff
  /** Once the piece has arrived the warning fades out instead of stopping dead. */
  dangerFading = false
  private pulseClock = 0
  private deco: TileDeco = EMPTY_DECO
  private lastT = 1
  private drop: Drop | null = null
  /** Called when a dropped building first hits the tile, with the new building level. */
  onImpact: ((tile: TileView, level: number) => void) | null = null

  readonly index: number

  constructor(index: number) {
    this.index = index
    this.fp = ringFootprint(index)
    this.container.zIndex = this.fp.col0 + this.fp.row0
    const space = SPACES[index]!
    this.family = space.kind === 'property' ? GROUP_FAMILY[space.group]! : null
    this.groupColor = space.kind === 'property' ? groupColors[space.group]! : null
    this.special = specialOf(index)
    this.rim.alpha = 0
    this.oddsG.alpha = 0
    this.container.addChild(this.base, this.oddsG, this.decoG, this.rim)
    this.tower.addChild(this.building, this.sign, this.buildingLights, this.buildingBeacons)
    if (this.fp.corner) {
      // Corner props keep to the back edges, behind the pieces standing on the corner.
      this.tower.zIndex = this.fp.col0 + this.fp.row0 + 0.6
    } else if (this.family || this.special) {
      const lot = lotRect(this.fp)
      this.tower.zIndex = (lot.col0 + lot.col1 + lot.row0 + lot.row1) / 2
    }
    this.buildingLights.visible = false
  }

  /** Beacon brightness (night level times the blink), set each frame by the board. */
  setBlink(alpha: number): void {
    this.buildingBeacons.alpha = alpha * this.building.alpha
  }

  /**
   * 0 = day, 1 = night. The tile darkens much less than the city and owner plates not at all, so
   * the board stays readable (DECISIONS.md D28); the lot's building gets the city grade and lights.
   */
  setNight(n: number): void {
    this.night = n
    this.base.tint = nightTint(NIGHT.tiles, n, 0.5)
    this.building.tint = nightTint(NIGHT.city, n)
    const glow = lightsAt(n)
    this.applyAlpha()
    this.buildingBeacons.visible = glow > 0.01
  }

  /**
   * Updates ownership/buildings/mortgage. `animate` gives a bounce (`lift`) and a flash; with
   * `drop`, a newly built house or hotel falls from above and calls `onImpact` when it lands.
   */
  setDeco(deco: TileDeco, animate: boolean, drop: DropTuning | null = null, lift = 2.4): void {
    const d = this.deco
    if (d.owner === deco.owner && d.level === deco.level && d.mortgaged === deco.mortgaged) return
    this.deco = { ...deco }
    this.drop = null
    const built = deco.level > d.level
    if (animate && built && drop) {
      this.drop = { z: drop.dropHeight, v: 0, bounced: false, tune: drop }
    } else if (animate) {
      this.lift.kick(built || deco.owner !== d.owner ? lift : -1.4)
      this.flash = 1
    }
    this.drawDeco(this.lastT)
  }

  /** True while a building is still falling or bouncing. */
  get dropping(): boolean {
    return this.drop !== null
  }

  private stepDrop(dtMs: number): void {
    const d = this.drop!
    const dt = Math.min(dtMs, 50) / 1000
    d.v -= d.tune.gravity * dt
    d.z += d.v * dt
    if (d.z <= 0) {
      d.z = 0
      if (d.bounced || d.tune.bounce <= 0) this.drop = null
      if (!d.bounced) {
        d.bounced = true
        this.lift.kick(Math.min(3, -d.v * 0.5))
        this.flash = 1
        this.onImpact?.(this, this.deco.level)
        d.v = -d.v * d.tune.bounce
      }
    }
    this.placeBuilding(this.lastT)
  }

  private drawDeco(t: number): void {
    const g = this.decoG.clear()
    const fp = this.fp
    const { owner, level, mortgaged } = this.deco
    if (mortgaged) {
      g.poly(rect(fp.col0 + GAP, fp.row0 + GAP, fp.col1 - GAP, fp.row1 - GAP, 0, t)).fill({
        color: 0x0b1426,
        alpha: 0.5,
      })
    }
    if (owner !== null) {
      // Owner plate along the outer edge, plus a small corner chip so it reads at any zoom.
      g.poly(quad(fp, 0.06, 0.03, 0.94, 0.13, t)).fill(owner)
      g.poly(quad(fp, 0.06, 0.03, 0.94, 0.05, t)).fill(shade(owner, 0.7))
    }
    const b = this.building.clear()
    const lights = this.buildingLights.clear()
    const beacons = this.buildingBeacons.clear()
    this.sign.clear()
    this.signAt = null
    if (this.family) {
      const sign = { g: this.sign, at: (x: number, y: number) => (this.signAt = { x, y }) }
      // Unowned is the for-sale lot (-1); then owned (0), 1 to 4 houses, hotel (5).
      drawLot(
        { g: b, lights, t, style: BOARD_STYLE, beacons, sign },
        lotOf(fp),
        owner === null ? -1 : level,
        this.family,
        owner,
        this.index * 131 + 17,
        this.groupColor,
      )
    } else if (this.special) {
      drawSpecial({ g: b, lights, t, style: BOARD_STYLE, beacons }, fp, this.special, this.index)
    }
    this.baseAlpha = mortgaged ? 0.55 : 1
    this.setNight(this.night)
    this.placeBuilding(t)
  }

  /** Building opacity: mortgage dimming times the veil; its lights follow. */
  private applyAlpha(): void {
    this.building.alpha = this.baseAlpha * (1 - VEIL * this.veil)
    // A fresh building flares its windows on (day or night), then settles to the night level.
    const lit = Math.max(lightsAt(this.night), this.flare)
    this.buildingLights.alpha = lit * this.building.alpha
    this.buildingLights.visible = lit > 0.01
  }

  /** Lights the building's windows up for a moment (new building, hotel), fading over ~1.6 s. */
  flareLights(strength: number): void {
    this.flare = Math.max(this.flare, strength)
    this.applyAlpha()
  }

  /** Lifts the building by the height it still has to fall. */
  private placeBuilding(t: number): void {
    this.building.y = -(this.drop?.z ?? 0) * zScale(t)
    this.buildingLights.y = this.building.y
    this.buildingBeacons.y = this.building.y
    // The sign swings about its foot.
    const at = this.signAt ?? { x: 0, y: 0 }
    this.sign.pivot.set(at.x, at.y)
    this.sign.position.set(at.x, at.y + this.building.y)
    this.sign.rotation = this.wobble.value
  }

  /**
   * A piece arrived on this lot while it is for sale (D77): the tile flashes and the "for sale"
   * board swings, before the buy panel opens. No hop: the landing already bumped the tile.
   */
  greet(): void {
    this.flash = 1
    if (this.signAt) this.wobble.kick(3.4)
  }

  /** True when this tile shows a "for sale" board. */
  get forSale(): boolean {
    return this.signAt !== null
  }

  /**
   * Tints the tile top for the landing-odds overlay: `k` 0..1 is how likely (0 hides it), `color`
   * an owner's color where rent would be due (else gold).
   */
  setOdds(k: number, color: number | null): void {
    this.oddsOn = k > 0
    // Hiding keeps the last tint drawn so it can fade out.
    if (!this.oddsOn) return
    this.odds = { k, color }
    this.drawOdds(this.lastT)
  }

  private drawOdds(t: number): void {
    const { k, color } = this.odds
    const g = this.oddsG.clear()
    if (k <= 0) return
    const fp = this.fp
    // Gold (the game's accent) for a plain chance; the owner's color where rent is due.
    const c = color ?? palette.select
    const r = rect(fp.col0 + GAP, fp.row0 + GAP, fp.col1 - GAP, fp.row1 - GAP, 0.001, t)
    // Soft: a light wash and a thin edge, a little stronger for likelier totals.
    g.poly(r).fill({ color: c, alpha: 0.1 + 0.14 * k })
    g.poly(r).stroke({ color: c, width: 1.5, alpha: 0.35 + 0.3 * k, alignment: 1, join: 'round' })
  }

  draw(t: number): void {
    this.lastT = t
    this.drawOdds(t)
    this.drawDeco(t)
    const fp = this.fp
    const g = this.base.clear()
    // A property's top takes a faint wash of its district color, so a street reads as one (D78).
    const group = this.groupColor
    const top = fp.corner
      ? palette.cornerTop
      : group === null
        ? palette.tileTop
        : mix(palette.tileTop, group, 0.07)
    isoBox(
      g,
      {
        col0: fp.col0 + GAP,
        row0: fp.row0 + GAP,
        col1: fp.col1 - GAP,
        row1: fp.row1 - GAP,
        z0: -THICK,
        z1: 0,
      },
      { top, left: palette.tileLeft, right: palette.tileRight },
      t,
    )
    if (!fp.corner) chamfer(g, fp, t)
    const kind = SPACES[this.index]!.kind
    if (group !== null) sideStripe(g, fp, group, t)
    else if (kind === 'railroad' || kind === 'utility') sideStripe(g, fp, SLATE, t)
    drawIcon(g, this.index, fp, t)

    this.rim
      .clear()
      .poly(rect(fp.col0 + GAP, fp.row0 + GAP, fp.col1 - GAP, fp.row1 - GAP, 0, t))
      .fill({ color: 0xffffff, alpha: 0.18 })
      .stroke({ color: 0xffffff, width: 3, alignment: 1, join: 'round' })
  }

  /** `speed` scales falling buildings with the game speed (springs stay real-time). */
  update(dtMs: number, t: number, speed = 1): void {
    if (this.drop) this.stepDrop(dtMs * speed)
    this.lift.target = this.selected ? LIFT_SELECT : this.hovered ? LIFT_HOVER : 0
    this.lift.step(dtMs)
    this.container.y = -this.lift.value * zScale(t)
    this.tower.y = this.container.y
    if (this.wobble.step(dtMs)) this.sign.rotation = this.wobble.value

    this.pulseClock += dtMs
    // The odds tint eases in and out.
    const oddsTo = this.oddsOn ? 1 : 0
    this.oddsG.alpha += (oddsTo - this.oddsG.alpha) * Math.min(1, dtMs / 140)
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dtMs / 450)
    if (this.dangerFading) {
      this.danger = Math.max(0, this.danger - dtMs / 700)
      if (this.danger === 0) this.dangerFading = false
    }
    const pulse = this.selected ? 0.75 + 0.25 * Math.sin(this.pulseClock / 160) : 0
    // A heartbeat: a sharp rise and a slower fall, its period shrinking from ~900 to ~420 ms.
    const beat =
      this.danger > 0 ? (this.pulseClock % (900 - 480 * this.danger)) / (900 - 480 * this.danger) : 0
    const warn = this.danger * (0.35 + 0.65 * Math.exp(-6 * beat))
    this.rim.alpha = Math.max(this.hovered ? 1 : 0, pulse, this.flash, this.wave * 0.9, warn)
    this.rim.tint =
      warn > Math.max(pulse, this.flash, this.wave) && !this.hovered
        ? this.dangerColor
        : this.wave > Math.max(pulse, this.flash) && !this.hovered
          ? this.waveColor
          : this.selected
            ? palette.select
            : palette.hover
    if (this.flare > 0) {
      this.flare = Math.max(0, this.flare - dtMs / 1600)
      this.applyAlpha()
    }

    // Fade a tall building while pieces stand just behind it (eased, so it never pops).
    const { owner, level } = this.deco
    const want = this.veiled && owner !== null && level >= 2 ? 1 : 0
    if (this.veil !== want) {
      const step = dtMs / 220
      this.veil = Math.abs(want - this.veil) <= step ? want : this.veil + Math.sign(want - this.veil) * step
      this.applyAlpha()
    }
  }
}

/** Quad in tile-local (u along edge, v outer->inner) coordinates, flattened to screen. */
function quad(fp: Footprint, u0: number, v0: number, u1: number, v1: number, t: number): number[] {
  return quadZ(fp, u0, v0, u1, v1, 0, t)
}

function quadZ(
  fp: Footprint,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z: number,
  t: number,
): number[] {
  return projectPoly(
    [tilePoint(fp, u0, v0), tilePoint(fp, u1, v0), tilePoint(fp, u1, v1), tilePoint(fp, u0, v1)].map((p) => ({
      ...p,
      z,
    })),
    t,
  )
}

function polyUV(fp: Footprint, uv: readonly (readonly [number, number])[], t: number): number[] {
  return projectPoly(
    uv.map(([u, v]) => ({ ...tilePoint(fp, u, v), z: 0 })),
    t,
  )
}

/** The prop for a non-property side tile, by its space kind. */
function specialOf(index: number): Special | null {
  switch (SPACES[index]!.kind) {
    case 'railroad':
      return 'railroad'
    case 'utility':
      return index === 12 ? 'electric' : 'water'
    case 'tax':
      return 'tax'
    case 'chance':
      return 'chance'
    case 'chest':
      return 'chest'
    case 'jail':
      return 'lockup'
    case 'goToJail':
      return 'goToLockup'
    case 'parking':
      return 'park'
    default:
      return null
  }
}

/**
 * Paving under a side tile's lot, with a low curb, so its building or prop stands on a plot.
 * Lighter than the tile around it: a raised surface catches light; a darker one reads as a dip.
 */
function lotPad(g: Graphics, fp: Footprint, t: number): void {
  const pad = mix(palette.tileTop, 0xffffff, 0.45)
  isoBox(
    g,
    { ...lotRect(fp), z0: 0, z1: LOT_Z },
    { top: pad, left: shade(pad, 0.82), right: shade(pad, 0.9) },
    t,
  )
}

/** Height of a property's color header above the tile top. */
const BAND = 0.03

/**
 * The district header (D78): a raised curb in the group color along the city edge, with a lit
 * back lip and a shaded front lip like a painted kerb, and raised ornaments in a contrasting tone
 * of the same color (dots for the first four groups, diamonds for the rest; one to four of them)
 * so groups never depend on color alone, in grayscale too.
 */
function header(g: Graphics, fp: Footprint, group: number, t: number): void {
  const color = groupColors[group]!
  kerb(g, fp, color, t)
  // Pale ornaments on dark and mid colors, deeper ones on light colors (yellow, sky).
  const light = luma(color) > 0.62
  const ink = light ? shade(color, 0.55) : mix(color, 0xffffff, 0.55)
  const rim = light ? mix(color, 0xffffff, 0.4) : shade(color, 0.6)
  const marks = (group % 4) + 1
  for (let i = 0; i < marks; i++) {
    const u = (i + 1) / (marks + 1)
    const c = tilePoint(fp, u, 0.87)
    // A small drop edge under each mark reads as raised, not punched in.
    if (group < 4) {
      g.poly(disc(c.col, c.row + 0.006, 0.042, BAND, t)).fill(rim)
      g.poly(disc(c.col, c.row, 0.042, BAND, t)).fill(ink)
    } else {
      const diamond = (dz: number, r: number) =>
        projectPoly(
          [
            [0, -r],
            [r, 0],
            [0, r],
            [-r, 0],
          ].map(([du, dv]) => ({ ...tilePoint(fp, u + du!, 0.87 + dv! * 1.4), z: BAND + dz })),
          t,
        )
      g.poly(diamond(-0.004, 0.05)).fill(rim)
      g.poly(diamond(0, 0.043)).fill(ink)
    }
  }
}

/** The raised kerb under a header: a lit far lip and a shaded near lip. */
function kerb(g: Graphics, fp: Footprint, color: number, t: number): void {
  isoBox(
    g,
    { ...uvRect(fp, 0.04, 0.77, 0.96, 0.97), z0: 0, z1: BAND },
    { top: color, left: shade(color, 0.72), right: shade(color, 0.84) },
    t,
  )
  g.poly(quadZ(fp, 0.04, 0.945, 0.96, 0.97, BAND, t)).fill(mix(color, 0xffffff, 0.35))
  g.poly(quadZ(fp, 0.04, 0.77, 0.96, 0.785, BAND, t)).fill(shade(color, 0.86))
}

/** Stations and utilities: a neutral slate kerb, so they belong to the rim without a district. */
const SLATE = 0x56627a

/**
 * The header of a station or utility (D78): the slate kerb with a little track for a station
 * (steel rails over sleepers), an amber bolt for the electric company, a blue pool for the water
 * works.
 */
function serviceHeader(g: Graphics, fp: Footprint, mark: 'rail' | 'bolt' | 'drop', t: number): void {
  kerb(g, fp, SLATE, t)
  const z = BAND + 0.0005
  if (mark === 'rail') {
    for (let u = 0.1; u < 0.92; u += 0.075) g.poly(quadZ(fp, u, 0.81, u + 0.03, 0.93, z, t)).fill(0x3a4458)
    for (const v of [0.835, 0.895]) g.poly(quadZ(fp, 0.07, v, 0.93, v + 0.014, z + 0.0005, t)).fill(0xd6dde8)
    return
  }
  // An icon in the middle, its v offsets stretched like the diamonds so it stays in proportion.
  const at = (pts: readonly (readonly [number, number])[], r: number, dz = 0) =>
    projectPoly(
      pts.map(([du, dv]) => ({ ...tilePoint(fp, 0.5 + du * r, 0.87 + dv * r * 1.4), z: z + dz })),
      t,
    )
  if (mark === 'bolt') {
    const bolt = [
      [0.25, -1],
      [-0.55, 0.12],
      [-0.02, 0.12],
      [-0.25, 1],
      [0.55, -0.12],
      [0.02, -0.12],
    ] as const
    g.poly(at(bolt, 0.075, -0.004)).fill(0x7a5a12)
    g.poly(at(bolt, 0.068)).fill(0xfbbf24)
    for (const du of [-0.3, 0.3]) {
      const c = tilePoint(fp, 0.5 + du, 0.87)
      g.poly(disc(c.col, c.row, 0.02, z, t)).fill(0x8b97ad)
    }
    return
  }
  const c = tilePoint(fp, 0.5, 0.87)
  g.poly(disc(c.col, c.row + 0.006, 0.07, z, t)).fill(0x2f4a7a)
  g.poly(disc(c.col, c.row, 0.07, z, t)).fill(0x60a5fa)
  g.poly(disc(c.col, c.row, 0.045, z + 0.0005, t)).fill(0x93c5fd)
  g.poly(disc(c.col - 0.015, c.row - 0.015, 0.016, z + 0.001, t)).fill(0xe0f2fe)
}

/**
 * The tile's long side face that the camera sees (the outer edge on the front sides, the inner
 * edge on the back ones) gets a band of the district color under a slab-colored lip, so the rim of
 * the board reads as a ring of districts (D78).
 */
function sideStripe(g: Graphics, fp: Footprint, color: number, t: number): void {
  const zTop = -0.008
  const zBot = -THICK + 0.01
  const inset = 0.04
  const pts =
    fp.side === 0 || fp.side === 2
      ? [fp.col0 + GAP + inset, fp.col1 - GAP - inset].map((col) => ({ col, row: fp.row1 - GAP }))
      : [fp.row0 + GAP + inset, fp.row1 - GAP - inset].map((row) => ({ col: fp.col1 - GAP, row }))
  const face = fp.side === 0 || fp.side === 2 ? 0.8 : 0.66
  g.poly(
    projectPoly(
      [
        { ...pts[0]!, z: zTop },
        { ...pts[1]!, z: zTop },
        { ...pts[1]!, z: zBot },
        { ...pts[0]!, z: zBot },
      ],
      t,
    ),
  ).fill(shade(color, face))
}

/**
 * A light chamfer along the top's two front edges, so a tile reads as a chunky slab, not a flat
 * sheet (D78).
 */
function chamfer(g: Graphics, fp: Footprint, t: number): void {
  const c0 = fp.col0 + GAP
  const r0 = fp.row0 + GAP
  const c1 = fp.col1 - GAP
  const r1 = fp.row1 - GAP
  const w = 0.016
  const lit = { color: 0xffffff, alpha: 0.5 }
  g.poly(rect(c0, r1 - w, c1, r1, 0.0005, t)).fill(lit)
  g.poly(rect(c1 - w, r0, c1, r1, 0.0005, t)).fill({ color: 0xffffff, alpha: 0.32 })
}

/** Relative luminance-ish brightness, 0..1. */
function luma(color: number): number {
  return (0.2126 * ((color >> 16) & 0xff) + 0.7152 * ((color >> 8) & 0xff) + 0.0722 * (color & 0xff)) / 255
}

function drawIcon(g: Graphics, index: number, fp: Footprint, t: number): void {
  const space = SPACES[index]!
  if (!fp.corner && space.kind !== 'property' && specialOf(index)) {
    lotPad(g, fp, t)
    if (space.kind === 'railroad') serviceHeader(g, fp, 'rail', t)
    if (space.kind === 'utility') serviceHeader(g, fp, specialOf(index) === 'electric' ? 'bolt' : 'drop', t)
    return
  }
  switch (space.kind) {
    case 'property': {
      lotPad(g, fp, t)
      header(g, fp, space.group, t)
      break
    }
    case 'go':
      // Start stripe plus a big arrow pointing along the walking direction (toward Jail).
      g.poly(
        polyUV(
          fp,
          [
            [0.12, 0.42],
            [0.55, 0.42],
            [0.55, 0.28],
            [0.88, 0.5],
            [0.55, 0.72],
            [0.55, 0.58],
            [0.12, 0.58],
          ],
          t,
        ),
      ).fill(palette.alert)
      break
    case 'jail': {
      // The cell yard: darker concrete behind a painted line; visitors stand in front.
      const w = fp.col1 - fp.col0
      const yard = mix(palette.cornerTop, 0x64748b, 0.25)
      g.poly(rect(fp.col0 + GAP, fp.row0 + GAP, fp.col0 + 0.5 * w, fp.row0 + 0.5 * w, 0, t)).fill(yard)
      g.poly(rect(fp.col0 + 0.5 * w, fp.row0 + GAP, fp.col0 + 0.52 * w, fp.row0 + 0.52 * w, 0.001, t)).fill(
        0xfacc15,
      )
      g.poly(rect(fp.col0 + GAP, fp.row0 + 0.5 * w, fp.col0 + 0.52 * w, fp.row0 + 0.52 * w, 0.001, t)).fill(
        0xfacc15,
      )
      break
    }
    case 'parking': {
      // Lawn over the corner with a light path ring around the middle.
      const w = fp.col1 - fp.col0
      const c = { col: fp.col0 + w / 2, row: fp.row0 + w / 2 }
      const lawn = mix(BOARD_STYLE.park, BOARD_STYLE.ground, 0.22)
      g.poly(rect(fp.col0 + GAP * 2, fp.row0 + GAP * 2, fp.col1 - GAP * 2, fp.row1 - GAP * 2, 0, t)).fill(
        lawn,
      )
      g.poly(disc(c.col, c.row, w * 0.36, 0.001, t, 40)).fill(BOARD_STYLE.parkPath)
      g.poly(disc(c.col, c.row, w * 0.28, 0.002, t, 40)).fill(mix(lawn, 0xffffff, 0.08))
      break
    }
    case 'goToJail': {
      // A painted no-entry mark in the middle; the booth and gate stand at the back.
      const w = fp.col1 - fp.col0
      const c = { col: fp.col0 + w * 0.56, row: fp.row0 + w * 0.56 }
      g.poly(disc(c.col, c.row, w * 0.24, 0, t, 32)).fill(palette.alert)
      g.poly(disc(c.col, c.row, w * 0.19, 0.001, t, 32)).fill(palette.cornerTop)
      g.poly(disc(c.col, c.row, w * 0.16, 0.002, t, 32)).fill(palette.alert)
      const bar = 0.025 * w
      g.poly(rect(c.col - w * 0.11, c.row - bar, c.col + w * 0.11, c.row + bar, 0.003, t)).fill(0xf8fafc)
      break
    }
  }
}
