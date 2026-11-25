import { describe, expect, it } from 'vitest'
import { ROCKET_CYCLE, ROCKET_T, launch, rocket, rocketPose } from './rocket'

describe('🚀 WithSet 호', () => {
  it('카운트다운 → 발사 → 사라짐 → 착륙 → 제자리', () => {
    expect(rocketPose(-1).phase).toBe('idle')
    expect(rocketPose(1).phase).toBe('count')
    expect(rocketPose(1).y).toBeLessThan(0.3)
    const top = rocketPose(ROCKET_T.count + ROCKET_T.fly - 0.01)
    expect(top.phase).toBe('fly')
    expect(top.y).toBeGreaterThan(40) // 하늘 너머로
    expect(rocketPose(ROCKET_T.count + ROCKET_T.fly + 1).visible).toBe(false)
    const landing = rocketPose(ROCKET_CYCLE - 0.01)
    expect(landing.phase).toBe('land')
    expect(landing.y).toBeLessThan(0.1) // 살살 내려앉는다
    expect(rocketPose(ROCKET_CYCLE).phase).toBe('idle')
  })
  it('날고 있는 동안은 다시 못 쏜다 (방송이 겹쳐도 한 번)', () => {
    rocket.at = -1000
    expect(launch(100)).toBe(true)
    expect(launch(103)).toBe(false)
    expect(launch(100 + ROCKET_CYCLE + 0.01)).toBe(true)
  })
})
