import { describe, expect, it } from 'vitest'
import { FIRST_DAY, QUESTIONS, cleanQuestions, isDay, kstDay, questionDay, questionFor, treeDay } from './questions'

describe('kstDay', () => {
  it('한국 시간 자정에 날짜가 바뀐다', () => {
    expect(kstDay(Date.parse('2026-12-01T14:59:00Z'))).toBe('2026-12-01') // 23:59 KST
    expect(kstDay(Date.parse('2026-12-01T15:00:00Z'))).toBe('2026-12-02') // 00:00 KST
  })
})

describe('questionFor (평일만)', () => {
  it('12/1(화) 오픈부터 평일마다 다음 질문, 주말은 금요일 질문 그대로', () => {
    expect(questionFor('2026-12-01')).toBe(QUESTIONS[0]) // 화, 오픈
    expect(questionFor('2026-12-04')).toBe(QUESTIONS[3]) // 금, 오프닝 마지막
    expect(questionFor('2026-12-05')).toBe(QUESTIONS[3]) // 토 → 금요일 질문
    expect(questionFor('2026-12-07')).toBe(QUESTIONS[4]) // 월, 산타 발표
    expect(questionFor('2026-12-11')).toBe(QUESTIONS[8]) // 금
    expect(questionFor('2026-12-13')).toBe(QUESTIONS[8]) // 일 → 금요일 질문
    expect(questionFor('2026-12-16')).toBe(QUESTIONS[11]) // 수, 공개일 전날
  })
  it('주차별 질문이 정해진 날짜에 나온다', () => {
    expect(questionFor('2026-12-01')).toContain('가장 많이 쓴 툴')
    expect(questionFor('2026-12-04')).toContain('크리스마스 소원')
    expect(questionFor('2026-12-07')).toContain('꿀팁')
    expect(questionFor('2026-12-11')).toContain('가장 큰 산')
    expect(questionFor('2026-12-14')).toContain('한 단어')
    expect(questionFor('2026-12-16')).toContain('남기는 한마디')
  })
  it('행사 평일 12일에 질문이 겹치지 않는다', () => {
    const days = Array.from({ length: 12 }, (_, i) => questionDay(FIRST_DAY, i))
    expect(days.at(-1)).toBe('2026-12-16')
    expect(new Set(days.map((d) => questionFor(d))).size).toBe(12)
  })
  it('시작 전에도 질문이 나오고, 목록이 끝나면 처음으로', () => {
    expect(questionFor('2026-11-30')).toBe(QUESTIONS[QUESTIONS.length - 1]) // 오픈 전 월요일
    expect(questionFor(questionDay(FIRST_DAY, QUESTIONS.length))).toBe(QUESTIONS[0])
  })
})

describe('treeDay · questionDay', () => {
  it('주말의 "오늘"은 금요일', () => {
    expect(treeDay(Date.parse('2026-12-12T03:00:00Z'))).toBe('2026-12-11') // 토 낮 (KST)
    expect(treeDay(Date.parse('2026-12-13T14:59:00Z'))).toBe('2026-12-11') // 일 23:59 KST
    expect(treeDay(Date.parse('2026-12-13T15:00:00Z'))).toBe('2026-12-14') // 월 00:00 KST
  })
  it('질문 번호 → 날짜 (평일만)', () => {
    expect([0, 3, 4, 11].map((i) => questionDay(FIRST_DAY, i))).toEqual(['2026-12-01', '2026-12-04', '2026-12-07', '2026-12-16'])
    expect(questionDay('2026-12-12', 0)).toBe('2026-12-14') // 시작일이 주말이면 월요일부터
  })
})

describe('운영자 질문 목록', () => {
  it('목록과 시작일을 바꾸면 그대로 따른다', () => {
    const list = ['A', 'B', 'C']
    expect(questionFor('2026-12-08', list, '2026-12-08')).toBe('A') // 화
    expect(questionFor('2026-12-10', list, '2026-12-08')).toBe('C') // 목
    expect(questionFor('2026-12-11', list, '2026-12-08')).toBe('A') // 금, 한 바퀴
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
