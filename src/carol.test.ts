import { describe, expect, it } from 'vitest'
import { mmss, onAir, parseSongFile, songsFrom } from './carol'

describe('📻 곡 목록', () => {
  it('파일 이름 → 제목과 작곡자 (앞 번호·확장자는 떼고, 마지막 " - " 뒤가 작곡자)', () => {
    expect(parseSongFile('01 2026 Christmas Carol - 김민지.mp3')).toEqual({ title: '2026 Christmas Carol', composer: '김민지' })
    expect(parseSongFile('2-눈 오는 AX.m4a')).toEqual({ title: '눈 오는 AX', composer: null })
    expect(parseSongFile('03 Jingle - Bell - 서보라.mp3')).toEqual({ title: 'Jingle - Bell', composer: '서보라' })
  })
  it('파일 이름 순서 (번호는 숫자로 비교)', () => {
    const s = songsFrom({ './carols/10 c.mp3': 'u10', './carols/2 b.mp3': 'u2', './carols/01 a.mp3': 'u1' })
    expect(s.map((x) => x.title)).toEqual(['a', 'b', 'c'])
    expect(s[0]).toEqual({ file: '01 a.mp3', title: 'a', composer: null, url: 'u1' })
  })
})

describe('📻 라디오', () => {
  const songs = [
    { t: 'a', d: 100 },
    { t: 'b', d: 0 }, // 길이를 모르면 건너뛴다
    { t: 'c', d: 50 },
  ]
  const d = (s: { d: number }) => s.d
  it('같은 시각이면 누구나 같은 곡의 같은 위치', () => {
    expect(onAir(songs, d, 30_000)).toMatchObject({ song: { t: 'a' }, pos: 30, left: 70, next: { t: 'c' } })
    expect(onAir(songs, d, 120_000)).toMatchObject({ song: { t: 'c' }, pos: 20, next: { t: 'a' } })
    expect(onAir(songs, d, 160_000)).toMatchObject({ song: { t: 'a' }, pos: 10 }) // 150초마다 한 바퀴
  })
  it('곡이 없거나 길이를 모르면 null', () => {
    expect(onAir([], d)).toBeNull()
    expect(onAir([{ t: 'x', d: 0 }], d)).toBeNull()
  })
  it('mm:ss', () => {
    expect(mmss(205)).toBe('3:25')
    expect(mmss(9)).toBe('0:09')
  })
})
