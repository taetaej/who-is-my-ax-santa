import { describe, expect, it } from 'vitest'
import { poseAt, tour } from './petPath'

describe('🐈🐕 마을 고양이·강아지', () => {
  it('정해진 길은 마을 안에서 짧은 걸음으로 이어지고, 되돌아와 끊김 없이 반복된다', () => {
    const p = tour(11)
    expect(p.length).toBeGreaterThan(50)
    for (let i = 1; i < p.length; i++) expect(Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z)).toBeLessThan(4.3)
    for (const q of p) expect(Math.hypot(q.x, q.z)).toBeLessThan(15.5)
    expect(Math.hypot(p[0].x - p[p.length - 1].x, p[0].z - p[p.length - 1].z)).toBeLessThan(4.3)
  })
  it('같은 시각이면 누구 화면에서나 같은 자리 (벽시계로만 정해진다)', () => {
    const p = tour(23)
    const t = 1_796_000_000
    expect(poseAt(p, t, 0)).toEqual(poseAt(p, t, 0))
    const a = poseAt(p, t, 0)
    const b = poseAt(p, t + 0.1, 0)
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.2) // 순간이동 없이
  })
})
