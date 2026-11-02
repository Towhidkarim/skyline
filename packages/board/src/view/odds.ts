import { Container, Graphics, Text } from 'pixi.js'
import { shade } from '../palette.ts'

/** One space in the landing-odds overlay (computed by the shell from the game state). */
export interface OddsMark {
  space: number
  /** 0..1 chance of ending the roll here. */
  p: number
  /** Short text: the chance ("17%"), the rent due ("−₵250") or the asking price ("₵220"). */
  label: string
  /** Owner's color where rent is due; null for a plain chance or a price. */
  color: number | null
  /** 'price': a lot nobody owns, shown as a shop tag (D79). Rent is a mark with a `color`. */
  kind?: 'price'
}

const FONT = ['Sora Variable', 'Bricolage Grotesque Variable', 'system-ui', 'sans-serif']
const INK = 0x0b1426
/** The cream and money green of the shell's cards and the buy panel's price. */
const CREAM = 0xfbf8f1
const MONEY = 0x1d7354
/** Labels pop in one after another along the path, this far apart. */
const STAGGER_MS = 35

/**
 * A shop tag for a lot nobody owns (D79): cream card with a punched hole at its pointed end,
 * hanging at a slight angle, the price in money green. Says "you could buy this".
 */
function priceTag(label: string): Container {
  const c = new Container()
  const text = new Text({
    text: label,
    resolution: 2,
    style: { fontFamily: FONT, fontWeight: '800', fontSize: 19, fill: MONEY },
  })
  text.anchor.set(0.5, 0.5)
  const h = 30
  const point = 12
  const w = Math.ceil(text.width + 22)
  const x0 = -w / 2 + point / 2
  const x1 = x0 + w
  const body = [x0 - point, -h / 2, x0, -h, x1, -h, x1, 0, x0, 0]
  const g = new Graphics()
  g.poly(body.map((v, i) => (i % 2 ? v + 3 : v))).fill({ color: 0x020610, alpha: 0.3 }) // drop shadow
  g.poly(body)
    .fill(CREAM)
    .stroke({ color: shade(MONEY, 0.9), width: 2.5, join: 'round' })
  g.circle(x0 - point * 0.15, -h / 2, 3.2).fill(MONEY)
  text.position.set(x0 + w / 2 + 1, -h / 2)
  c.addChild(g, text)
  c.rotation = -0.07
  return c
}

/**
 * Rent owed to another player (D79): a pill in the owner's color with a deep rim, the amount
 * after a minus. Says "you would pay them".
 */
function rentBadge(label: string, color: number): Container {
  const c = new Container()
  const text = new Text({
    text: label,
    resolution: 2,
    style: {
      fontFamily: FONT,
      fontWeight: '800',
      fontSize: 22,
      fill: 0xffffff,
      stroke: { color: shade(color, 0.32), width: 4, join: 'round' },
    },
  })
  text.anchor.set(0.5, 0.5)
  const h = 34
  const w = Math.ceil(text.width + 24)
  const g = new Graphics()
  g.roundRect(-w / 2, -h + 3, w, h, h / 2).fill({ color: 0x020610, alpha: 0.35 })
  g.roundRect(-w / 2, -h, w, h, h / 2)
    .fill(color)
    .stroke({ color: shade(color, 0.45), width: 3, alignment: 1 })
  // A light top edge, like the header kerbs, so the badge reads as a raised plate.
  g.roundRect(-w / 2 + 6, -h + 3, w - 12, 5, 2.5).fill({ color: 0xffffff, alpha: 0.28 })
  text.position.set(0, -h / 2)
  c.addChild(g, text)
  return c
}

/** A chance, or a Speed die destination tag: plain outlined text. */
function plain(label: string): Container {
  const text = new Text({
    text: label,
    resolution: 2,
    style: {
      fontFamily: FONT,
      fontWeight: '800',
      fontSize: 19,
      fill: 0xf8fafc,
      stroke: { color: INK, width: 5, join: 'round' },
    },
  })
  text.anchor.set(0.5, 1)
  const c = new Container()
  c.addChild(text)
  return c
}

/**
 * The labels of the landing-odds overlay, floating above their tiles in world space (above
 * buildings, below the dice). Positions come from the board every frame (tiles bounce).
 */
export class OddsLabels {
  readonly container = new Container({ eventMode: 'none' })
  private labels: { space: number; node: Container; age: number; delay: number }[] = []
  private leaving = false
  /** The marks on show, so setting the same ones again keeps them instead of re-popping. */
  private shown = ''

  set(marks: readonly OddsMark[] | null): void {
    if (!marks || marks.length === 0) {
      this.leaving = true
      return
    }
    // Only the text matters here; the tint strength (`p`) lives on the tiles.
    const key = JSON.stringify(marks.map((m) => [m.space, m.label, m.color, m.kind]))
    if (key === this.shown && this.labels.length > 0) {
      this.leaving = false
      return
    }
    this.shown = key
    this.clear()
    this.leaving = false
    marks.forEach((m, i) => {
      const node =
        m.kind === 'price'
          ? priceTag(m.label)
          : m.color !== null
            ? rentBadge(m.label, m.color)
            : plain(m.label)
      node.alpha = 0
      this.container.addChild(node)
      this.labels.push({ space: m.space, node, age: 0, delay: i * STAGGER_MS })
    })
  }

  /** Places each label at its tile top (`at`) with a little pop, or fades them all out. */
  update(dtMs: number, at: (space: number) => { x: number; y: number }, reduced: boolean): void {
    for (const l of this.labels) {
      l.age += dtMs
      const p = at(l.space)
      if (this.leaving) {
        l.node.alpha = Math.max(0, l.node.alpha - dtMs / 160)
      } else {
        const k = Math.min(1, Math.max(0, (l.age - l.delay) / 220))
        l.node.alpha = k
        // A small overshoot as it appears.
        const s = reduced ? 1 : 0.6 + 0.4 * k + 0.12 * Math.sin(Math.PI * k)
        l.node.scale.set(s)
      }
      l.node.position.set(p.x, p.y - 10)
    }
    if (this.leaving && this.labels.every((l) => l.node.alpha <= 0)) this.clear()
  }

  private clear(): void {
    for (const l of this.labels) l.node.destroy({ children: true })
    this.labels = []
  }
}
