import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameEvent } from '@skyline/engine'
import { YOUR_TURN_TITLE, watchTurnTitle } from './turnTitle.ts'

function setup(hidden: boolean) {
  let emit: (e: GameEvent) => void = () => {}
  let onVisible: () => void = () => {}
  const doc = {
    title: 'Skyline',
    hidden,
    addEventListener: (_: string, fn: () => void) => {
      onVisible = fn
    },
    removeEventListener: () => {},
  }
  const store = {
    onEvent: (fn: (e: GameEvent) => void) => {
      emit = fn
      return () => {}
    },
    canAct: (id: string) => id === 'me',
  }
  const stop = watchTurnTitle(store, doc)
  return {
    doc,
    emit: (playerId: string) => emit({ type: 'TURN_STARTED', playerId, round: 1 }),
    visible: () => onVisible(),
    stop,
  }
}

describe('watchTurnTitle', () => {
  afterEach(() => vi.useRealTimers())

  it('blinks the title when our turn starts in a background tab, and stops on return', () => {
    vi.useFakeTimers()
    const t = setup(true)
    t.emit('me')
    expect(t.doc.title).toBe(YOUR_TURN_TITLE)
    vi.advanceTimersByTime(1000)
    expect(t.doc.title).toBe('Skyline')
    vi.advanceTimersByTime(1000)
    expect(t.doc.title).toBe(YOUR_TURN_TITLE)
    t.doc.hidden = false
    t.visible()
    expect(t.doc.title).toBe('Skyline')
  })

  it("ignores other players' turns and a tab in front", () => {
    const back = setup(true)
    back.emit('bot')
    expect(back.doc.title).toBe('Skyline')
    const front = setup(false)
    front.emit('me')
    expect(front.doc.title).toBe('Skyline')
  })
})
