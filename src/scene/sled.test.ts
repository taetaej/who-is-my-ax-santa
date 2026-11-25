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
