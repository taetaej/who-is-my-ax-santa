import { describe, expect, it } from 'vitest'
import { makeCycle } from './matching'

const ids = Array.from({ length: 14 }, (_, i) => i + 1)

describe('makeCycle', () => {
  it('모두가 정확히 한 번씩 산타이고 한 번씩 마니또다', () => {
    const pairs = makeCycle(ids)
    expect(pairs.map((p) => p.santaId).sort((a, b) => a - b)).toEqual(ids)
    expect(pairs.map((p) => p.targetId).sort((a, b) => a - b)).toEqual(ids)
  })

  it('자기 자신도, 1:1 맞교환도 없고 하나의 큰 원이다 (1000회)', () => {
    for (let run = 0; run < 1000; run++) {
      const pairs = makeCycle(ids)
      const next = new Map(pairs.map((p) => [p.santaId, p.targetId]))
      for (const [s, t] of next) {
        expect(t).not.toBe(s)
        expect(next.get(t)).not.toBe(s)
      }
      // 한 사람에서 출발해 14번 따라가면 처음으로 돌아오고, 그 전에는 돌아오지 않는다
      let cur = ids[0]
      const seen = new Set<number>()
      for (let k = 0; k < ids.length; k++) {
        seen.add(cur)
        cur = next.get(cur)!
      }
      expect(cur).toBe(ids[0])
      expect(seen.size).toBe(ids.length)
    }
  })

  it('3명 미만이면 거부한다', () => {
    expect(() => makeCycle([1, 2])).toThrow()
  })
})
