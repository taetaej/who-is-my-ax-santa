// 🛷 썰매 한 번 타기: 움직임 계산만 (그리기는 Player·Cookie). 테스트에서도 같은 계산을 돌린다.
//   up    → 타는 곳에서 산 옆 계단으로 올라가 꼭대기 나무 다리를 건너 출발선까지 (climbPath)
//   ready → 꼭대기에서 Space 연타로 출발 힘을 모은다 (화면 가운데 게이지). ←→ 로 출발 줄을 옮긴다
//   down  → 넓은 비탈을 여럿이 나란히 내려온다. 썰매끼리 쿵, 범퍼 눈더미에 통! 튕기고, 점프대에서 날아올라
//           눈사람·선물상자 숲을 ←→ 로 피해 평지로 미끄러진다. 눈사람·선물상자에 박으면 거기서 끝
// 기록 = 출발선에서 멈춘 곳까지 거리 (m)

import { SLED, SLED_LANES, SLED_OBSTACLES, STAIRS, sledProfile } from './world'

export const READY_SECS = 2.5 // 힘 모으는 시간
export const CLIMB_SPEED = 4.2 // 계단 오르는 속도 (m/초)
export const POWER_TAP = 0.25 // Space 한 번에 모이는 힘 (2.5초에 16번 누르면 풀파워)
export const POWER_MAX = 4
export const SLED_FAR = SLED.len + SLED.run // 여기서 더는 못 간다
export const BUMP_R = 0.95 // 썰매끼리 이 거리면 쿵
export const STEER = 3.0 // ←→ 로 옆으로 가는 빠르기 (m/초)
const PILLOW_R = 0.8 // 범퍼 눈더미에 이 거리면 통!

const HIT = 0.6 // 눈사람·선물상자와 이 거리면 쾅
const GRAVITY = 9.8
const KICK = 0.65 // 점프대 끝에서 위로 튀는 비율 (속도 × 이 값)

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
  air: number // 점프대에서 날아오른 높이 (땅에서부터). 0 이면 땅 위
  vy: number
  landed: boolean // 이번 프레임에 착지했다 (말풍선용)
  path: { s: number; w: number }[] // 올라가는 길 (계단)
  climb: number // 그 길을 얼마나 왔나 (m)
  taps: number // Space 누른 횟수
  pillowAt: number // 마지막으로 범퍼 눈더미에 튕긴 자리 (s). 같은 더미에 두 번 튕기지 않게
  pillowed: boolean // 이번 프레임에 범퍼에 튕겼다
}

export const newRide = (s: number, t: number, w = 0, lane = 0): Ride => ({
  phase: 'up',
  s,
  w,
  v: 0,
  wv: 0,
  at: t,
  power: 0,
  wow: false,
  bumpAt: -10,
  air: 0,
  vy: 0,
  landed: false,
  path: climbPath(s, w, lane),
  climb: 0,
  taps: 0,
  pillowAt: -10,
  pillowed: false,
})

/** 지금 자리 → 계단 아래 → 계단 꼭대기 → 나무 다리 건너 출발선의 내 줄 */
export const climbPath = (s: number, w: number, lane = 0) => [
  { s, w },
  { s: STAIRS.from + 0.5, w: STAIRS.w },
  { s: STAIRS.to, w: STAIRS.w },
  { s: -0.5, w: STAIRS.w },
  { s: -0.5, w: lane },
]

/** 꼭대기에서 고를 줄: 이미 서 있는 사람들과 가장 먼 줄 */
export function pickLane(taken: number[]): number {
  let best: number = SLED_LANES[0]
  let far = -1
  for (const l of SLED_LANES) {
    const d = taken.length ? Math.min(...taken.map((w) => Math.abs(w - l))) : 9 - Math.abs(l)
    if (d > far + 1e-6) {
      far = d
      best = l
    }
  }
  return best
}

