// 🏆 AX 어워즈 인터뷰: 🧝 엘프가 동료 한 명에 대해 고정 질문 3개를 묻는다.
// 답은 준 사람 말고 아무도 못 본다. 공개일 전에 운영자가 Claude Code 로 받은 사람별 답을 모아(누가 했는지는 빼고)
// 상장(상 이름 + 문구)을 쓰고 award_cards 에 넣는다 (scripts/awards.ts).

export const INTERVIEW_MAX = 3 // 질문 수
export const ANSWER_MAX = 300 // 답 한 개의 글자 수
export const NICK_MAX = 15 // 마지막 답이 이보다 짧으면 "직접 쓴 키워드"로도 쓴다

export type QA = { q: string; a: string }

// fresh: 둘 중 한 명이라도 🌱 새로 온 사람이면(아직 같이 일해 본 적이 없으면) 첫인상·기대 질문으로 바꾼다
export const questions = (name: string, fresh = false) =>
  fresh
    ? [
        `${name}님을 처음 봤을 때(또는 합류 소식을 들었을 때) 첫인상은 어땠나요? 🎄`,
        `앞으로 ${name}님이랑 같이 해 보고 싶은 일이나 기대되는 점이 있다면요?`,
        `마지막! ${name}님을 한 단어(또는 짧은 별명)로 표현하면요?`,
      ]
    : [
        `올해 ${name}님과 함께하면서 인상 깊었거나 고마웠던 순간이 있었나요? 생각나는 장면 하나만 들려주세요 🎄`,
        `오, 그때 ${name}님이 어떻게 해 줬는지 조금만 더 자세히 들려줄래요?`,
        `마지막! ${name}님을 한 단어(또는 짧은 별명)로 표현하면요?`,
      ]

/** 보낸 대화 정리: 질문·답 모두 글자로, 답은 공백 정리 후 300자, 최대 3개 */
export function cleanChat(input: unknown): QA[] {
  if (!Array.isArray(input)) return []
  const out: QA[] = []
  for (const x of input) {
    if (!x || typeof x !== 'object') continue
    const { q, a } = x as { q?: unknown; a?: unknown }
    if (typeof q !== 'string' || typeof a !== 'string') continue
    const answer = a.replace(/\s+/g, ' ').trim().slice(0, ANSWER_MAX)
    if (!answer) continue
    out.push({ q: q.replace(/\s+/g, ' ').trim().slice(0, 200), a: answer })
  }
  return out.slice(0, INTERVIEW_MAX)
}

/** 마지막 답(한 단어/별명)이 짧으면 직접 쓴 키워드로. 끝 문장부호·따옴표는 뗀다 */
export function nickname(answer: string | undefined): string | null {
  const v = (answer ?? '').replace(/^["'“”‘’\s]+|["'“”‘’.!?~\s]+$/g, '').trim()
  return v && v.length <= NICK_MAX ? v : null
}
