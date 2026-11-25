import { beforeEach, describe, expect, it } from 'vitest'
import type { CookieState } from './Cookie'
import { FIELD, TARGETS, inSnowField, receive, snow, spawnBall, stepSnow, throwBall } from './snowball'

const newCookieState = (x = 0, z = 0): CookieState => ({ x, z, y: 0, rot: 0, speed: 0, waveUntil: 0, say: null, pose: 'stand', cup: false, emote: null, pop: null, hp: 100, ball: 0, lv: 1 })
const run = (secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) stepSnow(1 / 60)
}
const face = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz)

describe('☃️ 눈싸움', () => {
  beforeEach(() => {
    snow.balls = []
    snow.splats = []
    snow.peers.clear()
    snow.me = null
    snow.send = null
    snow.say = null
  })

  it('눈밭 안에서만 던질 수 있다', () => {
    expect(inSnowField(FIELD.x, FIELD.z)).toBe(true)
    expect(inSnowField(0, 0)).toBe(false)
  })

  it('과녁 눈사람을 맞히면 흔들리고 "명중"', () => {
    const said: string[] = []
    snow.say = (t) => said.push(t)
    const t = TARGETS[1]
    const s = newCookieState(t.x + (FIELD.x - t.x) * 0.6, t.z + (FIELD.z - t.z) * 0.6)
    s.rot = face(s.x, s.z, t.x, t.z)
    throwBall({ id: 1, name: '나', s })
    run(1.5)
        expect(said.some((x) => /명중|퍽|KO/.test(x))).toBe(true)
  })

  it('남이 던진 눈덩이에 맞으면 "퍽!" 하고 던진 사람에게 알린다', () => {
    const sent: unknown[] = []
    const said: string[] = []
    snow.send = (m) => sent.push(m)
    snow.say = (t) => said.push(t)
    snow.me = { id: 2, name: '수현', s: newCookieState(FIELD.x + 2, FIELD.z) }
    spawnBall(FIELD.x, FIELD.z, face(FIELD.x, FIELD.z, FIELD.x + 2, FIELD.z), 7, '민지', false)
    run(1)
    expect(said[0]).toContain('민지')
    expect(sent).toContainEqual({ k: 'hit', by: 7, byName: '민지', name: '수현', dmg: 25, ko: false })
  })

  it('내가 던진 공이 맞았다는 소식을 받으면 "명중!"', () => {
    const said: string[] = []
    snow.say = (t) => said.push(t)
    snow.me = { id: 7, name: '민지', s: newCookieState() }
    receive({ k: 'hit', by: 7, name: '수현' })
    receive({ k: 'hit', by: 9, name: '남' })
    expect(said).toEqual(['명중! 🎯 수현님'])
  })

  it('KO 소식을 받으면 "KO!", 깨워 준 소식은 깨워진 사람만', () => {
    const said: string[] = []
    const revived: string[] = []
    snow.say = (t) => said.push(t)
    snow.revived = (n) => revived.push(n)
    snow.me = { id: 7, name: '민지', s: newCookieState() }
    receive({ k: 'hit', by: 7, name: '수현', dmg: 40, ko: true })
    receive({ k: 'revive', to: 7, by: 3, name: '지아' })
    receive({ k: 'revive', to: 9, by: 3, name: '지아' })
    expect(said[0]).toContain('KO')
    expect(revived).toEqual(['지아'])
    snow.revived = null
  })

  it('세게 모아 던질수록 멀리 날아가고, 기절 중이면 맞아도 아무 일 없다', () => {
    const far = (p: number) => {
      snow.balls = []
      spawnBall(0, 0, 0, 1, 'a', true, p)
      const b = snow.balls[0]
      while (b.y > 0.05) {
        b.vy -= 9.8 / 60
        b.x += b.vx / 60
        b.y += b.vy / 60
        b.z += b.vz / 60
      }
      return b.z
    }
    expect(far(1)).toBeGreaterThan(far(0) * 1.4)
    const sent: unknown[] = []
    snow.send = (m) => sent.push(m)
    snow.hurt = () => null
    snow.me = { id: 2, name: '수현', s: newCookieState(FIELD.x + 2, FIELD.z) }
    spawnBall(FIELD.x, FIELD.z, face(FIELD.x, FIELD.z, FIELD.x + 2, FIELD.z), 7, '민지', false)
    run(1)
    expect(sent).toEqual([])
    snow.hurt = null
  })

  it('⚔️ 기절 소식은 모두의 소식판에, 아이템을 누가 먹으면 모두의 화면에서 사라진다', async () => {
    const { padState, PADS } = await import('./powerups')
    const feed: string[] = []
    snow.feed = (t) => feed.push(t)
    receive({ k: 'hit', by: 9, byName: '민지', name: '수현', dmg: 55, ko: true })
    expect(feed.at(-1)).toContain('민지 → 수현 KO')
    const now = 1_796_000_000 + 5
    const st = padState(0, now)
    receive({ k: 'pick', pad: 0, cycle: st.cycle, name: '민지', kind: st.kind })
    expect(padState(0, now).visible).toBe(false)
    expect(PADS).toHaveLength(4)
    snow.feed = null
  })
})
