// 🛷 썰매 한 번 타기: 움직임 계산만 (그리기는 Player·Cookie). 테스트에서도 같은 계산을 돌린다.
//   up    → 타는 곳에서 꼭대기까지 걸어 올라간다
//   ready → 꼭대기에서 Space 연타로 출발 힘을 모은다
//   down  → 내려와서 평지로 미끄러진다. 광장 가로등에 박으면 거기서 끝 (←→ 로 피하기)
// 기록 = 출발선에서 멈춘 곳까지 거리 (m)

import { LAMP_ANGLES, LAMP_R, SLED, polar, sledLocal, sledProfile } from './world'

export const READY_SECS = 1.8 // 힘 모으는 시간
export const POWER_TAP = 0.45 // Space 한 번에 모이는 힘
export const POWER_MAX = 4
export const SLED_FAR = SLED.len + SLED.run // 여기서 더는 못 간다 (얼음 연못 앞)
export const BUMP_R = 0.6 // 썰매끼리 이 거리면 쿵

/** 썰매 길 위에 서 있는 광장 가로등 (s, w) */
export const SLED_LAMPS = LAMP_ANGLES.map((a) => {
  const [x, , z] = polar(a, LAMP_R)
  return sledLocal(x, z)
}).filter((l) => l.s > SLED.len && l.s < SLED_FAR + 0.5 && Math.abs(l.w) < 2)
const LAMP_HIT = 0.55

export type Ride = {
  phase: 'up' | 'ready' | 'down'
  s: number
  w: number
  v: number
  wv: number // 옆으로 튕겨 나가는 속도 (부딪혔을 때)
  at: number // 지금 단계를 시작한 시각 (초)
  power: number // 모은 힘
  wow: boolean // "와아아" 한 번만
  bumpAt: number
}

export const newRide = (s: number, t: number): Ride => ({ phase: 'up', s, w: 0, v: 0, wv: 0, at: t, power: 0, wow: false, bumpAt: -10 })

/** 옆으로 갈 수 있는 폭: 비탈은 썰매 길 안, 평지는 조금 더 넓게 */
export const sideLimit = (s: number) => (s > SLED.len ? 1.4 : SLED.track - 0.1)

/** 내려가는 한 프레임. side = 방향키 (-1..1). 끝나면 'stop' 또는 'crash' */
export function stepDown(r: Ride, dt: number, side: number): 'go' | 'stop' | 'crash' {
  const slope = (sledProfile(r.s - 0.05) - sledProfile(r.s + 0.05)) / 0.1
  const flat = r.s > SLED.len
  // 방향을 틀면 조금씩 느려진다 (가로등은 피하되 덜 틀수록 멀리 간다)
  r.v = Math.max(0, r.v + (5.8 * slope - (flat ? 4.2 : 0.3) - 0.04 * r.v * r.v - 0.9 * Math.abs(side)) * dt)
  if (r.s < 0.8) r.v = Math.max(r.v, 1.2 + r.power * 1.35) // 출발: 모은 힘으로 밀고 나간다
  r.s = Math.min(SLED_FAR, r.s + r.v * dt)
  const lim = sideLimit(r.s)
  r.w += (side * 2.2 + r.wv) * dt
  if (Math.abs(r.w) > lim) {
    r.w = Math.sign(r.w) * lim
    r.wv = -r.wv * 0.4 // 길 가장자리에서 살짝 튕긴다
  }
  r.wv *= Math.exp(-dt * 3)
  if (SLED_LAMPS.some((l) => Math.hypot(l.s - r.s, l.w - r.w) < LAMP_HIT)) return 'crash'
  if ((flat && r.v < 0.25) || r.s >= SLED_FAR) return 'stop'
  return 'go'
}

/** 다른 썰매와 부딪혔으면 튕겨 나간다. 뒤에서 박으면 앞사람은 빨라지고 박은 사람은 느려진다 (각자 자기 화면에서 계산) */
export function bump(r: Ride, other: { s: number; w: number }, t: number): boolean {
  if (t - r.bumpAt < 0.5) return false
  if (Math.hypot(other.s - r.s, other.w - r.w) > BUMP_R) return false
  r.bumpAt = t
  const away = Math.sign(r.w - other.w) || (Math.random() < 0.5 ? -1 : 1)
  r.wv = away * 3.2
  if (other.s > r.s) r.v *= 0.55 // 내가 뒤에서 박음
  else r.v += 1.6 // 뒤에서 박혔다: 밀려서 빨라진다
  return true
}

/** 기록 (소수 첫째 자리 m) */
export const sledDistance = (s: number) => Math.round(Math.max(0, s) * 10) / 10

/** 기록판 저장소: 다 타면 Player 가 finish 를 부르고, 기록판이 서버에 올린다 */
export const sledRecord = {
  finish: null as ((dist: number, crashed: boolean) => void) | null,
}
