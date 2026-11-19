// 메시지 트리 "오늘의 질문". 하루에 하나씩, 날짜가 바뀌면 다음 질문으로 넘어간다 (한국 시간 기준).
// 운영자가 ⚙️ 운영 → 메시지 트리 질문 에서 목록과 시작일을 바꿀 수 있다 (DB settings 에 저장).
// 아래는 운영자가 아직 아무것도 저장하지 않았을 때 쓰는 기본 목록이다.

export const QUESTIONS = [
  '올해 가장 자랑스러웠던 일은? 🏆',
  '올해 가장 맛있었던 회사 식당 메뉴는? 🍱',
  '올해 나를 버티게 한 간식은? 🍫',
  '올해 팀에서 가장 웃겼던 순간은? 😂',
  '올해 가장 많이 들은 노래는? 🎧',
  '올해의 나에게 상을 준다면, 무슨 상? 🏅',
  '회사 근처 최애 점심·카페는? ☕',
  '올해 새로 시작한 것은? 🌱',
  '올해 배운 것 중 가장 쓸모 있었던 것은? 💡',
  '내 책상 위 최애 아이템은? 🖥️',
  '올해 고마웠던 동료에게 한마디 (이름 언급 OK) 💌',
  '올해를 한 단어로 표현하면? ✍️',
  '올해 가장 기억에 남는 여행·휴가는? ✈️',
  '크리스마스에 받고 싶은 선물은? 🎁',
  '연말에 꼭 하고 싶은 것은? 🎄',
  '내년에 꼭 해 보고 싶은 것은? 🚀',
  '내년의 나에게 한마디 📮',
] as const

/** 첫 번째 질문이 나오는 날 (행사 시작일). 이날부터 하루에 하나씩 */
export const FIRST_DAY = '2026-12-01'

const DAY_MS = 24 * 60 * 60 * 1000

/** 한국 시간 기준 오늘 날짜 'YYYY-MM-DD' */
export function kstDay(nowMs = Date.now()): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** 두 날짜 사이 일수 (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

export const QUESTION_MAX = 80 // 질문 한 개 글자 수
export const QUESTIONS_LIMIT = 60 // 질문 개수

/** 그날의 질문 (목록이 끝나면 처음부터 다시) */
export function questionFor(day: string, list: readonly string[] = QUESTIONS, start = FIRST_DAY): string {
  const n = list.length
  if (!n) return ''
  const i = ((daysBetween(start, day) % n) + n) % n
  return list[i]
}

/** 운영자가 보낸 질문 목록 정리: 빈 줄 빼고, 길이 자르고, 개수 제한 */
export function cleanQuestions(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split('\n') : []
  return arr
    .filter((q): q is string => typeof q === 'string')
    .map((q) => q.trim().slice(0, QUESTION_MAX))
    .filter(Boolean)
    .slice(0, QUESTIONS_LIMIT)
}
