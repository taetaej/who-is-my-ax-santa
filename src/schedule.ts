// 📅 행사 일정 (이벤트 캘린더 · 오늘의 할 일 · 산타 미션). 서버도 쓰므로 아무것도 import 하지 않는다.
// 12/1~4 오프닝 → 12/7 산타 발표 → 2일마다 산타 미션 → 12/15~16 관찰 리포트·추리노트 마감 → 12/17 공개일

export const OPEN_DAY = '2026-12-01' // 🎄 마을 오픈 (입장 + 꾸미기)
export const PROFILE_DUE = '2026-12-02' // 📝 자기소개(내 프로필) 마감
export const OPENING_TO = '2026-12-04' // 🌱 오프닝 주간 끝
export const MATCH_DAY = '2026-12-07' // 🎅 산타 발표 (운영자가 ⚙️ 운영에서 버튼을 누르는 날)
export const AWARDS_DUE = '2026-12-14' // 🏆 어워즈 인터뷰 마감 (12/15에 상장을 만든다)
export const WRITE_FROM = '2026-12-15' // ✍️ 관찰 리포트 · 🔍 추리노트 마감 주간
export const REVEAL_DAY = '2026-12-17' // 🎬 공개일

export type MissionId = 'watch' | 'snack' | 'cheer' | 'gift' | 'photo'
export type Mission = { id: MissionId; n: number; from: string; to: string; emoji: string; title: string; desc: string; tip: string; bonus?: boolean }

/** 🎅 산타 미션: 2일마다 하나씩. 체크는 나만 보고, 한 번 할 때마다 XP */
export const MISSIONS: readonly Mission[] = [
  {
    id: 'watch',
    n: 1,
    from: '2026-12-07',
    to: '2026-12-08',
    emoji: '🔭',
    title: '몰래 관찰하기',
    desc: '내가 챙길 사람의 프로필을 읽고, 자리·좋아하는 것·요즘 관심사를 들키지 않게 지켜보기',
    tip: '알게 된 건 🕵️ 관찰 리포트에 바로 메모해 두면 마감 때 편해요',
  },
  {
    id: 'snack',
    n: 2,
    from: '2026-12-09',
    to: '2026-12-10',
    emoji: '🍪',
    title: '간식 챙기기',
    desc: '최애 간식·음료를 이름 없이 자리에 살짝 두고 오기',
    tip: '프로필의 🙅 "이건 패스!" 항목은 꼭 확인!',
  },
  {
    id: 'cheer',
    n: 3,
    from: '2026-12-11',
    to: '2026-12-13',
    emoji: '💌',
    title: '응원 쪽지 남기기',
    desc: '포스트잇이나 익명 쪽지로 한 주 고생했다는 응원 한마디',
    tip: '손글씨로 들킬 수 있어요… 프린트도 OK 🤫',
  },
  {
    id: 'gift',
    n: 4,
    from: '2026-12-14',
    to: '2026-12-16',
    emoji: '🎁',
    title: '선물 준비하기',
    desc: '공개일에 건넬 작은 선물을 준비하고, 관찰 리포트에 무슨 선물인지 적어 두기',
    tip: '관찰하며 알게 된 취향을 담으면 감동 두 배 ✨',
  },
  {
    id: 'photo',
    n: 5,
    from: '2026-12-07',
    to: '2026-12-16',
    emoji: '📸',
    title: '같이 사진 찍기',
    desc: '마을에서 내가 챙길 사람 옆에 슬쩍 가서 몰래 사진 찍기 (☰ 더보기 → 📸 사진 찍기)',
    tip: '공개일에 정체 공개 카드 옆에 이 사진이 같이 나와요 ㅋㅋ 들키지 않게!',
    bonus: true,
  },
]

export const MISSION_IDS = MISSIONS.map((m) => m.id) as readonly MissionId[]
export const isMissionId = (v: unknown): v is MissionId => typeof v === 'string' && (MISSION_IDS as readonly string[]).includes(v)
export const missionById = (id: MissionId) => MISSIONS.find((m) => m.id === id)!

/** 그날 진행 중인 산타 미션 (주말은 앞 미션이 이어진다) */
export function missionOn(day: string): Mission | null {
  return MISSIONS.find((m) => !m.bonus && m.from <= day && day <= m.to) ?? null
}

/** 미션을 체크할 수 있는지: 시작일부터 공개일 전까지 (지난 미션도 늦게 체크 가능) */
export const missionOpen = (m: Mission, day: string) => m.from <= day && day < REVEAL_DAY

export type EventKind = 'open' | 'all' | 'santa' | 'mission' | 'due' | 'reveal'
export type CalEvent = { from: string; to: string; emoji: string; title: string; desc: string; kind: EventKind; mission?: MissionId }

/** 📅 캘린더에 보이는 일정 (날짜 순) */
export const EVENTS: readonly CalEvent[] = [
  { from: OPEN_DAY, to: OPEN_DAY, emoji: '🎄', title: '마을 오픈! 입장하고 쿠키 꾸미기', desc: 'PIN 으로 들어와서 내 쿠키를 꾸미면 끝', kind: 'open' },
  { from: OPEN_DAY, to: PROFILE_DUE, emoji: '📝', title: '자기소개 쓰기', desc: '✏️ 내 프로필에 MBTI·자리·최애 간식 등을 적어요. 나를 챙길 산타만 봐요', kind: 'all' },
  {
    from: OPEN_DAY,
    to: OPENING_TO,
    emoji: '🌱',
    title: '오프닝 주간',
    desc: '매일 메시지 트리 한 장, 썰매·눈굴리기 기록 도전, 눈싸움으로 레벨 올리기',
    kind: 'all',
  },
  { from: OPEN_DAY, to: AWARDS_DUE, emoji: '🏆', title: '어워즈 인터뷰', desc: '동료마다 엘프 질문 3개 (1분). 모아서 공개일에 상장이 돼요', kind: 'all' },
  { from: MATCH_DAY, to: MATCH_DAY, emoji: '🎅', title: '산타 발표! 내가 챙길 사람 확인', desc: '🎅 내가 챙길 사람에서 확인해요. 이날부터 숨은 선물 찾기도 열려요 🎀', kind: 'santa' },
  ...MISSIONS.filter((m) => m.bonus).map(
    (m): CalEvent => ({ from: m.from, to: m.to, emoji: m.emoji, title: `보너스 미션 ${m.title}`, desc: m.desc, kind: 'all', mission: m.id }),
  ),
  ...MISSIONS.filter((m) => !m.bonus).map(
    (m): CalEvent => ({ from: m.from, to: m.to, emoji: m.emoji, title: `산타 미션 ${'①②③④'[m.n - 1]} ${m.title}`, desc: m.desc, kind: 'mission', mission: m.id }),
  ),
  { from: WRITE_FROM, to: '2026-12-16', emoji: '✍️', title: '관찰 리포트 · 추리노트 마감', desc: '산타는 🕵️ 관찰 리포트를 제출하고, 모두 🔍 추리노트에 내 산타를 찍어요', kind: 'due' },
  { from: REVEAL_DAY, to: REVEAL_DAY, emoji: '🎬', title: '공개일 더블 리빌', desc: '관찰 리포트를 같이 읽고, 추리노트를 열고, 산타 정체 공개!', kind: 'reveal' },
]

/** 메시지 트리는 오픈일부터 공개일 전날까지 평일마다 */
export const treeOn = (day: string) => {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay()
  return day >= OPEN_DAY && day < REVEAL_DAY && w !== 0 && w !== 6
}

export const eventsOn = (day: string) => EVENTS.filter((e) => e.from <= day && day <= e.to)
