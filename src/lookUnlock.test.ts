import { describe, expect, it } from 'vitest'
import { cleanLook, randomLook, unlockLevel, unlocksAt } from './look'

describe('🔓 레벨로 열리는 꾸미기', () => {
  it('레벨이 모자라면 저장할 때 기본값으로 바뀐다', () => {
    const want = { hat: 'astro', outfit: 'tux', extra: 'jetpack', dough: 'gold' }
    const low = cleanLook(want, 1, 2)
    expect(low.hat).not.toBe('astro')
    expect(low.outfit).toBe('none')
    expect(low.extra).toBe('none')
    expect(low.dough).not.toBe('gold')
    const high = cleanLook(want, 1, 10)
    expect(high).toMatchObject(want)
  })
  it('레벨 안 넘기면(화면에서 남 모습 그릴 때) 그대로 보여 준다', () => {
    expect(cleanLook({ outfit: 'padding' }, 1).outfit).toBe('padding')
  })
  it('열리는 레벨표', () => {
    expect(unlockLevel('outfit', 'knit')).toBe(2)
    expect(unlockLevel('hat', 'santa')).toBe(1)
    expect(unlocksAt(3)).toEqual(['hat:bolt'])
    for (let i = 0; i < 30; i++) {
      const l = randomLook(Math.random, 1)
      expect(l.outfit).toBe('none')
      expect(['bolt', 'astro']).not.toContain(l.hat)
    }
  })
})
