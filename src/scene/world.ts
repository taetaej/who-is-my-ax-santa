// 마을 배치 상수와 충돌 판정. Village(그리기)와 Player(이동)가 같은 값을 쓴다.
//
// 집은 없다. 다같이 모이는 광장과 놀이 장소들로 이루어진 마을이다 (온라인 사우나·온라인 절처럼).
//   가운데: 큰 트리 섬 + 얼음 연못(미끄러짐) + 돌길 광장, 마니또 게시판
//   그 바깥: 각 장소로 이어지는 디딤돌 길
//   둘레: 산타 우체국(소개서) · 교회 · 핫초코 포차 · 눈밭 · 언덕 벤치 · 모닥불
//   화면 기준으로 +z 가 아래(카메라 쪽), -z 가 위(안쪽)다.
//
// 🪐 산타 행성: 마을은 우주에 떠 있는 둥근 섬(ISLAND_EDGE) 가운데에 있다.
//   원래 마을(VILLAGE_R 안쪽)은 그대로 (숨은 선물 자리가 그대로 맞도록). 울타리는 없애고
//   그 자리에 띄엄띄엄 등불 기둥만 둘러 세웠다 (어디로든 걸어 나갈 수 있다).
//   바깥 링에 놀이 구역이 있고, 마을에서 각 구역까지 등불 켠 돌길이 이어진다:
//   오른쪽 ⚔️ 눈싸움장(ARENA) · 왼쪽 🛷 큰 썰매 산(SLED) · 오른쪽 뒤 ⛄ 눈굴리기장(ROLL)

export const VILLAGE_R = 17 // 울타리 반지름 (원래 마을)
export const ISLAND_EDGE = 34 // 🪐 행성 섬 가장자리 (그 밖은 우주)
export const WALK_MAX = ISLAND_EDGE - 1.8 // 낭떠러지 앞에서 멈춘다
export const FENCE_R = VILLAGE_R - 0.35
export const PLAZA_R = 6.2 // 광장 돌길 바깥. 여기서부터 각 장소로 디딤돌 길이 나간다
export const ISLAND_R = 1.9
export const POND_OUT = 3.5
export const LAMP_ANGLES = [0.35, 1.4, 2.45, 3.5, 4.55, 5.6]
export const LAMP_R = 5.9
export const SNOWMAN = { a: 0.95, r: 4.55 }

export type V3 = [number, number, number]
export const polar = (a: number, r: number, y = 0): V3 => [Math.cos(a) * r, y, Math.sin(a) * r]
/** 로컬 +z(앞면)가 마을 중심을 향하게 하는 Y 회전 */
export const faceCenter = (a: number) => -a - Math.PI / 2

const UP = -Math.PI / 2 // 화면 위쪽(안쪽) 방향 각도

/** 놀이 장소 위치. a = 각도, r = 중심에서 거리 */
export const SPOT = {
  post: { a: UP - 0.82, r: 11.4 }, // AX 우편함: 소개서 쓰기
  church: { a: -0.12, r: 14.9 }, // 오른쪽 끝 (앞쪽에 높은 건물이 있으면 카메라를 가린다)
  cocoa: { a: UP + 0.82, r: 11.4 }, // AX 카페: 핫초코
  field: { a: 0.28, r: 11.3 }, // 눈밭: 눕기, 눈싸움 (snowball.ts)
  fire: { a: Math.PI - 0.28, r: 11.1 }, // 불멍 회의실: 모닥불에 둘러앉아 캐롤 듣기
  awards: { a: 1.0, r: 10.6 }, // 🏆 어워즈 키워드 부스 (앞 오른쪽)
  board: { a: Math.PI / 2 + 0.5, r: 5.1 }, // 마니또 게시판 (광장, 카메라 쪽을 본다)
} as const

export const at = (s: { a: number; r: number }) => polar(s.a, s.r)
/** 어워즈 투표소는 광장 말고 입구 길 쪽(카메라 쪽)을 본다. 앞에서 바라보는 시점이 자연스럽도록 */
export const AWARDS_ROT = -0.55

