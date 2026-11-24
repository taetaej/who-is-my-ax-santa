// 💬 반응: 말 대신 이모지·짧은 한마디. 숫자키 1~8 또는 화면 오른쪽 버튼.
// - 가까이(REACT_RANGE) 있는 동료가 있으면 그 사람에게 보낸다: 그 사람 화면에 알림이 뜨고, 🫸 비켜! 는 살짝 밀린다.
// - 실시간: 내 presence 의 emote 값({id, n, to})이 바뀌면 다른 사람 화면에서 내 머리 위에 이모지가 뜬다.
// 서버·DB 에는 아무것도 남기지 않는다.

export const EMOTES = [
  { id: 'hi', icon: '👋', label: '안녕', say: ['안녕! 👋', '하이하이 👋'], to: (n: string) => `${n}님 안녕! 👋`, got: (n: string) => `👋 ${n}님이 인사했어요` },
  { id: 'heart', icon: '💖', label: '하트', say: ['💖', '사랑해요 AX 💖'], to: (n: string) => `${n}님께 💖`, got: (n: string) => `💖 ${n}님이 하트를 보냈어요` },
  { id: 'skull', icon: '💀', label: '해골', say: ['💀', '(영혼 가출) 💀'], to: (n: string) => `${n}님… 💀`, got: (n: string) => `💀 ${n}님이 해골을 날렸어요` },
  { id: 'lol', icon: '🤣', label: 'ㅋㅋㅋ', say: ['ㅋㅋㅋㅋㅋ 🤣', '개웃겨 🤣'], to: (n: string) => `${n}님 ㅋㅋㅋㅋ 🤣`, got: (n: string) => `🤣 ${n}님이 빵 터졌어요` },
  { id: 'move', icon: '🫸', label: '비켜!', say: ['비켜비켜~ 🫸', '지나갈게요~ 🫸'], to: (n: string) => `${n}님 비켜~! 🫸`, got: (n: string) => `🫸 ${n}님: 비켜~!` },
  { id: 'thx', icon: '🙏', label: '고마워', say: ['고마워요 🙏', '감사합니다 🙏'], to: (n: string) => `${n}님 고마워요 🙏`, got: (n: string) => `🙏 ${n}님이 고맙대요` },
  { id: 'fire', icon: '🔥', label: '화이팅', say: ['화이팅! 🔥', '가보자고 🔥'], to: (n: string) => `${n}님 화이팅! 🔥`, got: (n: string) => `🔥 ${n}님이 응원했어요` },
  { id: 'cry', icon: '😭', label: '엉엉', say: ['엉엉 😭', '퇴근하고 싶다 😭'], to: (n: string) => `${n}님… 😭`, got: (n: string) => `😭 ${n}님이 울고 있어요` },
] as const

export type EmoteId = (typeof EMOTES)[number]['id']
/** presence 로 보내는 값. n 이 바뀔 때마다 한 번 */
export type EmoteOut = { id: EmoteId; n: number; to: number | null }

export const REACT_RANGE = 2.8 // 이 거리 안의 가장 가까운 동료에게 보낸다
export const EMOTE_COOLDOWN = 0.7 // 초
export const PUSH_SPEED = 7 // 🫸 밀리는 첫 속도 (점점 줄어 약 1.4m)

export const emoteOf = (id: string) => EMOTES.find((e) => e.id === id) ?? null

export const emotes = {
  fire: null as ((id: EmoteId) => void) | null, // 내 쿠키가 반응한다 (Player 가 등록)
  onGot: null as ((from: { id: number; name: string; x: number; z: number }, id: EmoteId) => void) | null, // 누가 나에게 (Player 가 등록)
  toast: null as ((text: string) => void) | null, // 화면 위 알림 (App 이 등록)
}
