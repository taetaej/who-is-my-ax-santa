// 쿠키 꾸미기 옵션. 화면(Cookie.tsx, 꾸미기 창)과 서버(저장할 때 검사)가 같이 쓴다.

export const DOUGHS = {
  light: { label: '버터 쿠키', color: '#d9a066' },
  classic: { label: '진저브레드', color: '#b8723a' },
  choco: { label: '초코 쿠키', color: '#7a4424' },
} as const

export const HATS = {
  santa: '🎅 산타 모자',
  beanie: '🧶 방울 비니',
  antlers: '🦌 루돌프 뿔',
  crown: '👑 왕관',
  earmuffs: '🎧 귀마개',
  none: '🙂 없음',
} as const

export const EXTRAS = {
  none: '없음',
  glasses: '👓 안경',
  bow: '🎀 리본',
  star: '⭐ 별 핀',
  bell: '🔔 방울 목걸이',
} as const

export const COLORS = ['#c62a24', '#2e7d4f', '#2f62b0', '#e0a21a', '#7a3fb0', '#e06a9a', '#1f8a8a', '#f4f1ea', '#2a2230'] as const

export type Look = {
  dough: keyof typeof DOUGHS
  hat: keyof typeof HATS
  hatColor: string
  scarf: string
  extra: keyof typeof EXTRAS
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
  }
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)

/** 받은 값을 정해진 선택지로만 정리한다. 이상한 값은 기본값으로 */
export function cleanLook(input: unknown, seed = 0): Look {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const d = defaultLook(seed)
  return {
    dough: pick(o.dough, Object.keys(DOUGHS) as Look['dough'][], d.dough),
    hat: pick(o.hat, Object.keys(HATS) as Look['hat'][], d.hat),
    hatColor: pick(o.hatColor, COLORS, d.hatColor),
    scarf: pick(o.scarf, COLORS, d.scarf),
    extra: pick(o.extra, Object.keys(EXTRAS) as Look['extra'][], d.extra),
  }
}