/** 꼭대기에서 ←→ 로 줄 옮기기 */
export function shiftLane(r: Ride, dt: number, side: number) {
  const lim = SLED.track - 0.4
  r.w = Math.max(-lim, Math.min(lim, r.w + side * 2.4 * dt))
}
/** 길을 d 만큼 왔을 때 자리와 가는 방향. 끝까지 왔으면 done */
export function alongPath(path: { s: number; w: number }[], d: number) {
  let left = d
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const len = Math.hypot(b.s - a.s, b.w - a.w)
    if (left <= len || i === path.length - 1) {
      const k = len > 0 ? Math.min(1, left / len) : 1
      return { s: a.s + (b.s - a.s) * k, w: a.w + (b.w - a.w) * k, ds: len > 0 ? (b.s - a.s) / len : 0, dw: len > 0 ? (b.w - a.w) / len : 0, done: i === path.length - 1 && left >= len }
    }
    left -= len
  }
  const last = path[path.length - 1]
  return { ...last, ds: 0, dw: 0, done: true }
}

/** 옆으로 갈 수 있는 폭: 비탈은 썰매 길 안, 평지는 조금 더 넓게 */
export const sideLimit = (s: number) => (s > SLED.len ? SLED.track + 0.6 : SLED.track - 0.15)

/** 내려가는 한 프레임. side = 방향키 (-1..1). 끝나면 'stop' 또는 'crash' */
export function stepDown(r: Ride, dt: number, side: number): 'go' | 'stop' | 'crash' {
  const flat = r.s > SLED.len
  r.landed = false
  r.pillowed = false
  if (r.air > 0 || r.vy > 0) {
    // 공중: 마찰 없이 날아간다
    r.vy -= GRAVITY * dt
    r.air += r.vy * dt
    if (r.air <= 0) {
      r.air = 0
      r.vy = 0
      r.landed = true
      r.v *= 0.9 // 착지 충격
    }
  } else {
    // 땅 위: 비탈이면 빨라지고, 평지는 마찰. 방향을 틀면 조금씩 느려진다 (덜 틀수록 멀리 간다)
    const slope = (sledProfile(r.s - 0.05) - sledProfile(r.s + 0.05)) / 0.1
    r.v = Math.max(0, r.v + (6.4 * slope - (flat ? 1.9 : 0.3) - 0.02 * r.v * r.v - 0.7 * Math.abs(side)) * dt)
  }
  if (r.s < 0.8) r.v = Math.max(r.v, 1.2 + r.power * 1.35) // 출발: 모은 힘으로 밀고 나간다
  const before = r.s
  r.s = Math.min(SLED_FAR, r.s + r.v * dt)
  // 점프대 끝을 지나면 날아오른다 (땅 높이가 갑자기 0 이 되니, 그 높이에서 시작)
  if (r.air === 0 && r.vy === 0 && before < SLED.jump && r.s >= SLED.jump && r.v > 2) {
    r.air = SLED.jumpH
    r.vy = r.v * KICK
  }
  const lim = sideLimit(r.s)
  r.w += (side * STEER + r.wv) * dt
  if (Math.abs(r.w) > lim) {
    r.w = Math.sign(r.w) * lim
    r.wv = -r.wv * 0.4 // 길 가장자리에서 살짝 튕긴다
  }
  r.wv *= Math.exp(-dt * 3)
  if (r.air < 0.5) {
    for (const o of SLED_OBSTACLES) {
      const d = Math.hypot(o.s - r.s, o.w - r.w)
      if (o.kind === 'bumper') {
        // 통! 옆으로 튕겨 나가고 조금 느려진다 (끝나지는 않는다)
        if (d < PILLOW_R && r.s - r.pillowAt > 1.2) {
          r.pillowAt = r.s
          r.pillowed = true
          r.wv = (Math.sign(r.w - o.w) || (Math.random() < 0.5 ? -1 : 1)) * 4.5
          r.v *= 0.85
        }
      } else if (d < HIT) return 'crash'
    }
  }
  if ((flat && r.air === 0 && r.v < 0.25) || r.s >= SLED_FAR) return 'stop'
  return 'go'
}

/** 다른 썰매와 부딪혔으면 튕겨 나간다. 뒤에서 박으면 앞사람은 빨라지고 박은 사람은 느려진다 (각자 자기 화면에서 계산) */
export function bump(r: Ride, other: { s: number; w: number }, t: number): boolean {
  if (t - r.bumpAt < 0.5) return false
  if (Math.hypot(other.s - r.s, other.w - r.w) > BUMP_R) return false
  r.bumpAt = t
  const away = Math.sign(r.w - other.w) || (Math.random() < 0.5 ? -1 : 1)
  r.wv = away * 4.2
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
