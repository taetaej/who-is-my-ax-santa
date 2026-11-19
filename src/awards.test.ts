import { describe, expect, it } from 'vitest'
import { cleanAwards, tally } from './awards'

describe('cleanAwards', () => {
  it('빈 줄과 중복을 빼고 길이·개수를 자른다', () => {
    expect(cleanAwards(' 커피왕 \n\n커피왕\n칼퇴요정')).toEqual(['커피왕', '칼퇴요정'])
    expect(cleanAwards(['x'.repeat(99), 1])).toEqual(['x'.repeat(40)])
    expect(cleanAwards(Array.from({ length: 30 }, (_, i) => `상${i}`))).toHaveLength(15)
  })
})

describe('tally', () => {
  it('상마다 최다 득표자, 동점이면 공동 수상, 표가 없으면 빈칸', () => {
    const r = tally(
      ['A', 'B', 'C'],
      [
        { category: 'A', nomineeId: 3 },
        { category: 'A', nomineeId: 3 },
        { category: 'A', nomineeId: 5 },
        { category: 'B', nomineeId: 7 },
        { category: 'B', nomineeId: 2 },
        { category: 'X', nomineeId: 9 }, // 목록에 없는 상은 무시
      ],
    )
    expect(r).toEqual([
      { category: 'A', winners: [3], votes: 2 },
      { category: 'B', winners: [2, 7], votes: 1 },
      { category: 'C', winners: [], votes: 0 },
    ])
  })
})
