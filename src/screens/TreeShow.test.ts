import { describe, expect, it } from 'vitest'
import { recapStats } from './TreeShow'

describe('🎄 메시지 트리 돌아보기', () => {
  it('카드·하트 합계, ❤️ TOP, 개근상', () => {
    const s = recapStats({
      people: 3,
      days: [
        { day: '2026-12-01', question: 'Q1', messages: [{ name: '가', body: 'a', hearts: 2 }, { name: '나', body: 'b', hearts: 5 }] },
        { day: '2026-12-02', question: 'Q2', messages: [{ name: '가', body: 'c', hearts: 0 }, { name: '다', body: 'd', hearts: 1 }] },
      ],
    })
    expect(s).toMatchObject({ cards: 4, writers: 3, hearts: 8, perfect: ['가'] })
    expect(s.top.map((m) => m.body)).toEqual(['b', 'a', 'd']) // 하트 0 은 빠진다
  })
})
