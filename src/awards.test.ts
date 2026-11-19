import { describe, expect, it } from 'vitest'
import { DEFAULT_AWARD, KEYWORDS, awardFor, cleanGift } from './awards'

describe('KEYWORDS', () => {
  it('id 가 겹치지 않는다', () => {
    expect(new Set(KEYWORDS.map((k) => k.id)).size).toBe(KEYWORDS.length)
  })
})

describe('cleanGift', () => {
  it('없는 칩·중복을 빼고 3개까지, 직접 쓰기는 15자', () => {
    expect(cleanGift({ chips: ['detail', 'detail', 'nope', 'idea', 'ai', 'mood'], custom: '  엑셀   마법사  ' })).toEqual({
      chips: ['detail', 'idea', 'ai'],
      custom: '엑셀 마법사',
    })
    expect(cleanGift({ chips: 'detail', custom: 'x'.repeat(30) })).toEqual({ chips: [], custom: 'x'.repeat(15) })
    expect(cleanGift(null)).toEqual({ chips: [], custom: null })
  })
})

describe('awardFor', () => {
  it('가장 많이 받은 칩이 상이 된다', () => {
    const r = awardFor([
      { chips: ['detail', 'idea'], custom: null },
      { chips: ['detail'], custom: '엑셀 마법사' },
      { chips: [], custom: null },
    ])
    expect(r.titles).toEqual(['🔍 꼼꼼 장인상'])
    expect(r.words).toEqual([
      { label: '🔍 꼼꼼함', n: 2 },
      { label: '💡 아이디어', n: 1 },
      { label: '엑셀 마법사', n: 1 },
    ])
    expect(r.givers).toBe(2)
  })

  it('공동 1등이면 칩 목록 순서로 앞의 둘 (2관왕)', () => {
    const r = awardFor([
      { chips: ['coffee', 'reaction', 'detail'], custom: null },
      { chips: ['coffee', 'reaction', 'detail'], custom: null },
    ])
    expect(r.titles).toEqual(['🔍 꼼꼼 장인상', '👏 리액션 장인상'])
  })

  it('직접 쓴 키워드가 1등이면 그대로 상 이름', () => {
    const r = awardFor([
      { chips: [], custom: '엑셀 마법사' },
      { chips: ['idea'], custom: '엑셀 마법사' },
    ])
    expect(r.titles).toEqual(["✍️ '엑셀 마법사'상"])
  })

  it('아무것도 못 받으면 기본 상', () => {
    expect(awardFor([])).toEqual({ titles: [DEFAULT_AWARD], words: [], givers: 0 })
  })
})
