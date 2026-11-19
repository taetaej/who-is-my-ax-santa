import { describe, expect, it } from 'vitest'
import { FIRST_DAY, QUESTIONS, addDays, cleanQuestions, isDay, kstDay, questionFor } from './questions'

describe('kstDay', () => {
  it('한국 시간 자정에 날짜가 바뀐다', () => {
    expect(kstDay(Date.parse('2026-12-01T14:59:00Z'))).toBe('2026-12-01') // 23:59 KST
    expect(kstDay(Date.parse('2026-12-01T15:00:00Z'))).toBe('2026-12-02') // 00:00 KST
  })
})

describe('questionFor', () => {
  it('첫날은 첫 질문, 하루씩 다음 질문, 끝나면 처음으로', () => {
    expect(questionFor(FIRST_DAY)).toBe(QUESTIONS[0])
    expect(questionFor(addDays(FIRST_DAY, 1))).toBe(QUESTIONS[1])
    expect(questionFor(addDays(FIRST_DAY, QUESTIONS.length))).toBe(QUESTIONS[0])
    expect(questionFor(addDays(FIRST_DAY, -1))).toBe(QUESTIONS[QUESTIONS.length - 1]) // 시작 전에도 질문은 나온다
  })
})

describe('운영자 질문 목록', () => {
  it('목록과 시작일을 바꾸면 그대로 따른다', () => {
    const list = ['A', 'B', 'C']
    expect(questionFor('2026-12-10', list, '2026-12-10')).toBe('A')
    expect(questionFor('2026-12-12', list, '2026-12-10')).toBe('C')
    expect(questionFor('2026-12-13', list, '2026-12-10')).toBe('A')
    expect(questionFor('2026-12-13', [], '2026-12-10')).toBe('')
  })
  it('빈 줄은 빼고 길이와 개수를 자른다', () => {
    expect(cleanQuestions(' 첫째 \n\n둘째\n  ')).toEqual(['첫째', '둘째'])
    expect(cleanQuestions(['x'.repeat(200), 3, null])).toEqual(['x'.repeat(80)])
    expect(cleanQuestions(Array.from({ length: 100 }, (_, i) => `q${i}`))).toHaveLength(60)
    expect(cleanQuestions({})).toEqual([])
  })
})

describe('isDay', () => {
  it('날짜 모양만 받는다', () => {
    expect(isDay('2026-12-25')).toBe(true)
    expect(isDay('2026-13-45')).toBe(false)
    expect(isDay("2026-12-01'; drop")).toBe(false)
    expect(isDay(20261201)).toBe(false)
  })
})
