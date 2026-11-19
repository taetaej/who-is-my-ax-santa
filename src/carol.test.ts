import { describe, expect, it } from 'vitest'
import { syncedPosition, youtubeId } from './carol'

describe('youtubeId', () => {
  it('여러 모양의 유튜브 주소에서 ID 를 뽑는다', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId(' dQw4w9WgXcQ ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('')).toBeNull()
    expect(youtubeId('https://example.com')).toBeNull()
  })
})

describe('syncedPosition', () => {
  it('같은 시각이면 누구나 같은 위치, 곡 길이 안에서 돈다', () => {
    expect(syncedPosition(200, 1_000_000)).toBe(1000 % 200)
    expect(syncedPosition(180, 1_234_567)).toBeCloseTo(1234.567 % 180)
    expect(syncedPosition(0, 5000)).toBe(0)
  })
})
