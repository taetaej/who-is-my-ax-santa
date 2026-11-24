// 마을 배치 상수와 충돌 판정. Village(그리기)와 Player(이동)가 같은 값을 쓴다.
//
// 집은 없다. 다같이 모이는 광장과 놀이 장소들로 이루어진 마을이다 (온라인 사우나·온라인 절처럼).
//   가운데: 큰 트리 섬 + 얼음 연못(미끄러짐) + 돌길 광장, 마니또 게시판
//   그 바깥: 각 장소로 이어지는 디딤돌 길
//   둘레: 산타 우체국(소개서) · 교회 · 핫초코 포차 · 눈밭 · 언덕 벤치 · 모닥불
//   화면 기준으로 +z 가 아래(카메라 쪽), -z 가 위(안쪽)다.

export const VILLAGE_R = 17 // 울타리 반지름
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
const GATE_OUT = VILLAGE_R + 3 // 입구 길 끝
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

// ── 🛷 눈썰매장 ────────────────────────────────────────────────
// 왼쪽 뒤(모닥불과 우편함 사이). 울타리 쪽 꼭대기에서 광장 쪽으로 미끄러져 내려온다.
// 언덕 위치는 숨은 선물 자리(s42, s44)를 비켜서 정했다.
// s = 꼭대기 출발점에서 내려온 거리, w = 옆으로 비킨 거리
export const SLED = {
  a: 3.425, // 언덕이 놓인 각도
  top: 14.3, // 꼭대기 출발점까지 거리 (중심에서)
  h: 2.6, // 언덕 높이
  len: 5.0, // 비탈 길이
  back: 1.9, // 꼭대기 뒤로 내려가는 길이 (울타리 쪽)
  deck: 0.9, // 꼭대기 평평한 곳 (출발점 뒤로)
  track: 0.85, // 썰매 길 반폭
  half: 2.0, // 언덕 반폭
  run: 5.4, // 비탈 끝에서 평지로 미끄러지는 최대 거리 (얼음 연못 앞까지. 가는 길에 광장 가로등이 있다)
  gate: 0.9, // 비탈 끝에서 타는 곳까지
} as const
/** 내려가는 방향 (마을 중심 쪽) */
export const SLED_DIR = { x: -Math.cos(SLED.a), z: -Math.sin(SLED.a) }
const SLED_SIDE = { x: -SLED_DIR.z, z: SLED_DIR.x }
const SLED_TOP = { x: Math.cos(SLED.a) * SLED.top, z: Math.sin(SLED.a) * SLED.top }
/** 썰매 방향 (CookieState.rot): 내려갈 때 */
export const SLED_ROT = Math.atan2(SLED_DIR.x, SLED_DIR.z)
export const sledPoint = (s: number, w = 0) => ({ x: SLED_TOP.x + SLED_DIR.x * s + SLED_SIDE.x * w, z: SLED_TOP.z + SLED_DIR.z * s + SLED_SIDE.z * w })
export function sledLocal(x: number, z: number) {
  const dx = x - SLED_TOP.x
  const dz = z - SLED_TOP.z
  return { s: dx * SLED_DIR.x + dz * SLED_DIR.z, w: dx * SLED_SIDE.x + dz * SLED_SIDE.z }
}
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
/** 언덕 가운데 줄의 높이 */
export function sledProfile(s: number): number {
  if (s >= SLED.len) return 0
  if (s >= 0) return SLED.h * (0.5 + 0.5 * Math.cos((Math.PI * s) / SLED.len))
  if (s >= -SLED.deck) return SLED.h
  return SLED.h * (1 - smooth((-s - SLED.deck) / SLED.back))
}
/** 언덕 단면: 썰매 길은 평평하고, 양옆은 둥글게 내려간다 */
const sledSide = (w: number) => 1 - smooth((Math.abs(w) - SLED.track - 0.35) / (SLED.half - SLED.track - 0.35))
/** 땅 높이 (언덕 위면 그 높이, 아니면 0) */
export function groundY(x: number, z: number): number {
  const { s, w } = sledLocal(x, z)
  if (s < -SLED.deck - SLED.back || s > SLED.len || Math.abs(w) > SLED.half) return 0
  return sledProfile(s) * sledSide(w)
}
/** 썰매가 앞으로 기울어지는 각도 (내려가는 비탈) */
export function sledTilt(x: number, z: number): number {
  const { s } = sledLocal(x, z)
  const d = 0.05
  return Math.atan((sledProfile(s - d) - sledProfile(s + d)) / (2 * d))
}
/** 썰매 미끄럼 길 (언덕 + 평지 끝까지): 위장 눈더미를 두지 않는다 */
export function onSledRun(x: number, z: number) {
  const { s, w } = sledLocal(x, z)
  return s > -SLED.deck - SLED.back && s < SLED.len + SLED.run + 0.6 && Math.abs(w) < SLED.half + 0.4
}

// ── 상호작용 지점 ───────────────────────────────────────────────
export type Action = 'letter' | 'manito' | 'tree' | 'awards' | 'elf' | 'cake' | 'cocoa' | 'sit' | 'lie' | 'sled'

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
    const g = sledPoint(SLED.len + SLED.gate)
    if (Math.hypot(g.x - x, g.z - z) < 1.3) return { action: 'sled', label: 'E · 🛷 눈썰매 타기' }
  }
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
  // 🛷 눈썰매 언덕 (걸어서는 못 올라간다. 탈 때만 위로)
  const c = sledPoint((-SLED.deck - SLED.back + SLED.len * 0.8) / 2)
  boxes.push({ x: c.x, z: c.z, rot: SLED_ROT, hw: SLED.half - 0.2, hd: (SLED.deck + SLED.back + SLED.len * 0.8) / 2 })
}
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
  // 울타리 안쪽. 단, 앞쪽 대문 폭 안에서는 입구 길로 나갈 수 있다
  const r = Math.hypot(x, z)
  const max = VILLAGE_R - 0.9
  if (r > max && z > 0 && Math.abs(x) < GATE_HW + 0.4) {
    x = Math.max(-GATE_HW, Math.min(GATE_HW, x))
    z = Math.min(z, GATE_OUT)
  } else if (r > max) {
    x = (x / r) * max
    z = (z / r) * max
  }
  return { x, z }
}