/** 건물 앞에 섰을 때의 시점: 건물 정면 앞쪽 멀리서 건물을 바라본다 (ux, uz = 건물이 보는 방향) */
export function facadeView(cx: number, cz: number, ux: number, uz: number, dist: number, lookY: number, camY = 2.4) {
  return { cam: [cx + ux * dist, camY, cz + uz * dist] as [number, number, number], look: [cx + ux * 0.6, lookY, cz + uz * 0.6] as [number, number, number] }
}
export const ARCH_Z = VILLAGE_R - 1.25 // 입구 아치 (앞쪽 울타리 바로 안)
/** 울타리 앞쪽에 뚫린 대문. 이 폭 안에서는 울타리 밖 입구 길로 나갈 수 있다 */
/** 📜 연대기 전시: 마을 뒤쪽 가운데에 달마다 한 장씩, 마을 중심을 보며 호를 그리고 선다 */
export const EXHIBIT = { r: 13.0, step: 0.13, w: 1.5, h: 2.4 }
export const exhibitAngle = (i: number, n: number) => -Math.PI / 2 + (i - (n - 1) / 2) * EXHIBIT.step
/** 전시 앞에 오면 카메라가 가까이 다가가 글씨를 읽을 수 있게 한다 */
export const inGallery = (x: number, z: number) => z < -8.6 && Math.abs(x) < 6.8
export const GATE_HW = 1.45
export const GATE_ANGLE = (GATE_HW + 0.35) / (VILLAGE_R - 0.35) // 울타리를 비우는 각도 (반폭)
/** 놀이 구역으로 나가는 길목: 앞(입구) · 오른쪽(눈싸움장 쪽, 눈밭 뒤) · 왼쪽(썰매 산 쪽). 숲을 비워 길을 낸다 */
export const GATES = [Math.PI / 2, 0.3, 3.42] as const
const angleOff = (a: number, b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
/** 이 각도가 문 자리인지 (울타리·전구를 비운다) */
export const inGate = (a: number, pad = 0) => GATES.some((g) => angleOff(a, g) < GATE_ANGLE + pad)
/** 울타리 밖 입구 길에서 시작해 대문과 아치를 지나, 연대기 길을 따라 광장으로 걸어 들어온다 */
export const SPAWN = { x: 0, z: VILLAGE_R + 1.6, rot: Math.PI }
/** 🧝 AX 엘프 NPC: 들어오자마자 보이는 광장 오른쪽 앞 */
export const ELF = { x: 1.9, z: 4.4 }
/** 🎂 AX 파티 테이블: 연대기 길 끝에서 왼쪽으로 보이는 자리 */
export const PARTY = { x: Math.cos(2.25) * 10.3, z: Math.sin(2.25) * 10.3 }

// 모닥불 둘레 통나무 자리
export const FIRE_SEATS = (() => {
  const [fx, , fz] = at(SPOT.fire)
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3
    return { x: fx + Math.cos(a) * 1.55, z: fz + Math.sin(a) * 1.55, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) }
  })
})()

// 건물 크기 (그리기와 충돌이 같이 쓴다)
export const POST_SIZE = { w: 3.2, d: 2.5 }
export const COCOA_SIZE = { w: 2.6, d: 1.3 }

// 캐롤 감상 구역: 모닥불이 한가운데. 가까울수록 소리가 커지고, 불가에 있으면 리듬을 탄다
export const CAROL_CENTER = (() => {
  const a = Math.PI - 0.28 // SPOT.fire 와 같은 자리
  return { x: Math.cos(a) * 11.1, z: Math.sin(a) * 11.1 }
})()
const CAROL_FULL = 3.6 // 이 안에서는 최대 볼륨
const CAROL_EDGE = 7.5 // 여기서부터는 안 들린다
/** 0(안 들림) ~ 1(최대) */
export function carolLevel(x: number, z: number): number {
  const d = Math.hypot(x - CAROL_CENTER.x, z - CAROL_CENTER.z)
  if (d <= CAROL_FULL) return 1
  if (d >= CAROL_EDGE) return 0
  return 1 - (d - CAROL_FULL) / (CAROL_EDGE - CAROL_FULL)
}
export const inCarol = (x: number, z: number) => carolLevel(x, z) >= 0.99

/** 얼음 위인지 (다리 위는 제외) */
export function onIce(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  return r > ISLAND_R + 0.05 && r < POND_OUT - 0.05 && Math.abs(x) > 0.55
}

