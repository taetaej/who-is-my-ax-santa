import { describe, expect, it } from 'vitest'
import { SPOTS } from '../treasure'
import { EMOTES } from './emote'
import { SLED, actionAt, groundY, onSledRun, resolve, sledPoint, sledProfile } from './world'

describe('🛷 눈썰매장', () => {
  it('꼭대기는 언덕 높이, 비탈 끝과 멀리는 0', () => {
    const top = sledPoint(-0.3)
    expect(groundY(top.x, top.z)).toBeCloseTo(SLED.h)
    const end = sledPoint(SLED.len + 0.1)
    expect(groundY(end.x, end.z)).toBe(0)
    expect(groundY(0, 0)).toBe(0)
  })
  it('내려갈수록 낮아진다', () => {
    for (let s = 0; s < SLED.len; s += 0.5) expect(sledProfile(s + 0.5)).toBeLessThanOrEqual(sledProfile(s))
  })
  it('타는 곳에서 E 로 탈 수 있고, 그 자리는 막혀 있지 않다', () => {
    const g = sledPoint(SLED.len + SLED.gate, SLED.track + 1.2)
    expect(actionAt(g.x, g.z)?.action).toBe('sled')
    const p = resolve(g.x, g.z)
    expect(Math.hypot(p.x - g.x, p.z - g.z)).toBeLessThan(0.01)
  })
  it('언덕은 걸어서 못 올라간다', () => {
    const mid = sledPoint(SLED.len * 0.5)
    const p = resolve(mid.x, mid.z)
    expect(Math.hypot(p.x - mid.x, p.z - mid.z)).toBeGreaterThan(0.1)
  })
  it('숨은 선물 자리와 겹치지 않는다', () => {
    for (const s of SPOTS) expect(onSledRun(s.x, s.z), s.id).toBe(false)
  })
  it('미끄러져 내려온 끝자리도 막혀 있지 않다', () => {
    for (const w of [-1.3, 0, 1.3]) {
      const e = sledPoint(SLED.len + SLED.run, w)
      const p = resolve(e.x, e.z)
      expect(Math.hypot(p.x - e.x, p.z - e.z)).toBeLessThan(0.6)
    }
  })
})

describe('💬 반응', () => {
  it('숫자키 1~8 에 하나씩, id 는 겹치지 않는다', () => {
    expect(EMOTES).toHaveLength(8)
    expect(new Set(EMOTES.map((e) => e.id)).size).toBe(8)
  })
  it('받는 사람 이름이 들어간다', () => {
    for (const e of EMOTES) {
      expect(e.to('민지')).toContain('민지')
      expect(e.got('민지')).toContain('민지')
    }
  })
})

import { RECORD_MAX } from '../gameRules'
import { POWER_MAX, SLED_FAR, bump, newRide, sledDistance, stepDown } from './sledRide'
import { SLED_OBSTACLES } from './world'

/** 꼭대기에서 출발해 끝날 때까지. slalom = 눈사람 옆으로 비켜 가기 */
function slide(power: number, slalom: boolean) {
  const r = newRide(-0.5, 0)
  r.phase = 'down'
  r.power = power
  let res: 'go' | 'stop' | 'crash' = 'go'
  let maxAir = 0
  for (let i = 0; i < 60 * 40 && res === 'go'; i++) {
    let side = 0
    if (slalom) {
      const next = SLED_OBSTACLES.find((o) => o.s > r.s - 0.6)
      const aim = next ? (next.w < 0 ? next.w + 0.9 : next.w - 0.9) : 0
      side = Math.max(-1, Math.min(1, (aim - r.w) * 5))
    }
    res = stepDown(r, 1 / 60, side)
    maxAir = Math.max(maxAir, r.air)
  }
  return { res, dist: sledDistance(r.s), maxAir }
}

describe('🛷 썰매 기록', () => {
  it('서버가 쓰는 기록 최댓값이 실제 최대 거리와 같다', () => {
    expect(RECORD_MAX.sled).toBeCloseTo(SLED_FAR, 5)
  })
  it('똑바로만 가면 슬라롬 눈사람에 박는다', () => {
    expect(slide(POWER_MAX, false).res).toBe('crash')
  })
  it('점프대에서 날아오른다', () => {
    expect(slide(2, true).maxAir).toBeGreaterThan(0.5)
  })
  it('눈사람을 피하면 끝까지 미끄러지고, 힘을 모을수록 멀리 간다', () => {
    const weak = slide(0, true)
    const strong = slide(POWER_MAX, true)
    expect(weak.res).toBe('stop')
    expect(strong.res).toBe('stop')
    expect(strong.dist).toBeGreaterThan(weak.dist + 2)
    expect(strong.dist).toBeLessThanOrEqual(SLED_FAR)
  })
  it('썰매끼리 부딪히면 옆으로 튕기고, 뒤에서 박은 쪽은 느려진다', () => {
    const r = newRide(3, 0)
    r.phase = 'down'
    r.v = 4
    expect(bump(r, { s: 3.3, w: 0.2 }, 1)).toBe(true)
    expect(r.wv).toBeLessThan(0)
    expect(r.v).toBeLessThan(4)
    expect(bump(r, { s: 3.3, w: 0.2 }, 1.1)).toBe(false) // 잠깐은 다시 안 튕긴다
    expect(bump(r, { s: 9, w: 0 }, 5)).toBe(false) // 멀면 안 부딪힘
  })
})

import { pickLane, shiftLane, climbPath } from './sledRide'
import { ISLAND_EDGE, SLED_LANES, STAIRS } from './world'

describe('🛷 여럿이 타는 넓은 썰매장', () => {
  it('꼭대기 줄은 이미 있는 사람과 가장 먼 곳, 계단 길은 그 줄에서 끝난다', () => {
    expect(SLED_LANES.every((l) => Math.abs(l) < SLED.track - 0.3)).toBe(true)
    expect(pickLane([SLED_LANES[0]])).toBe(SLED_LANES[3])
    expect(pickLane([-1.9, 1.9])).not.toBe(-1.9)
    expect(climbPath(12, 4, 0.65).at(-1)).toEqual({ s: -0.5, w: 0.65 })
  })
  it('꼭대기에서 ←→ 로 줄을 옮기되 길 밖으로는 못 간다', () => {
    const r = newRide(-0.5, 0, 0, 0)
    for (let i = 0; i < 300; i++) shiftLane(r, 1 / 60, 1)
    expect(r.w).toBeCloseTo(SLED.track - 0.4)
  })
  it('범퍼 눈더미는 끝내지 않고 옆으로 튕겨 낸다', () => {
    const r = newRide(4.0, 0)
    r.phase = 'down'
    r.w = -1.3
    r.v = 5
    let res: string = 'go'
    let pillowed = false
    for (let i = 0; i < 30 && res === 'go'; i++) {
      res = stepDown(r, 1 / 60, 0)
      pillowed ||= r.pillowed
    }
    expect(res).toBe('go')
    expect(pillowed).toBe(true)
    expect(Math.abs(r.wv)).toBeGreaterThan(1)
  })
  it('산과 계단이 섬 안에 있다', () => {
    for (const [s, w] of [
      [-SLED.deck - SLED.back, -SLED.half],
      [SLED.len, STAIRS.w + STAIRS.half],
      [SLED.len + SLED.run, -SLED.track - 0.6],
    ])
      expect(Math.hypot(sledPoint(s, w).x, sledPoint(s, w).z)).toBeLessThan(ISLAND_EDGE - 1)
  })
})
