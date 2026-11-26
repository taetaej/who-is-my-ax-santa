import { describe, expect, it } from 'vitest'
import { guestAllowed, guestNick } from './app'

describe('👀 게스트', () => {
  it('별명: 글자·숫자·공백만, 1~8자', () => {
    expect(guestNick('  눈사람  1 ')).toBe('눈사람 1')
    expect(guestNick('<b>루돌프</b>')).toBe('b루돌프b')
    expect(guestNick('')).toBeNull()
    expect(guestNick('아주아주아주긴별명')).toBeNull()
    expect(guestNick(null)).toBeNull()
  })
  it('마을·눈싸움·기록판 보기만 되고 산타 게임은 막힌다', () => {
    expect(guestAllowed('GET', '/api/me')).toBe(true)
    expect(guestAllowed('POST', '/api/me/live-auth')).toBe(true)
    expect(guestAllowed('GET', '/api/records/sled')).toBe(true)
    expect(guestAllowed('POST', '/api/records/sled')).toBe(false)
    expect(guestAllowed('POST', '/api/xp')).toBe(false)
    expect(guestAllowed('GET', '/api/me/manito')).toBe(false)
    expect(guestAllowed('PUT', '/api/me/look')).toBe(false)
    expect(guestAllowed('GET', '/api/tree/today')).toBe(false)
    expect(guestAllowed('GET', '/api/admin/status')).toBe(false)
  })
})
