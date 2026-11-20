import { describe, expect, it } from 'vitest'
import { cleanGuess, guessDone } from './guess'

describe('🔍 추리노트', () => {
  it('나를 뺀 사람만 지목할 수 있고, 확신도는 10~100 으로 맞춘다', () => {
    expect(cleanGuess({ suspect: 1, confidence: 999 }, [2, 3])).toMatchObject({ suspect: null, confidence: 100 })
    expect(cleanGuess({ suspect: 3, confidence: 0 }, [2, 3])).toMatchObject({ suspect: 3, confidence: 10 })
    expect(cleanGuess({ suspect: '3', reason: 5 }, [3])).toMatchObject({ suspect: null, reason: '' })
  })

  it('지목·이유·한마디가 있으면 완성 (목격담은 선택)', () => {
    const g = cleanGuess({ suspect: 2, reason: '간식 취향', toSanta: '고마워요' }, [2])
    expect(guessDone(g)).toBe(true)
    expect(guessDone({ ...g, toSanta: '' })).toBe(false)
  })
})