// ── 🛷 큰 썰매 산 ─────────────────────────────────────────────
// 섬 왼쪽 바깥 링. 꼭대기(앞쪽 왼편)에서 뒤쪽으로 길게 내려온다. 비탈 → 점프대 → 슬라롬 눈사람 → 끝.
// s = 꼭대기 출발점에서 내려온 거리, w = 옆으로 비킨 거리
const SLED_FROM = { x: -28.7, z: 8.7 } // 꼭대기 출발점
const SLED_TO = { x: -19.6, z: -14.6 } // 다 미끄러진 끝 (방향만 쓴다)
export const SLED = {
  h: 5.5, // 산 높이
  len: 10, // 비탈 길이
  back: 3.0, // 꼭대기 뒤로 내려가는 길이
  deck: 1.4, // 꼭대기 평평한 곳
  track: 1.1, // 썰매 길 반폭
  half: 3.2, // 산 반폭
  run: 15, // 비탈 끝에서 평지로 미끄러지는 최대 거리
  gate: 1.0, // 비탈 끝에서 타는 곳까지
  jump: 13.2, // 점프대 끝 (여기서 날아오른다)
  jumpLen: 1.4, // 점프대 오르막 길이
  jumpH: 0.55, // 점프대 높이
} as const
const SLED_LEN = Math.hypot(SLED_TO.x - SLED_FROM.x, SLED_TO.z - SLED_FROM.z)
/** 내려가는 방향 */
export const SLED_DIR = { x: (SLED_TO.x - SLED_FROM.x) / SLED_LEN, z: (SLED_TO.z - SLED_FROM.z) / SLED_LEN }
const SLED_SIDE = { x: -SLED_DIR.z, z: SLED_DIR.x }
/** 썰매 방향 (CookieState.rot): 내려갈 때 */
export const SLED_ROT = Math.atan2(SLED_DIR.x, SLED_DIR.z)
export const sledPoint = (s: number, w = 0) => ({ x: SLED_FROM.x + SLED_DIR.x * s + SLED_SIDE.x * w, z: SLED_FROM.z + SLED_DIR.z * s + SLED_SIDE.z * w })
export function sledLocal(x: number, z: number) {
  const dx = x - SLED_FROM.x
  const dz = z - SLED_FROM.z
  return { s: dx * SLED_DIR.x + dz * SLED_DIR.z, w: dx * SLED_SIDE.x + dz * SLED_SIDE.z }
}
/** 슬라롬 눈사람 (박으면 끝). 점프대 착지 뒤 왼쪽·오른쪽 번갈아 */
export const SLED_OBSTACLES = [
  { s: 17.2, w: -0.45 },
  { s: 20.4, w: 0.55 },
  { s: 23.3, w: -0.3 },
] as const
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
/** 산 가운데 줄의 높이 (점프대 포함) */
export function sledProfile(s: number): number {
  if (s >= SLED.len) {
    const j = s - (SLED.jump - SLED.jumpLen)
    return j > 0 && j <= SLED.jumpLen ? SLED.jumpH * (j / SLED.jumpLen) : 0
  }
  if (s >= 0) return SLED.h * (0.5 + 0.5 * Math.cos((Math.PI * s) / SLED.len))
  if (s >= -SLED.deck) return SLED.h
  return SLED.h * (1 - smooth((-s - SLED.deck) / SLED.back))
}
/** 산 단면: 썰매 길은 평평하고, 양옆은 둥글게 내려간다 */
const sledSide = (w: number) => 1 - smooth((Math.abs(w) - SLED.track - 0.4) / (SLED.half - SLED.track - 0.4))
/** 🪜 산 옆 계단: 타는 곳 쪽(오른쪽)에서 꼭대기까지. 꼭대기에서는 나무 다리를 건너 출발선으로 간다 */
export const STAIRS = { w: SLED.half + 0.75, half: 0.55, from: SLED.len, to: 0.2, steps: 18 } as const
/** 계단 높이 (한 칸씩 올라간다) */
export function stairY(s: number): number {
  const k = (STAIRS.from - s) / (STAIRS.from - STAIRS.to)
  if (k <= 0) return 0
  if (k >= 1) return SLED.h
  return (SLED.h * Math.ceil(k * STAIRS.steps)) / STAIRS.steps
}
const onStairs = (s: number, w: number) => Math.abs(w - STAIRS.w) < STAIRS.half && s <= STAIRS.from && s >= STAIRS.to
const onBridge = (s: number, w: number) => s >= -SLED.deck && s <= STAIRS.to + 0.4 && w >= SLED.track && w <= STAIRS.w + STAIRS.half
/** 땅 높이 (산·점프대·계단 위면 그 높이, 아니면 0) */
export function groundY(x: number, z: number): number {
  const { s, w } = sledLocal(x, z)
  if (onBridge(s, w)) return SLED.h
  if (onStairs(s, w)) return stairY(s)
  if (s < -SLED.deck - SLED.back || s > SLED.jump || Math.abs(w) > SLED.half) return 0
  if (s >= SLED.len) return Math.abs(w) < SLED.track ? sledProfile(s) : 0
  return sledProfile(s) * sledSide(w)
}
/** 썰매가 앞으로 기울어지는 각도 (내려가는 비탈) */
export function sledTilt(x: number, z: number): number {
  const { s } = sledLocal(x, z)
  const d = 0.05
  return Math.atan((sledProfile(s - d) - sledProfile(s + d)) / (2 * d))
}
/** 썰매 미끄럼 길 (산 + 평지 끝까지): 나무·위장 눈더미를 두지 않는다 */
export function onSledRun(x: number, z: number) {
  const { s, w } = sledLocal(x, z)
  return s > -SLED.deck - SLED.back - 0.5 && s < SLED.len + SLED.run + 1 && w > -SLED.half - 0.8 && w < (s < SLED.len + 1 ? STAIRS.w + STAIRS.half + 0.8 : SLED.half + 0.8)
}

