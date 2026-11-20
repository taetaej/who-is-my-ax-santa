import { describe, expect, it } from 'vitest'
import type { RevealCard } from '../api'
import { isHit, relay } from './RevealShow'

// 1→2→3→4→1 (산타→챙길 사람). 3 의 산타는 2, 2 의 산타는 1, 1 의 산타는 4.
const card = (santa: number, target: number, suspect: number | null = null): RevealCard => ({
  santa: { id: santa, name: `s${santa}` },
  target: { id: target, name: `t${target}` },
  letter: null,
  letterSubmitted: false,
  guess: suspect === null ? null : { suspect, suspectName: `p${suspect}`, confidence: 50, reason: '', evidence: '', toSanta: '' },
  suspectIsMyTarget: false,
})
const cards = [card(1, 2), card(2, 3, 2), card(3, 4, 1), card(4, 1)]

describe('🎬 공개일 릴레이', () => {
  it('밝혀진 산타가 다음 주인공이 되어 한 바퀴 돈다', () => {
    expect(relay(cards, 3).map((c) => c.target.id)).toEqual([3, 2, 1, 4])
  })
  it('지목한 사람이 진짜 산타면 추리 성공', () => {
    expect(isHit(cards[1])).toBe(true)
    expect(isHit(cards[2])).toBe(false)
    expect(isHit(cards[0])).toBe(false)
  })
})
