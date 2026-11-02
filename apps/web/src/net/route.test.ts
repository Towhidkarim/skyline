import { describe, expect, it } from 'vitest'
import { routeOf } from './route.ts'

describe('routeOf', () => {
  it('knows the rulebook, with or without a trailing slash', () => {
    expect(routeOf('/how-to-play')).toEqual({ kind: 'rules' })
    expect(routeOf('/how-to-play/')).toEqual({ kind: 'rules' })
  })

  it('keeps the other routes', () => {
    expect(routeOf('/')).toEqual({ kind: 'home' })
    expect(routeOf('/online')).toEqual({ kind: 'online' })
    expect(routeOf('/how-to-play/extra')).toEqual({ kind: 'home' })
  })
})