// ── ⚔️ 눈싸움장 · ⛄ 눈굴리기장 ─────────────────────────────────────
/** 눈싸움장: 오른쪽 문 밖. 가운데 눈 요새 4개 뒤에 숨을 수 있다 (눈덩이도 막는다) */
export const ARENA = { x: Math.cos(0.25) * 24.6, z: Math.sin(0.25) * 24.6, r: 7 }
export const inArena = (x: number, z: number) => Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r
/** 눈 요새 벽 (가운데를 둘러싸는 네 개, 조금씩 비스듬히) */
export const FORTS = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4
  return { x: ARENA.x + Math.cos(a) * 3.3, z: ARENA.z + Math.sin(a) * 3.3, rot: -a + Math.PI / 2, hw: 1.25, hd: 0.32, h: 1.0 }
})
/** 눈굴리기장: 오른쪽 뒤. 바위 세 개에 부딪히면 눈덩이가 깨진다 */
export const ROLL = { x: Math.cos(-0.85) * 24.8, z: Math.sin(-0.85) * 24.8, r: 6.5 }
export const inRoll = (x: number, z: number) => Math.hypot(x - ROLL.x, z - ROLL.z) < ROLL.r
export const ROLL_ROCKS = [
  { x: ROLL.x - 2.4, z: ROLL.z - 1.6, r: 0.55 },
  { x: ROLL.x + 2.6, z: ROLL.z + 0.4, r: 0.65 },
  { x: ROLL.x - 0.3, z: ROLL.z + 3.2, r: 0.5 },
]

/** 🏮 옛 울타리 자리의 등불 기둥 (문 자리는 비운다). 숨은 선물 힌트의 "등불 기둥"이 이것 */
export const LANTERNS = Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2 + 0.06)
  .filter((a) => !inGate(a, 0.05))
  .map((a) => ({ a, x: Math.cos(a) * FENCE_R, z: Math.sin(a) * FENCE_R }))
/** 🚀 산타 로켓 발사대 (앞 왼쪽 바깥), 🔭 별 망원경 (앞 오른쪽 바깥) */
export const ROCKET = { x: Math.cos(2.05) * 25.5, z: Math.sin(2.05) * 25.5, r: 2.6 }
export const SCOPE = { x: Math.cos(1.12) * 26, z: Math.sin(1.12) * 26, r: 1.3 }
/** 마을에서 놀이 구역으로 가는 등불 돌길 (점들을 잇는 선) */
export const ZONE_PATHS: { x: number; z: number }[][] = (() => {
  const P = (a: number, r: number) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r })
  const toward = (from: { x: number; z: number }, to: { x: number; z: number }, gap: number) => {
    const d = Math.hypot(to.x - from.x, to.z - from.z)
    return { x: to.x - ((to.x - from.x) / d) * gap, z: to.z - ((to.z - from.z) / d) * gap }
  }
  const right = P(0.3, 18.6)
  const left = P(3.42, 18.6)
  const board = sledPoint(SLED.len + SLED.gate, SLED.track + 1.2)
  return [
    [P(0.3, 14.2), right, toward(right, ARENA, ARENA.r)],
    [right, P(0.02, 19.8), P(-0.42, 20.6), toward(P(-0.42, 20.6), ROLL, ROLL.r)],
    [P(3.42, 14.2), left, toward(left, board, 1.4)],
  ]
})()
const segDist = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - (a.x + dx * k), z - (a.z + dz * k))
}
/** 돌길 위인지 (나무·위장 눈더미를 두지 않는다) */
export const onPath = (x: number, z: number, pad = 1.4) => ZONE_PATHS.some((p) => p.some((b, i) => i > 0 && segDist(x, z, p[i - 1], b) < pad))
/** 꾸밈이 놓인 자리 (나무를 두지 않는다) */
export const onDecor = (x: number, z: number) => Math.hypot(x - ROCKET.x, z - ROCKET.z) < ROCKET.r + 2 || Math.hypot(x - SCOPE.x, z - SCOPE.z) < SCOPE.r + 1.6


