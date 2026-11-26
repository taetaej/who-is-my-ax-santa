// 메시지 트리 "오늘의 질문". 평일 하루에 하나씩, 날짜가 바뀌면 다음 질문으로 넘어간다 (한국 시간 기준).
// 주말(토·일)에는 새 질문 없이 금요일 질문이 이어지고, 주말에 쓴 답도 금요일 카드로 걸린다.
// 운영자가 ⚙️ 운영 → 메시지 트리 질문 에서 목록과 시작일을 바꿀 수 있다 (DB settings 에 저장).
// 아래는 운영자가 아직 아무것도 저장하지 않았을 때 쓰는 기본 목록이다.

export const QUESTIONS = [
  // 1주차: 가볍고 유쾌한 워밍업 (12/1 화 – 12/4 금)
  '올해 일하면서 가장 많이 쓴 툴은? "이런 툴도 써 봤어요?" 하고 소개하고 싶은 툴도 좋아요 🛠️',
  '올해 일하면서 가장 웃겼거나 황당했던 순간은? 😂',
  '올해 나를 버티게 해 준 최애 간식, 음료, 혹은 루틴은? ☕',
  '미리 골라보는 크리스마스 소원! 올해 꼭 받고 싶은 선물은? 🎁',
  // 2주차: 올해의 성장과 우리 팀의 기록 (12/7 월 – 12/11 금)
  '올해 새로 배운 것 중 가장 쓸모 있었던 꿀팁이나 지식은? 💡',
  '올해 AI 덕분에 일하는 방식이 확 바뀐 순간이 있다면? 🤖',
  '다른 팀에 슬쩍 자랑하고 싶은 우리 팀만의 문화나 장점은? 🌟',
  '올해 가장 뿌듯했던 순간! 스스로에게 상을 준다면 무슨 상? 🏆',
  '올해 우리가 함께 넘은 가장 큰 산은 무엇이었을까? ⛰️',
  // 3주차: 따뜻한 회고와 새해 다짐 (12/14 월 – 12/16 수)
  '올 한 해를 딱 한 단어(또는 한 줄)로 표현한다면? ✍️',
  '내년에 일적으로든 개인적으로든 꼭 해 보고 싶은 일은? 🌱',
  '한 해 동안 고생한 우리 팀에게, 그리고 나에게 남기는 한마디 🚀',
] as const

/** 첫 번째 질문이 나오는 날 (행사 시작일). 이날부터 평일마다 하나씩 */
export const FIRST_DAY = '2026-12-01' // 마을 오픈일 (12/1~4 오프닝, 12/7 산타 발표, 12/17 공개). src/schedule.ts 와 맞춘다

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

export const isWeekend = (day: string) => {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay()
  return w === 0 || w === 6
}

/** 메시지 트리의 "오늘": 주말이면 바로 앞 금요일 (주말엔 금요일 질문이 이어진다) */
export function treeDay(nowMs = Date.now()): string {
  let d = kstDay(nowMs)
  while (isWeekend(d)) d = addDays(d, -1)
  return d
}

/** start 부터 day 앞날까지의 평일 수 (day 가 start 보다 앞이면 음수) */
export function weekdaysBetween(start: string, day: string): number {
  const [a, b, sign] = start <= day ? [start, day, 1] : [day, start, -1]
  const days = daysBetween(a, b)
  let n = Math.floor(days / 7) * 5
  for (let i = Math.floor(days / 7) * 7; i < days; i++) if (!isWeekend(addDays(a, i))) n++
  return n * sign
}

/** 질문 i 번이 나오는 날 (시작일부터 평일만 센다) */
export function questionDay(start: string, i: number): string {
  let d = start
  while (isWeekend(d)) d = addDays(d, 1)
  for (let k = 0; k < i; ) {
    d = addDays(d, 1)
    if (!isWeekend(d)) k++
  }
  return d
}

/** 그날의 질문. 평일만 세고, 목록이 끝나면 처음부터 다시. 주말은 앞 금요일 질문 */
export function questionFor(day: string, list: readonly string[] = QUESTIONS, start = FIRST_DAY): string {
  const n = list.length
  if (!n) return ''
  let d = day
  while (isWeekend(d)) d = addDays(d, -1)
  const i = ((weekdaysBetween(start, d) % n) + n) % n
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
