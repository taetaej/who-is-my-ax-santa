// 🚀 2027 WithSet 호. E 를 누르면 카운트다운 → 발사 → 하늘 너머로 → 잠시 뒤 다시 내려와 착륙.
// 실시간이면 마을 모두의 화면에서 같이 날아오르고, 누른 횟수는 "염원" 으로 서버에 쌓인다.
// 시각은 performance.now 기준 (방송으로 받은 발사도 같은 시계로 맞춘다).

export const ROCKET_T = { count: 2.6, fly: 4.4, away: 5, land: 2.6 } as const
export const ROCKET_CYCLE = ROCKET_T.count + ROCKET_T.fly + ROCKET_T.away + ROCKET_T.land
const LIFT = 6 // 발사 가속 (m/s²)
const LAND_FROM = 24 // 착륙은 이 높이에서 내려온다

export const rocket = {
  at: -1000, // 마지막 발사 시각 (초)
  wishes: null as number | null, // 모두의 염원 횟수 (서버)
}

export const rocketClock = () => performance.now() / 1000

export type RocketPose = { y: number; shake: number; flame: number; smoke: boolean; visible: boolean; phase: 'idle' | 'count' | 'fly' | 'away' | 'land' }

/** 발사 뒤 k 초의 모습 */
export function rocketPose(k: number): RocketPose {
  const { count, fly, away, land } = ROCKET_T
  if (k < 0 || k >= ROCKET_CYCLE) return { y: 0, shake: 0, flame: 0, smoke: false, visible: true, phase: 'idle' }
  if (k < count) return { y: Math.min(0.25, k * 0.15), shake: 0.04 + (k / count) * 0.04, flame: k / count, smoke: true, visible: true, phase: 'count' }
  if (k < count + fly) {
    const f = k - count
    return { y: 0.25 + 0.5 * LIFT * f * f, shake: 0.02, flame: 1.3, smoke: f < 1.6, visible: true, phase: 'fly' }
  }
  if (k < count + fly + away) return { y: 200, shake: 0, flame: 0, smoke: false, visible: false, phase: 'away' }
  const l = (k - count - fly - away) / land // 0..1
  const e = 1 - (1 - l) * (1 - l) // 처음엔 빠르게, 닿을 땐 살살
  return { y: LAND_FROM * (1 - e), shake: 0, flame: 0.7 * (1 - l) + 0.2, smoke: l > 0.7, visible: true, phase: 'land' }
}

/** 발사! 이미 날고 있으면 false */
export function launch(now = rocketClock()): boolean {
  if (now - rocket.at < ROCKET_CYCLE) return false
  rocket.at = now
  return true
}
