// 쿠키 꾸미기 옵션. 화면(Cookie.tsx, 꾸미기 창)과 서버(저장할 때 검사)가 같이 쓴다.
// 나중에 늘어난 칸(얼굴·배 장식)은 예전에 저장된 모습에 없으니 cleanLook 이 기본값으로 채운다.

export const DOUGHS = {
  light: { label: '버터 쿠키', color: '#e2ac72' },
  classic: { label: '진저브레드', color: '#c27b42' },
  choco: { label: '초코 쿠키', color: '#7a4424' },
  strawberry: { label: '딸기 쿠키', color: '#eca3a3' },
  matcha: { label: '말차 쿠키', color: '#a5b86e' },
  gold: { label: '황금 쿠키', color: '#e6b422' }, // Lv.10
} as const

export const HATS = {
  santa: '🎅 산타 모자',
  beanie: '🧶 방울 비니',
  elf: '🧝 엘프 모자',
  antlers: '🦌 루돌프 뿔',
  cat: '🐱 고양이 귀',
  crown: '👑 왕관',
  earmuffs: '🎧 귀마개',
  headphones: '🎵 헤드폰',
  bolt: '⚡ 번개 귀 머리띠', // Lv.3
  astro: '🧑‍🚀 우주 헬멧', // Lv.7
  none: '🙂 없음',
} as const

/** 색을 고를 수 있는 머리 */
export const COLORED_HATS: readonly (keyof typeof HATS)[] = ['beanie', 'elf', 'earmuffs', 'headphones']

export const EYES = {
  dot: '• • 동글',
  sparkle: '✨ 반짝',
  happy: '^ ^ 웃음',
  wink: '😉 윙크',
  sleepy: '😌 졸림',
} as const

export const MOUTHS = {
  smile: '🙂 방긋',
  open: '😃 활짝',
  cat: 'ω 냥',
  o: '😮 오!',
} as const

export const CHEEKS = {
  pink: '🌸 발그레',
  freckle: '🟤 주근깨',
  none: '없음',
} as const

export const DECOS = {
  buttons: '🍬 젤리 단추',
  heart: '❤️ 하트',
  star: '⭐ 별',
  none: '없음',
} as const

export const EXTRAS = {
  none: '없음',
  glasses: '👓 안경',
  bow: '🎀 리본',
  star: '⭐ 별 핀',
  bell: '🔔 방울 목걸이',
  mittens: '🧤 벙어리장갑',
  candy: '🍭 지팡이 사탕',
  cape: '🦸 망토',
  wings: '🪽 천사 날개', // Lv.5
  jetpack: '🚀 WithSet 제트팩', // Lv.9
} as const

/** 👕 옷 (목도리 색을 따라가는 것도 있다) */
export const OUTFITS = {
  none: '없음',
  knit: '❄️ 눈꽃 니트', // Lv.2
  padding: '🧥 롱패딩', // Lv.4
  santa: '🎅 산타 옷', // Lv.6
  tux: '🤵 연말 파티 정장', // Lv.8
} as const

/** 🔓 레벨이 올라야 열리는 꾸미기 (나머지는 처음부터) */
export const UNLOCKS: Record<string, number> = {
  'outfit:knit': 2,
  'hat:bolt': 3,
  'outfit:padding': 4,
  'extra:wings': 5,
  'outfit:santa': 6,
  'hat:astro': 7,
  'outfit:tux': 8,
  'extra:jetpack': 9,
  'dough:gold': 10,
}
export type LockKind = 'hat' | 'extra' | 'outfit' | 'dough'
/** 이 꾸미기가 열리는 레벨 (처음부터 열려 있으면 1) */
export const unlockLevel = (kind: LockKind, key: string) => UNLOCKS[`${kind}:${key}`] ?? 1
/** 레벨 오르면 새로 열리는 것들 (레벨업 축하용) */
export const unlocksAt = (lv: number) => Object.entries(UNLOCKS).filter(([, l]) => l === lv).map(([k]) => k)

export const COLORS = ['#c62a24', '#2e7d4f', '#2f62b0', '#e0a21a', '#7a3fb0', '#e06a9a', '#1f8a8a', '#f4f1ea', '#2a2230'] as const

export type Look = {
  dough: keyof typeof DOUGHS
  hat: keyof typeof HATS
  hatColor: string
  scarf: string // 목도리 색 (장갑·망토도 이 색)
  extra: keyof typeof EXTRAS
  eyes: keyof typeof EYES
  mouth: keyof typeof MOUTHS
  cheek: keyof typeof CHEEKS
  deco: keyof typeof DECOS
  outfit: keyof typeof OUTFITS
}

/** 아직 꾸미지 않은 사람은 번호로 정해지는 기본 모습 */
export function defaultLook(seed: number): Look {
  const hats: Look['hat'][] = ['santa', 'beanie', 'none', 'santa', 'beanie']
  return {
    dough: 'classic',
    hat: hats[seed % hats.length],
    hatColor: COLORS[(seed * 3 + 2) % 7],
    scarf: COLORS[seed % 7],
    extra: 'none',
    eyes: 'dot',
    mouth: 'smile',
    cheek: 'pink',
    deco: 'buttons',
    outfit: 'none',
  }
}

const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[]
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)

/** 받은 값을 정해진 선택지로만 정리한다. 이상한 값·없는 칸은 기본값으로 */
export function cleanLook(input: unknown, seed = 0, level = Infinity): Look {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const d = defaultLook(seed)
  // 아직 레벨이 안 된 꾸미기는 기본값으로 (서버가 저장할 때 내 레벨을 넘겨 검사한다)
  const ok = <T extends string>(kind: LockKind, v: T, fallback: T): T => (unlockLevel(kind, v) <= level ? v : fallback)
  return {
    dough: ok('dough', pick(o.dough, keys(DOUGHS), d.dough), d.dough),
    hat: ok('hat', pick(o.hat, keys(HATS), d.hat), d.hat),
    hatColor: pick(o.hatColor, COLORS, d.hatColor),
    scarf: pick(o.scarf, COLORS, d.scarf),
    extra: ok('extra', pick(o.extra, keys(EXTRAS), d.extra), 'none'),
    eyes: pick(o.eyes, keys(EYES), d.eyes),
    mouth: pick(o.mouth, keys(MOUTHS), d.mouth),
    cheek: pick(o.cheek, keys(CHEEKS), d.cheek),
    deco: pick(o.deco, keys(DECOS), d.deco),
    outfit: ok('outfit', pick(o.outfit, keys(OUTFITS), 'none'), 'none'),
  }
}

/** 🎲 아무거나 */
export function randomLook(rand: () => number = Math.random, level = 1): Look {
  const one = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
  return {
    dough: one(keys(DOUGHS).filter((k) => unlockLevel('dough', k) <= level)),
    hat: one(keys(HATS).filter((k) => unlockLevel('hat', k) <= level)),
    hatColor: one(COLORS),
    scarf: one(COLORS),
    extra: one(keys(EXTRAS).filter((k) => unlockLevel('extra', k) <= level)),
    eyes: one(keys(EYES)),
    mouth: one(keys(MOUTHS)),
    cheek: one(keys(CHEEKS)),
    deco: one(keys(DECOS)),
    outfit: one(keys(OUTFITS).filter((k) => unlockLevel('outfit', k) <= level)),
  }
}
