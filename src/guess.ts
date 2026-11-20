// 🔍 내 산타 추리노트: 관찰 리포트가 "산타가 나를 어떻게 지켜봤는지"라면,
// 추리노트는 "내가 산타의 흔적을 어떻게 눈치챘는지". 공개일 더블 리빌 2단계에서 열린다.
// - 진행 기간(ACTIVE) 동안 쓰고 고칠 수 있고, 공개일(REVEAL)에 관찰 리포트와 함께 잠긴다.
// - 공개일 전에는 쓴 본인만 본다. 운영자도 "썼는지"만 본다.
// 서버(server/app.ts)와 화면이 같이 쓰는 파일.

export type Guess = {
  suspect: number | null // 1. 내 산타라고 생각하는 사람 (player id, 나 빼고)
  confidence: number //    확신도 10~100 (%)
  reason: string // 2. 지목한 결정적 이유
  evidence: string // 3. 결정적 목격담 (선택)
  toSanta: string // 4. To. 내 산타 한마디
}

export const GUESS_LIMITS = { reason: 80, evidence: 80, toSanta: 100 }
export const CONFIDENCE_MIN = 10
export const EMPTY_GUESS: Guess = { suspect: null, confidence: 50, reason: '', evidence: '', toSanta: '' }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** 받은 값을 정해진 칸과 길이로만 정리한다. suspect 는 validIds(나를 뺀 플레이어) 안에서만 */
export function cleanGuess(input: unknown, validIds: readonly number[]): Guess {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const id = typeof o.suspect === 'number' && validIds.includes(o.suspect) ? o.suspect : null
  const c = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? o.confidence : EMPTY_GUESS.confidence
  return {
    suspect: id,
    confidence: Math.round(Math.min(100, Math.max(CONFIDENCE_MIN, c))),
    reason: str(o.reason, GUESS_LIMITS.reason),
    evidence: str(o.evidence, GUESS_LIMITS.evidence),
    toSanta: str(o.toSanta, GUESS_LIMITS.toSanta),
  }
}

/** 다 썼는지 (목격담은 선택) */
export const guessDone = (g: Guess) => g.suspect !== null && !!g.reason && !!g.toSanta

export type GuessStatus = 'none' | 'draft' | 'done'

/** 확신도 말풍선 */
export function confidenceLabel(n: number) {
  if (n >= 95) return '100% 확신함 😤'
  if (n >= 70) return '거의 확실 🧐'
  if (n >= 40) return '반반 🤔'
  return '찍기 🎲'
}
