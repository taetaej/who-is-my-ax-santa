import { describe, expect, it } from 'vitest'
import { cleanLook, defaultLook } from './look'

describe('cleanLook', () => {
  it('정해진 선택지는 그대로 둔다', () => {
    const l = { dough: 'choco', hat: 'antlers', hatColor: '#2e7d4f', scarf: '#e06a9a', extra: 'glasses' }
    expect(cleanLook(l)).toEqual(l)
  })

  it('선택지 밖의 값과 다른 칸은 버린다', () => {
    const l = cleanLook({ dough: 'pizza', hat: '<script>', hatColor: 'red', scarf: '#c62a24', extra: 'cape', evil: 1 }, 3)
    const d = defaultLook(3)
    expect(l).toEqual({ dough: d.dough, hat: d.hat, hatColor: d.hatColor, scarf: '#c62a24', extra: d.extra })
    expect(cleanLook(null, 5)).toEqual(defaultLook(5))
  })
})
