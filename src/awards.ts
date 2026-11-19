// 🏆 AX 어워즈: 동료 키워드 상.
// 나를 뺀 13명에게 키워드 칩을 1~3개(+ 직접 쓰기 1개) 주고, 내가 가장 많이 받은 키워드가 나의 상이 된다.
// 그래서 14명 모두 상을 받는다. 누가 어떤 키워드를 줬는지는 끝까지 비밀이고, 결과는 공개일(REVEAL)에 열린다.

export type Keyword = { id: string; chip: string; award: string; who: string }

// 칩 목록 (질문·문구 문서에서 컨펌). id 는 DB 에 저장되니 바꾸지 말 것. 글자는 바꿔도 된다.
export const KEYWORDS: readonly Keyword[] = [
  { id: 'fixer', chip: '🧯 해결사', award: '🧯 불 끄는 해결사상', who: '문제가 생기면 제일 먼저 달려오는' },
  { id: 'reliable', chip: '🤝 든든함', award: '🤝 믿고 맡기는 든든상', who: '맡기면 알아서 끝내는' },
  { id: 'detail', chip: '🔍 꼼꼼함', award: '🔍 꼼꼼 장인상', who: '오타 하나, 숫자 하나 안 놓치는' },
  { id: 'idea', chip: '💡 아이디어', award: '💡 아이디어 뱅크상', who: '회의 때 새 아이디어를 쏟아내는' },
  { id: 'ai', chip: '🤖 AI 고수', award: '🤖 AI보다 빠른 사람상', who: '새 AI 툴을 제일 먼저 써 보고 알려 주는' },
  { id: 'reaction', chip: '👏 리액션', award: '👏 리액션 장인상', who: '무슨 말을 해도 반응해 주는' },
  { id: 'mood', chip: '😂 분위기 메이커', award: '😂 분위기 메이커상', who: '있으면 팀이 밝아지는' },
  { id: 'passion', chip: '🔥 열정', award: '🔥 오늘 일 다 했으면, 내일 일 하는 상', who: '팀 명언 그 자체' },
  { id: 'doer', chip: '🚀 실행력', award: '🚀 일단 해 보는 상', who: '말보다 손이 먼저 가는' },
  { id: 'calm', chip: '🧘 평정심', award: '🧘 흔들리지 않는 평정심상', who: '마감 앞에서도 침착한' },
  { id: 'talk', chip: '🗣️ 소통', award: '🗣️ 통역 장인상', who: '어려운 말을 쉽게 풀어 주는' },
  { id: 'share', chip: '📚 공유', award: '📚 나눔 천사상', who: '알게 된 걸 바로 나눠 주는' },
  { id: 'care', chip: '🫶 배려', award: '🫶 다정한 배려상', who: '남을 먼저 챙기는' },
  { id: 'sense', chip: '🎨 센스', award: '🎨 센스 만점상', who: '장표와 디자인 감각이 좋은' },
  { id: 'data', chip: '📊 데이터', award: '📊 숫자로 말하는 상', who: '근거와 데이터로 설득하는' },
  { id: 'growth', chip: '🌱 성장', award: '🌱 쑥쑥 성장상', who: '올해 가장 많이 큰' },
  { id: 'question', chip: '🙋 질문', award: '🙋 핵심 찌르는 질문상', who: '모두가 궁금했던 걸 물어 주는' },
  { id: 'coffee', chip: '☕ 커피', award: '☕ 커피 수혈왕', who: '팀의 카페인 담당' },
  { id: 'snack', chip: '🍪 간식', award: '🍪 간식 요정상', who: '서랍에서 간식이 나오는' },
  { id: 'clockout', chip: '🏃 칼퇴', award: '🏃 칼퇴 요정상', who: '할 일 끝내고 깔끔하게 퇴근하는' },
]

export const CHIPS_MAX = 3 // 한 사람에게 줄 수 있는 칩 수
export const CUSTOM_MAX = 15 // 직접 쓰는 키워드 글자 수
export const DEFAULT_AWARD = '🎄 AX 산타 공식 인증 동료상' // 키워드를 하나도 못 받았을 때

const byId = new Map(KEYWORDS.map((k) => [k.id, k]))
export const keyword = (id: string) => byId.get(id)

export type Gift = { chips: string[]; custom: string | null }

/** 보낸 값 정리: 없는 칩·중복 빼고 3개까지, 직접 쓰기는 공백 정리 후 15자 */
export function cleanGift(input: unknown): Gift {
  const o = (input && typeof input === 'object' ? input : {}) as { chips?: unknown; custom?: unknown }
  const chips: string[] = []
  if (Array.isArray(o.chips)) for (const c of o.chips) if (typeof c === 'string' && byId.has(c) && !chips.includes(c)) chips.push(c)
  const custom = typeof o.custom === 'string' ? o.custom.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_MAX) : ''
  return { chips: chips.slice(0, CHIPS_MAX), custom: custom || null }
}

export const isEmptyGift = (g: Gift) => g.chips.length === 0 && !g.custom

export type AwardCard = {
  titles: string[] // 상 이름. 1등이 둘이면 2개 (2관왕)
  words: { label: string; n: number }[] // 받은 키워드 전체, 많은 순 (워드 클라우드)
  givers: number // 키워드를 준 사람 수
}

/** 한 사람이 받은 키워드로 상 만들기. 1등 칩이 상, 공동 1등이면 칩 목록 순서로 앞의 둘 */
export function awardFor(gifts: readonly Gift[]): AwardCard {
  const count = new Map<string, number>() // 칩은 id, 직접 쓴 건 '✍️' + 글자
  for (const g of gifts) {
    for (const c of g.chips) count.set(c, (count.get(c) ?? 0) + 1)
    if (g.custom) count.set('✍️' + g.custom, (count.get('✍️' + g.custom) ?? 0) + 1)
  }
  const order = (key: string) => {
    const i = KEYWORDS.findIndex((k) => k.id === key)
    return i < 0 ? KEYWORDS.length : i
  }
  const sorted = [...count].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
  const label = (key: string) => keyword(key)?.chip ?? key.slice(2)
  const title = (key: string) => keyword(key)?.award ?? `✍️ '${key.slice(2)}'상`
  const top = sorted.length ? sorted.filter(([, n]) => n === sorted[0][1]).slice(0, 2) : []
  return {
    titles: top.length ? top.map(([k]) => title(k)) : [DEFAULT_AWARD],
    words: sorted.map(([k, n]) => ({ label: label(k), n })),
    givers: gifts.filter((g) => !isEmptyGift(g)).length,
  }
}
