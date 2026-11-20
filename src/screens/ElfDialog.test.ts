import { describe, expect, it } from 'vitest'
import type { Me } from '../api'
import { elfChatter, elfLines } from './ElfDialog'

const base: Me = {
  id: 1,
  name: '김민지',
  isAdmin: false,
  phase: 'ACTIVE',
  manitoOpened: true,
  profile: null,
  liveRoom: null,
  letter: 'submitted',
  guess: 'done',
  look: null,
  todo: { tree: true, given: 13, people: 13, gift: null },
}

describe('엘프 잔소리', () => {
  it('다 했으면 칭찬, ❗ 없음', () => {
    const lines = elfLines(base, 'Q', 0)
    expect(lines.some((l) => l.go)).toBe(false)
    expect(lines[1].text).toContain('다 했네')
    expect(elfChatter(base).alert).toBe(false)
  })

  it('안 한 것만 순서대로 짚고, 바로 가는 버튼을 준다', () => {
    const me: Me = { ...base, manitoOpened: false, letter: 'draft', guess: 'none', todo: { tree: false, given: 2, people: 13, gift: null } }
    const go = elfLines(me, '최애 간식?', 0).flatMap((l) => (l.go ? [l.go.to] : []))
    expect(go).toEqual(['manito', 'tree', 'awards', 'letter', 'guess'])
    expect(elfLines(me, '최애 간식?', 0).find((l) => l.go?.to === 'tree')?.text).toContain('최애 간식?')
    expect(elfChatter(me)).toMatchObject({ alert: true })
  })

  it('행사 시작 전에는 마니또·소개서 잔소리를 하지 않는다', () => {
    const me: Me = { ...base, phase: 'READY', manitoOpened: false, letter: 'none', guess: 'none', todo: { tree: false, given: 0, people: 13, gift: null } }
    const go = elfLines(me, 'Q', 0).flatMap((l) => (l.go ? [l.go.to] : []))
    expect(go).toEqual(['tree', 'awards'])
  })

  it('🎁 보물찾기: 평소엔 숨은 상자 수를 알려 주고, 구제 기간엔 위치 힌트를 잔소리', () => {
    const hidden: Me = { ...base, todo: { ...base.todo, gift: { found: false, left: 9, hint: null } } }
    expect(elfLines(hidden, 'Q', 0).at(-1)?.text).toContain('9개')
    expect(elfChatter(hidden).alert).toBe(false)
    const rescue: Me = { ...base, todo: { ...base.todo, gift: { found: false, left: 2, hint: '⛪ 교회 뒤' } } }
    expect(elfLines(rescue, 'Q', 0).some((l) => l.text.includes('⛪ 교회 뒤'))).toBe(true)
    expect(elfChatter(rescue).alert).toBe(true)
    const done: Me = { ...base, todo: { ...base.todo, gift: { found: true, left: 2, hint: null } } }
    expect(elfChatter(done).alert).toBe(false)
  })
})
