import type { GameEvent } from '@skyline/engine'

export const YOUR_TURN_TITLE = '● Your turn · Skyline'

/** The slice of the store this needs (the GameStore satisfies it). */
interface TurnSource {
  onEvent(fn: (e: GameEvent) => void): () => void
  canAct(playerId: string): boolean
}

/** The slice of the document this needs (tests pass a stub). */
interface TitleDoc {
  title: string
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', fn: () => void): void
  removeEventListener(type: 'visibilitychange', fn: () => void): void
}

/**
 * When your turn starts while the tab is in the background (online, mostly), the tab title
 * blinks "Your turn" until you come back to it (D76).
 */
export function watchTurnTitle(store: TurnSource, doc: TitleDoc = document): () => void {
  let timer: ReturnType<typeof setInterval> | null = null
  let base = doc.title
  const stop = () => {
    if (!timer) return
    clearInterval(timer)
    timer = null
    doc.title = base
  }
  const onVisible = () => {
    if (!doc.hidden) stop()
  }
  const off = store.onEvent((e) => {
    if (e.type !== 'TURN_STARTED' || timer || !doc.hidden || !store.canAct(e.playerId)) return
    base = doc.title
    let lit = true
    doc.title = YOUR_TURN_TITLE
    timer = setInterval(() => {
      lit = !lit
      doc.title = lit ? YOUR_TURN_TITLE : base
    }, 1000)
  })
  doc.addEventListener('visibilitychange', onVisible)
  return () => {
    off()
    stop()
    doc.removeEventListener('visibilitychange', onVisible)
  }
}
