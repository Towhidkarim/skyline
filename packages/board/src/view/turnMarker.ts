import { Container, Graphics, Text } from 'pixi.js'
import { Spring } from '../anim/spring.ts'

/** Who a piece belongs to, for its tags. */
export interface MarkerPlayer {
  id: string
  color: number
  name: string
  /** The player on this screen: a small YOU tag rides above their piece all game. */
  you: boolean
}

/** Where a piece is this frame: its ground in world space, its head on screen. */
export interface MarkerAnchor {
  ground: { x: number; y: number }
  head: { x: number; y: number }
}

const FONT = ['Bricolage Grotesque Variable', 'system-ui', 'sans-serif']
/** The cream and ink of the shell's cards, so the tags read as the same family as the banner. */
const CREAM = 0xfbf8f1
const INK = 0x1f2a3d
/** How long the name tag stays up when a turn starts, in real ms. */
export const ANNOUNCE_MS = 2200

interface Tag {
  player: MarkerPlayer
  root: Container
  chevron: Graphics
  name: Container
  you: Container | null
  /** 0 = compact (chevron, YOU), 1 = name tag out. */
  open: Spring
  /** Real ms the name tag stays out (announce). */
  hold: number
  /** Chevron presence, eased. */
  show: Spring
}

/** A cream pill with a colored rim and a label. */
function pill(label: string, color: number, size: number): Container {
  const c = new Container()
  const text = new Text({
    text: label,
    resolution: 2,
    style: {
      fontFamily: FONT,
      fontWeight: '800',
      fontSize: size,
      fill: INK,
      letterSpacing: size < 12 ? 1 : 0,
    },
  })
  text.anchor.set(0.5, 0.5)
  const padX = size * 0.75
  const w = Math.ceil(text.width + padX * 2 + size * 0.7)
  const h = Math.ceil(size * 1.75)
  const g = new Graphics()
  g.roundRect(-w / 2, -h + 2, w, h, h / 2).fill({ color: 0x020610, alpha: 0.35 }) // drop shadow
  g.roundRect(-w / 2, -h, w, h, h / 2)
    .fill(CREAM)
    .stroke({ color, width: Math.max(2, size * 0.17), alignment: 1 })
  // A dot in the player's color, like the color strip on the turn banner.
  const dot = size * 0.3
  g.circle(-w / 2 + padX * 0.6 + dot, -h / 2, dot).fill(color)
  text.position.set(dot + size * 0.2, -h / 2)
  c.addChild(g, text)
  return c
}

/**
 * Says whose turn it is and whose piece is whose (D76): a ring of light in the player's color on
 * the ground under the active piece, a bobbing chevron over it, and a name tag that pops out when
 * the turn starts, then tucks away. The tags live in screen space so they stay crisp and readable
 * at any zoom; the ring lives in world space under the pieces.
 */
export class TurnMarker {
  /** World space, under the pieces (the board puts it in the shadow layer). */
  readonly ring = new Graphics()
  private readonly ripple = new Graphics()
  readonly ground = new Container({ eventMode: 'none' })
  /** Screen space, above the world. */
  readonly container = new Container({ eventMode: 'none' })
  private readonly tags = new Map<string, Tag>()
  private active: string | null = null
  private clock = 0
  private rippleAge = -1

  constructor() {
    this.ground.addChild(this.ring, this.ripple)
    this.ground.visible = false
  }

  setPlayers(players: readonly MarkerPlayer[]): void {
    for (const tag of this.tags.values()) tag.root.destroy({ children: true })
    this.tags.clear()
    for (const player of players) {
      const root = new Container()
      const chevron = new Graphics()
      chevron
        .poly([-9, -11, 9, -11, 0, 0]) // points down at the piece, tip at the origin
        .fill(player.color)
        .stroke({ color: CREAM, width: 2.5, join: 'round' })
      const name = pill(player.you ? 'You' : player.name, player.color, 15)
      const you = player.you ? pill('YOU', player.color, 10) : null
      name.alpha = 0
      chevron.alpha = 0
      root.addChild(chevron, ...(you ? [you] : []), name)
      this.container.addChild(root)
      this.tags.set(player.id, {
        player,
        root,
        chevron,
        name,
        you,
        open: new Spring(0, 300, 20),
        hold: 0,
        show: new Spring(0, 260, 22),
      })
    }
    if (this.active && !this.tags.has(this.active)) this.setActive(null)
  }

