import { describe, expect, it } from 'vitest'
import { HP_MAX, damageOf, koSecs, levelOf, xpToNext } from './gameRules'
import { SPOTS } from './treasure'
import { BALL_MAX, BALL_START, ballCm, growBall, rollSpeed } from './scene/rolling'
import { alongPath, climbPath } from './scene/sledRide'
import { ARENA, FENCE_R, ISLAND_EDGE, LANTERNS, ROLL, SLED, STAIRS, WALK_MAX, groundY, inArena, inRoll, onSledRun, polar, resolve, sledPoint, stairY } from './scene/world'

describe('⭐ 레벨', () => {
  it('XP 0 이면 Lv.1, 필요한 XP 를 다 채우면 다음 레벨', () => {
    expect(levelOf(0)).toEqual({ lv: 1, cur: 0, need: xpToNext(1) })
    expect(levelOf(xpToNext(1)).lv).toBe(2)
    expect(levelOf(xpToNext(1) + xpToNext(2) - 1)).toEqual({ lv: 2, cur: xpToNext(2) - 1, need: xpToNext(2) })
  })
})

describe('⚔️ 체력', () => {
  it('세게 모을수록 아프고, 3~7번 맞으면 기절', () => {
    expect(damageOf(0)).toBe(25)
    expect(damageOf(1)).toBe(55)
    expect(Math.ceil(HP_MAX / damageOf(1))).toBe(2) // 꾹 모은 눈덩이 두 방
    expect(Math.ceil(HP_MAX / damageOf(0))).toBe(4) // 톡톡 네 방
    expect(damageOf(1, true)).toBe(110) // 💥 왕눈덩이 한 방
  })
  it('처음 기절은 15초, 10분 안에 또 기절하면 1분', () => {
    expect(koSecs(1)).toBe(6)
    expect(koSecs(2)).toBe(15)
    expect(koSecs(5)).toBe(15)
  })
})

describe('⛄ 눈굴리기', () => {
  it('굴릴수록 커지고 무거워서 느려진다 (최대 지름 400cm)', () => {
    const r = growBall(BALL_START, 60)
    expect(r).toBeGreaterThan(0.7)
    expect(rollSpeed(r)).toBeLessThan(rollSpeed(BALL_START))
    expect(ballCm(growBall(BALL_START, 100000))).toBe(400)
    expect(growBall(BALL_START, 100000)).toBe(BALL_MAX)
  })
})

describe('🪐 넓어진 섬', () => {
  it('울타리가 없어서 옛 울타리 자리 어디로든 지나간다 (등불 기둥만 피한다)', () => {
    for (let i = 0; i < LANTERNS.length - 1; i++) {
      const a = (LANTERNS[i].a + LANTERNS[i + 1].a) / 2
      const [x, , z] = polar(a, FENCE_R)
      const p = resolve(x, z)
      expect(Math.hypot(p.x - x, p.z - z)).toBeLessThan(0.01)
    }
    expect(SPOTS.some((s) => s.place.includes('울타리'))).toBe(false) // 숨은 선물 힌트도 등불 기둥으로
  })
  it('🪜 계단은 걸어서 못 올라가고 (썰매 탈 때만), 계단 길 끝은 출발선이다', () => {
    const mid = sledPoint((STAIRS.from + STAIRS.to) / 2, STAIRS.w)
    const p = resolve(mid.x, mid.z)
    expect(Math.hypot(p.x - mid.x, p.z - mid.z)).toBeGreaterThan(0.1)
    expect(stairY(STAIRS.to)).toBeCloseTo(SLED.h)
    const path = climbPath(SLED.len + SLED.gate, SLED.track + 1.2)
    const end = alongPath(path, 999)
    expect(end.done).toBe(true)
    expect(end.w).toBe(0)
    // 올라가는 길 내내 땅 높이가 끊기지 않는다 (계단 → 다리 → 출발선)
    for (let d = 3; d < 40; d += 0.25) {
      const q = alongPath(path, d)
      if (q.done) break
      const at = sledPoint(q.s, q.w)
      if (q.s < STAIRS.from - 0.5) expect(groundY(at.x, at.z), `d=${d}`).toBeGreaterThan(0)
    }
  })
  it('섬 가장자리(낭떠러지) 밖으로는 못 나간다', () => {
    const p = resolve(ISLAND_EDGE + 5, 0)
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(WALK_MAX + 1e-6)
  })
  it('놀이 구역은 울타리 밖 섬 위에 있고, 숨은 선물 자리와 겹치지 않는다', () => {
    for (const z of [ARENA, ROLL]) {
      const d = Math.hypot(z.x, z.z)
      expect(d - z.r).toBeGreaterThan(FENCE_R)
      expect(d + z.r).toBeLessThan(WALK_MAX)
    }
    for (const s of SPOTS) {
      expect(inArena(s.x, s.z) || inRoll(s.x, s.z) || onSledRun(s.x, s.z), s.id).toBe(false)
    }
  })
})
