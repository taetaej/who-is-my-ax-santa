import { describe, expect, it } from 'vitest'
import { EMPTY_LETTER, cleanLetter, missing } from './letter'

const FULL = {
  keywords: ['프로집중러', '아아수혈중', '리액션장인'],
  first: '차가운',
  now: '다정한',
  stats: [
    { label: '업무 몰입도', value: 99 },
    { label: '점심 메뉴 결정력', value: 40 },
    { label: '퇴근 준비 속도', value: 100 },
  ],
  genre: '잔잔한 일상 힐링물',
  bgm: '아이유 - 밤편지',
  bgmReason: '',
  tmi: '책상에 늘 귤이 있는 습관',
  gift: '귤 한 박스',
  hint: '저는 마니또님보다 출근 시간이 빠릅니다.',
}

describe('cleanLetter', () => {
  it('정해진 칸만 남기고 길이와 범위를 맞춘다', () => {
    const l = cleanLetter({
      ...FULL,
      keywords: ['#커피', '## 고양이', '캠핑', '넷째'],
      stats: [{ label: '  체력 ', value: 250 }, { label: 'x'.repeat(99), value: -3 }, { label: '집중', value: 'high' }],
      hacker: 'drop table',
    })
    expect(l.keywords).toEqual(['커피', '고양이', '캠핑'])
    expect(l.stats).toEqual([
      { label: '체력', value: 100 },
      { label: 'x'.repeat(20), value: 0 },
      { label: '집중', value: 50 },
    ])
    expect(l).not.toHaveProperty('hacker')
  })

  it('이상한 값이 와도 빈 소개서가 된다', () => {
    expect(cleanLetter(null)).toEqual(EMPTY_LETTER)
    expect(cleanLetter({ keywords: 'nope', stats: 3, gift: 3 })).toEqual(EMPTY_LETTER)
  })
})

describe('missing', () => {
  it('빈 문항을 알려주고, BGM 이유는 선택이다', () => {
    expect(missing(EMPTY_LETTER)).toHaveLength(6)
    const full = cleanLetter(FULL)
    expect(missing(full)).toEqual([])
    expect(missing({ ...full, stats: [full.stats[0], { label: '', value: 50 }, full.stats[2]] })).toEqual(['캐릭터 스탯'])
    expect(missing({ ...full, hint: '' })).toEqual(['정체 힌트'])
  })
})
