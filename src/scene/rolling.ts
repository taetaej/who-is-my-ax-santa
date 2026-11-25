// ⛄ 눈굴리기: 40초 동안 눈굴리기장 안을 돌아다니면 눈덩이가 커진다. 클수록 무거워서 느려진다.
// 바위에 부딪히거나 눈덩이에 맞으면 조금 부서진다. 기록 = 지름(cm).

import { RECORD_MAX } from '../gameRules'

export const ROLL_SECS = 40
export const BALL_START = 0.15 // 처음 눈덩이 반지름 (m)
export const BALL_MAX = RECORD_MAX.roll / 200 // 지름 400cm = 반지름 2m
const GROW = 0.011 // 굴린 거리 1m 에 늘어나는 반지름² (눈은 겉에 붙으니 넓이처럼 자란다)
export const CRACK = 0.75 // 바위에 부딪히면 반지름이 이만큼으로

/** 굴린 거리만큼 키운다 */
export const growBall = (r: number, dist: number) => Math.min(BALL_MAX, Math.sqrt(r * r + GROW * Math.max(0, dist)))
/** 눈덩이가 클수록 느리게 걷는다 (1 → 0.45) */
export const rollSpeed = (r: number) => 1 - 0.55 * Math.min(1, r / 1.6)
/** 지름 cm */
export const ballCm = (r: number) => Math.min(RECORD_MAX.roll, Math.round(r * 200))
