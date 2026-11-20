import { describe, expect, it } from 'vitest'
import { DUD_LINES, REAL, dudLine } from '../server/treasure'
import { SPOTS, TIERS, nearestSpot } from './treasure'

describe('보물찾기 자리', () => {
  it('id 가 겹치지 않고, 진짜는 모두 있는 자리이며 14개', () => {
    expect(new Set(SPOTS.map((s) => s.id)).size).toBe(SPOTS.length)
    const real = Object.keys(REAL)
    expect(real).toHaveLength(14)
    for (const id of real) expect(SPOTS.some((s) => s.id === id)).toBe(true)
    expect(SPOTS.length - real.length).toBeGreaterThanOrEqual(20) // 꽝이 훨씬 많다
    for (const t of TIERS) expect(Object.values(REAL).filter((v) => v === t.tier).length, t.label).toBe(t.count) // 1등 1 · 2등 2 · 3등 4 · 4등 7
  })

  it('자리끼리 너무 붙어 있지 않다 (E 가 엉뚱한 걸 열지 않게)', () => {
    for (const a of SPOTS) for (const b of SPOTS) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}-${b.id}`).toBeGreaterThan(0.9)
  })

  it('가장 가까운 자리만 고르고, 꽝 한마디는 자리마다 정해져 있다', () => {
    const s = SPOTS[0]
    expect(
      nearestSpot(
        s.x + 0.2,
        s.z,
        SPOTS.map((x) => x.id),
      )?.id,
    ).toBe(s.id)
    expect(nearestSpot(s.x + 5, s.z + 5, [s.id])).toBeNull()
    expect(DUD_LINES).toContain(dudLine('s02'))
    expect(dudLine('s02')).toBe(dudLine('s02'))
  })
})