// ── 상호작용 지점 ───────────────────────────────────────────────
export type Action = 'letter' | 'manito' | 'tree' | 'awards' | 'elf' | 'cake' | 'cocoa' | 'sit' | 'lie' | 'sled' | 'roll' | 'arena' | 'rocket' | 'scope'

/** 지금 서 있는 곳에서 E 로 할 수 있는 일 */
export function actionAt(x: number, z: number): { action: Action; label: string } | null {
  const near = (s: { a: number; r: number }, d: number, ox = 0) => {
    const [sx, , sz] = polar(s.a, s.r - ox)
    return Math.hypot(sx - x, sz - z) < d
  }
  if (Math.hypot(ELF.x - x, ELF.z - z) < 1.5) return { action: 'elf', label: 'E · 🧝 AX 엘프와 이야기하기' }
  if (Math.hypot(PARTY.x - x, PARTY.z - z) < 1.9) return { action: 'cake', label: 'E · 🍰 케이크 한 조각 먹기' }
  if (near(SPOT.post, 1.5, POST_SIZE.d / 2 + 0.5)) return { action: 'letter', label: 'E · 🕵️ 관찰 리포트 쓰기' }
  if (near(SPOT.board, 1.3)) return { action: 'manito', label: 'E · 📋 내가 챙길 사람 보기' }
  if (near(SPOT.awards, 1.9)) return { action: 'awards', label: 'E · 🏆 엘프 인터뷰 (어워즈)' }
  if (Math.hypot(x, z) < 4.3) return { action: 'tree', label: 'E · 🎄 메시지 트리 보기 · 쓰기' } // 광장 큰 트리
  if (near(SPOT.cocoa, 1.5, COCOA_SIZE.d / 2 + 0.55)) return { action: 'cocoa', label: 'E · ☕ AX 카페 핫초코 받기' }
  if (FIRE_SEATS.some((s) => Math.hypot(s.x - x, s.z - z) < 0.9)) return { action: 'sit', label: 'E · 🔥 불멍하러 앉기' }
  {
    const g = sledPoint(SLED.len + SLED.gate, SLED.track + 1.2)
    if (Math.hypot(g.x - x, g.z - z) < 1.4) return { action: 'sled', label: 'E · 🛷 썰매 타러 올라가기' }
  }
  if (inRoll(x, z)) return { action: 'roll', label: 'E · ⛄ 눈굴리기 시작 (40초)' }
  if (Math.hypot(ROCKET.x - x, ROCKET.z - z) < ROCKET.r + 1.3) return { action: 'rocket', label: 'E · 🚀 2027 WithSet 호 발사!' }
  if (Math.hypot(SCOPE.x - x, SCOPE.z - z) < SCOPE.r + 1.2) return { action: 'scope', label: 'E · 🔭 별 망원경 들여다보기' }
  if (inArena(x, z)) return { action: 'arena', label: 'F 꾹 · ☃️ 모아 던지기 (오래 누를수록 세게)' }
  if (near(SPOT.field, 3.4)) return { action: 'lie', label: 'F · ☃️ 눈덩이 던지기 · E · ❄️ 눕기' }
  return null
}

// ── 충돌체 ─────────────────────────────────────────────────────
type Box = { x: number; z: number; rot: number; hw: number; hd: number } // 회전된 직사각형
type Circle = { x: number; z: number; r: number }

const boxes: Box[] = []
const circles: Circle[] = []

