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
    const g = sledPoint(SLED.len + SLED.gate)
    expect(actionAt(g.x, g.z)?.action).toBe('sled')
    const p = resolve(g.x, g.z)
    expect(Math.hypot(p.x - g.x, p.z - g.z)).toBeLessThan(0.01)
  })
  it('언덕은 걸어서 못 올라간다', () => {
    const mid = sledPoint(SLED.len * 0.4)
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
