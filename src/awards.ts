// 🏆 AX 어워즈. 상마다 한 명씩 투표하고, 결과는 공개일(REVEAL)에 마니또 공개와 함께 열린다.
// 상 목록은 운영자가 ⚙️ 운영 → 어워즈 에서 바꿀 수 있다. 아래는 기본 목록.

export const DEFAULT_AWARDS = [
  '🔥 오늘 일 다 했으면, 내일 일 하는 상',
  '☕ 커피 수혈왕',
  '👏 리액션 장인',
  '💡 올해의 아이디어 뱅크',
  '🍱 점심 메뉴 결정왕',
  '🏃 칼퇴 요정',
  '🤖 AI보다 빠른 사람',
] as const

export const AWARD_MAX = 40 // 상 이름 글자 수
export const AWARDS_LIMIT = 15 // 상 개수

/** 운영자가 보낸 상 목록 정리: 빈 줄·중복 빼고, 길이와 개수 자르기 */
export function cleanAwards(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split('\n') : []
  const out: string[] = []
  for (const v of arr) {
    if (typeof v !== 'string') continue
    const a = v.trim().slice(0, AWARD_MAX)
    if (a && !out.includes(a)) out.push(a)
  }
  return out.slice(0, AWARDS_LIMIT)
}

export type Vote = { category: string; nomineeId: number }
export type AwardResult = { category: string; winners: number[]; votes: number }

/** 상마다 가장 많이 받은 사람(동점이면 여럿). 표가 없으면 winners 는 빈 배열 */
export function tally(categories: readonly string[], votes: readonly Vote[]): AwardResult[] {
  return categories.map((category) => {
    const count = new Map<number, number>()
    for (const v of votes) if (v.category === category) count.set(v.nomineeId, (count.get(v.nomineeId) ?? 0) + 1)
    const max = Math.max(0, ...count.values())
    const winners = max ? [...count].filter(([, n]) => n === max).map(([id]) => id).sort((a, b) => a - b) : []
    return { category, winners, votes: max }
  })
}
