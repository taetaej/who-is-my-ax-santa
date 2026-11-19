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
  look: null,
  todo: { tree: true, votes: 7, awards: 7 },
}

describe('엘프 잔소리', () => {
  it('다 했으면 칭찬, ❗ 없음', () => {
    const lines = elfLines(base, 'Q', 0)
    expect(lines.some((l) => l.go)).toBe(false)
    expect(lines[1].text).toContain('다 했네')
    expect(elfChatter(base).alert).toBe(false)
  })

  it('안 한 것만 순서대로 짚고, 바로 가는 버튼을 준다', () => {
    const me: Me = { ...base, manitoOpened: false, letter: 'draft', todo: { tree: false, votes: 2, awards: 7 } }
    const go = elfLines(me, '최애 간식?', 0).flatMap((l) => (l.go ? [l.go.to] : []))
    expect(go).toEqual(['manito', 'tree', 'awards', 'letter'])
    expect(elfLines(me, '최애 간식?', 0).find((l) => l.go?.to === 'tree')?.text).toContain('최애 간식?')
    expect(elfChatter(me)).toMatchObject({ alert: true })
  })

  it('행사 시작 전에는 마니또·소개서 잔소리를 하지 않는다', () => {
    const me: Me = { ...base, phase: 'READY', manitoOpened: false, letter: 'none', todo: { tree: false, votes: 0, awards: 7 } }
    const go = elfLines(me, 'Q', 0).flatMap((l) => (l.go ? [l.go.to] : []))
    expect(go).toEqual(['tree', 'awards'])
  })
})
