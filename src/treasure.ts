// 🎀 보물찾기: 마을 곳곳에 숨은 선물이 있다. 진짜 14개 + 꽝 여러 개.
// - 마니또 시작(ACTIVE)부터 나타난다. 힌트 없음.
// - 진짜 선물은 1인 1개, 하나는 먼저 연 한 사람만. 꽝은 기회를 쓰지 않는다 (다른 걸 또 찾으면 된다).
// - 진짜를 찾으면 마을에 알림이 뜨고 그 자리는 모두에게서 사라진다. 꽝은 연 사람에게만 "열린 상자"로 남는다.
// - RESCUE_FROM 부터는 남은 진짜가 반짝이고 엘프가 위치 힌트를 준다 (늦게 온 사람도 모두 받도록).
//
// ⚠️ 이 파일은 화면에도 실리므로 "어느 자리가 진짜인지"와 선물 이름은 여기 두지 않는다 → server/treasure.ts
// 좌표는 world.ts 와 같은 기준 (+z 가 화면 아래 = 입구 쪽).

export const RESCUE_FROM = '2026-12-14' // 이날(한국 시간)부터 남은 진짜가 반짝이고 엘프가 힌트를 준다

/** 모양. snow(눈더미)·ice(얼음 속)는 E 를 여러 번 눌러 파내야 열린다 */
export type Kind = 'box' | 'sock' | 'jar' | 'bundle' | 'snow' | 'ornament' | 'ice'
export type Spot = { id: string; x: number; z: number; y?: number; kind: Kind; place: string }

/** 등수별 선물 (모두에게 공개: 무엇이 걸려 있고 몇 개 남았는지). 선물 이름은 정해지면 바꾸기 */
export const TIERS = [
  { tier: 1, label: '🥇 1등', count: 1, gift: '1등 선물 (미정)' },
  { tier: 2, label: '🥈 2등', count: 2, gift: '2등 선물 (미정)' },
  { tier: 3, label: '🥉 3등', count: 4, gift: '3등 선물 (미정)' },
  { tier: 4, label: '🎁 4등', count: 7, gift: '4등 선물 (미정)' },
] as const
export type Tier = 1 | 2 | 3 | 4
export const tierOf = (t: number) => TIERS.find((x) => x.tier === t) ?? TIERS[3]

export const DIG_HITS = 3 // 눈더미·얼음을 파내는 데 필요한 E 횟수
export const OPEN_RANGE = 1.1 // 이만큼 가까이 가야 E 로 열 수 있다 (수평 거리)
export const GLINT_RANGE = 1.5 // 이 안에 들어오면 살짝 반짝이고 "뭔가 반짝인다…?" (넓으면 너무 쉽다)

const UP = -Math.PI / 2
const r2 = (v: number) => Math.round(v * 100) / 100
const p = (a: number, r: number) => ({ x: r2(Math.cos(a) * r), z: r2(Math.sin(a) * r) })
/** 숲 나무에 매달린 오너먼트: 나무 기둥에서 마을 중심 쪽으로 조금 */
const onTree = (x: number, z: number) => {
  const d = Math.hypot(x, z)
  return { x: r2(x - (x / d) * 0.55), z: r2(z - (z / d) * 0.55), y: 1.15 }
}

