import { describe, expect, it } from 'vitest'
import { ANSWER_MAX, INTERVIEW_MAX, cleanChat, nickname, questions } from './interview'

describe('🧝 엘프 인터뷰', () => {
  it('대화 정리: 빈 답·이상한 값은 빼고, 답은 공백 정리 후 자르고, 최대 3개', () => {
    const long = 'ㅋ'.repeat(ANSWER_MAX + 50)
    const chat = cleanChat([{ q: 'Q1', a: '  배포 날   구해 줬어요 ' }, { q: 'Q2', a: '   ' }, 'x', { q: 3, a: 'no' }, { q: 'Q3', a: long }, { q: 'Q4', a: 'a' }, { q: 'Q5', a: 'b' }])
    expect(chat).toHaveLength(INTERVIEW_MAX)
    expect(chat[0]).toEqual({ q: 'Q1', a: '배포 날 구해 줬어요' })
    expect(chat[1].a).toHaveLength(ANSWER_MAX)
    expect(cleanChat('nope')).toEqual([])
  })
  it('질문은 3개, 이름이 들어간다', () => {
    expect(questions('민지')).toHaveLength(INTERVIEW_MAX)
    expect(questions('민지')[0]).toContain('민지님')
  })
  it('새로 온 사람이 끼면 첫인상 질문 (마지막 한 단어 질문은 같다)', () => {
    const fresh = questions('민지', true)
    expect(fresh).toHaveLength(INTERVIEW_MAX)
    expect(fresh[0]).toContain('첫인상')
    expect(questions('민지')[0]).not.toContain('첫인상')
    expect(fresh[2]).toBe(questions('민지')[2])
  })
  it('마지막 답이 짧으면 별명 키워드로', () => {
    expect(nickname(' "엑셀 마법사"! ')).toBe('엑셀 마법사')
    expect(nickname('정말 길게 설명하자면 언제나 팀을 먼저 생각하는 사람')).toBeNull()
    expect(nickname(undefined)).toBeNull()
  })
})
