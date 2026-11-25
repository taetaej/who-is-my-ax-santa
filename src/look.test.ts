import { describe, expect, it } from 'vitest'
import { cleanLook, defaultLook, randomLook } from './look'

describe('cleanLook', () => {
  it('정해진 선택지는 그대로 둔다', () => {
    const l = { dough: 'choco', hat: 'antlers', hatColor: '#2e7d4f', scarf: '#e06a9a', extra: 'glasses', eyes: 'wink', mouth: 'cat', cheek: 'freckle', deco: 'heart', outfit: 'knit' }
    expect(cleanLook(l)).toEqual(l)
  })

  it('선택지 밖의 값과 다른 칸은 버린다', () => {
    const l = cleanLook({ dough: 'pizza', hat: '<script>', hatColor: 'red', scarf: '#c62a24', extra: 'rocketboots', eyes: 'laser', outfit: 'bikini', evil: 1 }, 3)
    const d = defaultLook(3)
    expect(l).toEqual({ ...d, scarf: '#c62a24' })
    expect(cleanLook(null, 5)).toEqual(defaultLook(5))
  })

  it('예전에 저장된 모습(얼굴 칸 없음)은 얼굴을 기본값으로 채운다', () => {
    const old = { dough: 'light', hat: 'crown', hatColor: '#2e7d4f', scarf: '#e06a9a', extra: 'bow' }
    expect(cleanLook(old, 2)).toEqual({ ...old, eyes: 'dot', mouth: 'smile', cheek: 'pink', deco: 'buttons', outfit: 'none' })
  })

  it('🎲 아무거나도 늘 올바른 모습', () => {
    for (let i = 0; i < 30; i++) {
      const l = randomLook()
      expect(cleanLook(l)).toEqual(l)
    }
  })
})