  remove(id: string): void {
    const tag = this.tags.get(id)
    if (!tag) return
    tag.root.destroy({ children: true })
    this.tags.delete(id)
    if (this.active === id) this.setActive(null)
  }

  /** Marks whose turn it is (null: nobody, game over). `announce` pops the name tag and a ripple. */
  setActive(id: string | null, announce = false): void {
    const tag = id ? this.tags.get(id) : undefined
    this.active = tag ? id : null
    this.ground.visible = !!tag
    if (!tag) return
    const color = tag.player.color
    this.ring.clear()
    // A soft pool of the player's color with one thin rim: present, not loud (the chevron leads).
    this.ring.ellipse(0, 0, 28, 13).fill({ color, alpha: 0.16 })
    this.ring.ellipse(0, 0, 28, 13).stroke({ color, width: 1.75, alpha: 0.75 })
    this.ripple.clear()
    this.ripple.ellipse(0, 0, 28, 13).stroke({ color, width: 2, alpha: 0.6 })
    this.ripple.visible = false
    if (announce) {
      this.announce(id!)
      this.rippleAge = 0
    }
  }

  /** Pops a piece's name tag for a while (turn start, roll call). */
  announce(id: string, ms = ANNOUNCE_MS): void {
    const tag = this.tags.get(id)
    if (!tag) return
    tag.hold = Math.max(tag.hold, ms)
    tag.open.kick(4)
  }

  /** Tucks every name tag away at once (skip). */
  hush(): void {
    for (const tag of this.tags.values()) tag.hold = 0
    this.rippleAge = -1
  }

  /**
   * `at` gives each piece's anchor (null: not on the board); `peek` lists pieces whose name
   * shows while the pointer is on their tile.
   */
  update(
    realMs: number,
    at: (id: string) => MarkerAnchor | null,
    peek: ReadonlySet<string>,
    reduced: boolean,
  ): void {
    this.clock += realMs
    for (const [id, tag] of this.tags) {
      const anchor = at(id)
      tag.root.visible = !!anchor
      if (!anchor) continue
      const active = id === this.active
      tag.hold = Math.max(0, tag.hold - realMs)
      tag.open.target = tag.hold > 0 || peek.has(id) ? 1 : 0
      tag.show.target = active ? 1 : 0
      if (reduced) {
        tag.open.value = tag.open.target
        tag.show.value = tag.show.target
      } else {
        tag.open.step(realMs)
        tag.show.step(realMs)
      }
      const open = Math.max(0, Math.min(1.15, tag.open.value))
      const show = Math.max(0, Math.min(1.15, tag.show.value))
      const bob = reduced ? 0 : 3 * Math.sin((this.clock / 1000) * Math.PI * 2 * 0.9)
      tag.root.position.set(Math.round(anchor.head.x), Math.round(anchor.head.y))
      // Over an active piece the chevron bobs and the tags sit above it; elsewhere they sit lower.
      tag.chevron.position.set(0, -8 + bob * show)
      tag.chevron.alpha = Math.min(1, show)
      tag.chevron.scale.set(0.4 + 0.6 * show)
      const base = -20 * Math.min(1, show) - 4 + bob * show
      tag.name.position.set(0, base)
      tag.name.alpha = Math.min(1, open)
      tag.name.scale.set(0.55 + 0.45 * open)
      if (tag.you) {
        tag.you.position.set(0, base)
        tag.you.alpha = Math.max(0, 1 - open * 1.6) * 0.95
        tag.you.scale.set(1 - 0.2 * Math.min(1, open))
      }
      // The active piece's tags draw last, on top of a neighbor's.
      tag.root.zIndex = active ? 2 : open > 0.05 ? 1 : 0
    }
    this.container.sortableChildren = true

    const tag = this.active ? this.tags.get(this.active) : undefined
    const anchor = tag ? at(tag.player.id) : null
    this.ground.visible = !!anchor
    if (!anchor) return
    this.ground.position.set(anchor.ground.x, anchor.ground.y)
    const pulse = reduced ? 0 : Math.sin((this.clock / 1000) * Math.PI * 1.2)
    this.ring.scale.set(1 + 0.03 * pulse)
    this.ring.alpha = 0.8 + 0.12 * pulse
    if (this.rippleAge >= 0 && !reduced) {
      this.rippleAge += realMs
      const k = this.rippleAge / 700
      this.ripple.visible = k < 1
      this.ripple.scale.set(1 + 0.7 * k)
      this.ripple.alpha = 1 - k
      if (k >= 1) this.rippleAge = -1
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.ground.destroy({ children: true })
  }
}