function addBox(s: { a: number; r: number }, w: number, d: number) {
  const [x, , z] = at(s)
  boxes.push({ x, z, rot: faceCenter(s.a), hw: w / 2 + 0.1, hd: d / 2 + 0.1 })
}
addBox(SPOT.post, POST_SIZE.w, POST_SIZE.d)
addBox(SPOT.cocoa, COCOA_SIZE.w, COCOA_SIZE.d)
addBox(SPOT.church, 3.2, 3.8)
{
  const [x, , z] = at(SPOT.awards)
  boxes.push({ x, z, rot: AWARDS_ROT, hw: 0.9, hd: 0.5 })
}
{
  const [x, , z] = at(SPOT.board)
  boxes.push({ x, z, rot: 0, hw: 0.75, hd: 0.25 })
}
circles.push({ x: 0, z: 0, r: 1.55 }) // 큰 트리
circles.push({ x: ELF.x, z: ELF.z, r: 0.35 }) // 엘프
{
  const [x, , z] = at(SPOT.fire)
  circles.push({ x, z, r: 0.75 }) // 불
}
{
  // 🛷 썰매 산 (걸어서는 못 올라간다. 탈 때만 위로)
  const c = sledPoint((-SLED.deck - SLED.back + SLED.len * 0.85) / 2)
  boxes.push({ x: c.x, z: c.z, rot: SLED_ROT, hw: SLED.half - 0.3, hd: (SLED.deck + SLED.back + SLED.len * 0.85) / 2 })
  // 🪜 계단 (썰매 타러 갈 때만 올라간다)
  const st = sledPoint((STAIRS.to + STAIRS.from - 0.3) / 2 - 0.4, STAIRS.w)
  boxes.push({ x: st.x, z: st.z, rot: SLED_ROT, hw: STAIRS.half + 0.05, hd: (STAIRS.from - 0.3 - STAIRS.to) / 2 + 0.6 })
}
for (const f of FORTS) boxes.push({ x: f.x, z: f.z, rot: f.rot, hw: f.hw, hd: f.hd })
for (const l of LANTERNS) circles.push({ x: l.x, z: l.z, r: 0.18 })
circles.push({ x: ROCKET.x, z: ROCKET.z, r: ROCKET.r })
circles.push({ x: SCOPE.x, z: SCOPE.z, r: SCOPE.r })
for (const r of ROLL_ROCKS) circles.push({ x: r.x, z: r.z, r: r.r })
for (const a of LAMP_ANGLES) {
  const [x, , z] = polar(a, LAMP_R)
  circles.push({ x, z, r: 0.2 })
}
{
  const [x, , z] = polar(SNOWMAN.a, SNOWMAN.r)
  circles.push({ x, z, r: 0.45 })
}

export function addTreeColliders(list: { p: V3; h: number }[]) {
  for (const t of list) circles.push({ x: t.p[0], z: t.p[2], r: Math.max(0.35, t.h * 0.2) })
}
export function addCircle(x: number, z: number, r: number) {
  circles.push({ x, z, r })
}
export function addRotBox(x: number, z: number, rot: number, hw: number, hd: number) {
  boxes.push({ x, z, rot, hw, hd })
}

/** 반지름 pr 인 캐릭터를 장애물 밖으로 밀어낸다 */
export function resolve(x: number, z: number, pr = 0.3): { x: number; z: number } {
  for (const c of circles) {
    const dx = x - c.x
    const dz = z - c.z
    const d = Math.hypot(dx, dz)
    const min = c.r + pr
    if (d < min && d > 1e-6) {
      x = c.x + (dx / d) * min
      z = c.z + (dz / d) * min
    }
  }
  for (const b of boxes) {
    // 월드 → 로컬 좌표 (rotation.y = rot)
    const cos = Math.cos(b.rot)
    const sin = Math.sin(b.rot)
    const dx = x - b.x
    const dz = z - b.z
    let lx = dx * cos - dz * sin
    let lz = dx * sin + dz * cos
    const hw = b.hw + pr
    const hd = b.hd + pr
    if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
      // 가장 얕게 겹친 쪽으로 밀어낸다
      const px = hw - Math.abs(lx)
      const pz = hd - Math.abs(lz)
      if (px < pz) lx = Math.sign(lx || 1) * hw
      else lz = Math.sign(lz || 1) * hd
      x = b.x + lx * cos + lz * sin
      z = b.z - lx * sin + lz * cos
    }
  }
  // 🪐 섬 가장자리 (낭떠러지)
  const r = Math.hypot(x, z)
  if (r > WALK_MAX) {
    x = (x / r) * WALK_MAX
    z = (z / r) * WALK_MAX
  }
  return { x, z }
}