// id 는 DB 에 저장되니 바꾸지 말 것. 위치·모양·설명은 바꿔도 된다.
export const SPOTS: readonly Spot[] = [
  // 🎄 광장 큰 트리와 얼음 연못
  { id: 's01', ...p(-2.0, 1.5), y: 1.6, kind: 'ornament', place: '🎄 큰 트리 뒤쪽 가지' },
  { id: 's02', ...p(-1.1, 1.5), y: 1.95, kind: 'ornament', place: '🎄 큰 트리 오른쪽 가지' },
  { id: 's03', ...p(0.9, 1.5), y: 1.3, kind: 'ornament', place: '🎄 큰 트리 앞쪽 가지' },
  { id: 's04', ...p(2.5, 1.48), kind: 'box', place: '🎄 큰 트리 아래 선물 더미 사이' },
  { id: 's05', ...p(2.35, 2.7), kind: 'ice', place: '🧊 얼음 연못 왼쪽' },
  { id: 's06', ...p(-0.6, 2.75), kind: 'ice', place: '🧊 얼음 연못 오른쪽 뒤' },
  { id: 's07', ...p(3.95, 2.7), kind: 'ice', place: '🧊 얼음 연못 왼쪽 뒤' },
  // 광장 둘레
  { id: 's08', ...p(2.75, 5.45), kind: 'snow', place: '🪑 왼쪽 벤치 뒤 눈더미' },
  { id: 's09', ...p(4.1, 5.4), kind: 'bundle', place: '🪑 뒤쪽 벤치 옆' },
  { id: 's10', ...p(0.8, 5.9), kind: 'snow', place: '⛄ 눈사람 옆 눈더미' },
  { id: 's11', ...p(1.4, 6.35), kind: 'snow', place: '💡 앞쪽 가로등 아래 눈더미' },
  { id: 's12', ...p(5.6, 6.5), kind: 'jar', place: '💡 오른쪽 뒤 가로등 아래' },
  { id: 's13', ...p(Math.PI / 2 + 0.5, 3.75), kind: 'bundle', place: '📋 마니또 게시판 뒤 연못가' },
  // 📮 우편함 · ☕ 카페 · 📜 연대기
  { id: 's14', ...p(UP - 0.82, 13.4), kind: 'box', place: '📮 AX 우편함 뒤' },
  { id: 's15', ...p(UP - 0.66, 11.9), kind: 'bundle', place: '📮 AX 우편함 옆 소포 더미' },
  { id: 's16', ...p(UP + 0.82, 13.1), kind: 'jar', place: '☕ AX 카페 뒤' },
  { id: 's17', ...p(UP + 0.62, 11.9), kind: 'jar', place: '☕ AX 카페 옆 쿠키 통' },
  { id: 's18', ...p(UP, 14.1), kind: 'box', place: '📜 연대기 가운데 패널 뒤' },
  { id: 's19', ...p(UP + 0.36, 13.95), kind: 'sock', place: '📜 연대기 오른쪽 패널 뒤' },
  { id: 's20', ...p(UP - 0.36, 13.95), kind: 'snow', place: '📜 연대기 왼쪽 패널 뒤 눈더미' },
  // ⛪ 교회 · ❄️ 눈밭 · 🏆 어워즈
  { id: 's21', ...p(0.05, 15.9), kind: 'box', place: '⛪ 교회 뒤 모퉁이' },
  { id: 's22', ...p(-0.36, 15.0), kind: 'snow', place: '⛪ 교회 왼쪽 눈더미' },
  { id: 's23', ...p(0.2, 12.4), kind: 'snow', place: '❄️ 눈밭 안쪽 눈더미' },
  { id: 's24', ...p(0.42, 10.3), kind: 'snow', place: '❄️ 눈밭 앞쪽 눈더미' },
  { id: 's25', ...p(0.05, 10.9), kind: 'snow', place: '❄️ 눈밭 오른쪽 눈더미' },
  { id: 's26', ...p(1.0, 12.7), kind: 'box', place: '🏆 어워즈 부스 뒤' },
  { id: 's27', ...p(0.82, 9.9), kind: 'sock', place: '🏆 어워즈 부스 옆' },
  // 🔥 불멍 회의실 · 🎂 파티
  { id: 's28', ...p(Math.PI - 0.28, 13.7), kind: 'box', place: '🔥 불멍 회의실 스피커 뒤' },
  { id: 's29', ...p(Math.PI - 0.02, 11.7), kind: 'bundle', place: '🔥 불멍 회의실 장작 옆' },
  { id: 's30', ...p(Math.PI - 0.52, 12.9), kind: 'snow', place: '🔥 불멍 회의실 왼쪽 눈더미' },
  { id: 's31', ...p(2.25, 12.4), kind: 'box', place: '🎂 파티 테이블 뒤' },
  { id: 's32', ...p(2.08, 9.4), kind: 'jar', place: '🎂 파티 테이블 옆' },
  // 🎅 입구
  { id: 's33', x: -6.6, z: 14.55, kind: 'snow', place: '🎅 입구 왼쪽 울타리 안쪽 눈더미' },
  { id: 's34', x: 5.2, z: 15.1, kind: 'snow', place: '🎅 입구 오른쪽 울타리 안쪽 눈더미' },
  { id: 's35', x: 6.95, z: 14.45, kind: 'bundle', place: '🌲 입구 오른쪽 숲 나무 아래' },
  // 🌲 숲 (나무에 매달린 오너먼트, 울타리 구석)
  { id: 's36', ...onTree(-13.9, 6.2), kind: 'ornament', place: '🌲 왼쪽 앞 숲 나무' },
  { id: 's37', ...onTree(12.3, 6.0), kind: 'ornament', place: '🌲 오른쪽 앞 숲 나무' },
  { id: 's38', ...onTree(-8.9, -12.9), kind: 'ornament', place: '🌲 우편함 뒤쪽 숲 나무' },
  { id: 's39', ...onTree(6.7, -13.2), kind: 'ornament', place: '🌲 오른쪽 뒤 숲 나무' },
  { id: 's40', ...onTree(-10.1, 10.0), kind: 'ornament', place: '🌲 파티 테이블 왼쪽 숲 나무' },
  { id: 's41', ...onTree(12.2, -8.1), kind: 'ornament', place: '🌲 교회 뒤쪽 숲 나무' },
  { id: 's42', ...p(Math.PI + 0.45, 15.6), kind: 'snow', place: '🌲 마을 왼쪽 끝 숲속 눈더미' },
  { id: 's43', ...p(-0.75, 15.4), kind: 'snow', place: '🌲 마을 오른쪽 뒤 숲속 눈더미' },
  { id: 's44', ...p(UP - 1.45, 15.6), kind: 'box', place: '🌲 우편함 왼쪽 울타리 구석' },
  { id: 's45', ...p(Math.PI - 0.62, 15.6), kind: 'bundle', place: '🌲 불멍 회의실 뒤 울타리 구석' },
  { id: 's46', ...p(0.62, 15.5), kind: 'sock', place: '🌲 어워즈 뒤 울타리 구석' },
]

export const spot = (id: string) => SPOTS.find((s) => s.id === id)
export const needsDig = (k: Kind) => k === 'snow' || k === 'ice'

/** 가장 가까운 자리 (ids 중에서, range 안) */
export function nearestSpot(x: number, z: number, ids: Iterable<string>, range = OPEN_RANGE): Spot | null {
  let best: Spot | null = null
  let bd = range
  for (const id of ids) {
    const s = spot(id)
    if (!s) continue
    const d = Math.hypot(s.x - x, s.z - z)
    if (d < bd) {
      bd = d
      best = s
    }
  }
  return best
}
