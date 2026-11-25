import { describe, expect, it } from 'vitest'
import type { Me } from './api'
import { EVENTS, MATCH_DAY, MISSIONS, OPEN_DAY, REVEAL_DAY, eventsOn, missionOn, missionOpen, treeOn } from './schedule'
import { headline, todosFor } from './screens/Calendar'

const me: Me = {
  id: 1,
  name: '김민지',
  isAdmin: false,
  phase: 'READY',
  manitoOpened: false,
  profile: null,
  liveRoom: null,
  letter: 'none',
  guess: 'none',
  look: null,
  todo: { tree: false, given: 0, people: 13, gift: null },
  missions: [],
  today: '2026-12-01',
}

describe('행사 일정', () => {
  it('산타 미션은 12/7부터 겹치지 않고 이어지고, 공개일 전에 끝난다', () => {
    expect(MISSIONS[0].from).toBe(MATCH_DAY)
    for (let i = 1; i < MISSIONS.length; i++) expect(MISSIONS[i].from > MISSIONS[i - 1].to).toBe(true)
    expect(MISSIONS.at(-1)!.to < REVEAL_DAY).toBe(true)
    expect(missionOn('2026-12-09')?.id).toBe('snack')
    expect(missionOn('2026-12-12')?.id).toBe('cheer') // 주말엔 앞 미션이 이어진다
    expect(missionOn('2026-12-04')).toBeNull()
  })
  it('지난 미션도 공개일 전까진 체크할 수 있다', () => {
    expect(missionOpen(MISSIONS[0], '2026-12-06')).toBe(false)
    expect(missionOpen(MISSIONS[0], '2026-12-16')).toBe(true)
    expect(missionOpen(MISSIONS[0], REVEAL_DAY)).toBe(false)
  })
  it('일정은 날짜 순이고, 메시지 트리는 행사 평일만', () => {
    for (const e of EVENTS) expect(e.from <= e.to).toBe(true)
    expect(EVENTS.map((e) => e.from)).toEqual([...EVENTS.map((e) => e.from)].sort())
    expect(eventsOn(OPEN_DAY).map((e) => e.emoji)).toContain('🎄')
    expect(treeOn('2026-12-01')).toBe(true)
    expect(treeOn('2026-12-05')).toBe(false) // 토
    expect(treeOn(REVEAL_DAY)).toBe(false)
  })
})

describe('오늘 할 일', () => {
  it('오프닝: 꾸미기 · 자기소개 · 트리 · 인터뷰', () => {
    expect(todosFor(me, '2026-12-01').map((t) => t.key)).toEqual(['look', 'profile', 'tree', 'awards'])
    expect(todosFor(me, '2026-11-28')).toEqual([])
    expect(headline({ ...me, today: '2026-11-25' }).text).toContain('D-6')
  })
  it('산타 주간: 이번 미션 + 안 한 지난 미션, 마감 주간엔 리포트·추리노트', () => {
    const santa: Me = { ...me, phase: 'ACTIVE', manitoOpened: true, look: {} as Me['look'], missions: ['snack'] }
    expect(todosFor(santa, '2026-12-11').filter((t) => t.mission).map((t) => t.key)).toEqual(['watch', 'cheer'])
    expect(todosFor(santa, '2026-12-15').map((t) => t.key)).toEqual(expect.arrayContaining(['gift', 'letter', 'guess']))
    expect(headline({ ...santa, today: '2026-12-09' })).toEqual({ text: '🍪 산타 미션 ② 간식 챙기기', done: true })
  })
})
