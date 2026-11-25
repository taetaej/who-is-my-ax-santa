// 🎮 화면(HUD)과 3D 장면이 같이 쓰는 놀이 상태. 내 체력·눈덩이·기절·눈굴리기, 그리고 XP.
// 서버에 남는 것은 기록(🛷 ⛄)과 XP 뿐이고, 체력·기절은 각자 화면에서만 센다.

import type { XpBoard } from '../api'
import { AMMO_MAX, HP_MAX, type RecordKind, type XpKind } from '../gameRules'

export const game = {
  hp: HP_MAX,
  ammo: AMMO_MAX,
  charge: -1, // F 를 누르고 있으면 0~1 (아니면 -1)
  hurtAt: -10, // 마지막으로 맞은 시각 (장면 시계, 초)
  koUntil: 0, // 기절이 풀리는 시각 (장면 시계, 초). 0 이면 멀쩡
  koSecs: 0, // 이번 기절 길이
  koBy: '', // 누가 기절시켰나
  kos: [] as number[], // 최근 기절한 시각 (Date.now)
  safeUntil: 0, // 일어난 뒤 잠깐 안 맞는 시간 (장면 시계, 초)
  now: 0, // 장면 시계 (HUD 가 남은 초를 셀 때 쓴다)
  inThrowZone: false,
  roll: null as { left: number; cm: number } | null, // ⛄ 눈굴리기 중: 남은 초, 지금 지름
  leftBalls: [] as { x: number; z: number; r: number; rx: number; rz: number }[], // 다 굴린 눈덩이 (내 화면에만 남는다)
  lv: 1,
  sledCharge: null as { power: number; left: number; taps: number } | null, // 🛷 꼭대기에서 Space 연타 중 (0~1, 남은 초, 누른 횟수)
  /** 기록판이 등록한다: 다 하고 나면 기록을 올린다 */
  finish: {} as Partial<Record<RecordKind, (value: number, crashed?: boolean) => void>>,
  /** HUD 가 등록한다: XP 얻기 (서버에 올리고 레벨업이면 축하) */
  gainXp: null as ((kind: XpKind) => void) | null,
}

/** ⭐ XP 순위: HUD 가 불러오고 3D 순위판이 구독한다 */
export const xpStore = {
  board: null as XpBoard | null,
  listeners: new Set<(b: XpBoard) => void>(),
  set(b: XpBoard) {
    this.board = b
    if (b.mine) game.lv = b.mine.lv
    for (const f of this.listeners) f(b)
  },
}
