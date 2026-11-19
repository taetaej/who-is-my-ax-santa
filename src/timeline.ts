// 2026 AX 연대기. 입구 아치에서 광장까지 걸어 들어오는 길에 한 달씩 팻말로 선다.
// fun = 팻말에 크게 보이는 가벼운 한 줄, lines = 원문 그대로의 기록 (가까이 가면 펼쳐진다)

export type Milestone = { month: string; emoji: string; fun: string; title: string; lines: string[] }

export const TIMELINE_TITLE = '2026 AX팀의 발자취: AI로 일하는 방식을 바꾸다'

export const TIMELINE: Milestone[] = [
  {
    month: '2026. 03',
    emoji: '🚀',
    fun: 'SpinX 탄생! 그리고 정문원님 등장',
    title: '새로운 시작과 첫 엔진, SpinX 공개',
    lines: ['AX팀의 핵심 기술 기반이 되는 AI 에이전트 엔진 SpinX 최초 공개', '정문원님 합류로 AX팀에 새로운 활력 추가'],
  },
  {
    month: '2026. 06',
    emoji: '🎉',
    fun: 'ReadySet, 드디어 세상 밖으로!',
    title: 'ReadySet v1.0 그랜드 오픈',
    lines: ['통합 플랫폼 ReadySet 런칭 및 핵심 솔루션 Reach Caster, DataShot 동시 공개'],
  },
  {
    month: '2026. 08',
    emoji: '🔧',
    fun: '현업 피드백 먹고 쑥쑥 v1.1.0',
    title: '실무 디테일을 더하다, ReadySet v1.1.0 업데이트',
    lines: ['Reach Caster 시나리오 비교 및 DataShot 집계 기능 도입으로 현업 활용도 강화'],
  },
  {
    month: '2026. 09',
    emoji: '👋',
    fun: 'Welcome 서보라님! 그리고 BRIDGE 확장',
    title: '함께 성장하는 팀, Welcome 서보라님!',
    lines: ['서보라님 합류로 팀 시너지 확대', 'Intella 적용으로 BRIDGE 버티컬 매체 수집 확장 (10월까지 9개 매체 추가 수집!)'],
  },
  {
    month: '2026. 10',
    emoji: '📊',
    fun: '예산은 BudgetOpt가, 검산은 AXiom이',
    title: '미디어 플래닝의 진화와 AI 신뢰도 강화',
    lines: [
      '업종별 최적화 모델 기반 매체·상품별 예산 배분 솔루션 BudgetOpt 2.0 (ReadySet v1.2.0) 정식 출시',
      'SpinX 답변 정확성 검증 모델 AXiom v1.0 최초 공개',
    ],
  },
  {
    month: '2026. 11',
    emoji: '🏆',
    fun: '결과물 3,000개 돌파에 SpinX 수상까지!',
    title: '누적 결과물 3,000개 돌파 & ReadySet v1.3.0',
    lines: [
      'DataShot 고도화(v1.3.0) 업데이트',
      '런칭 5개월 만에 ReadySet 생성 결과물 3,000건 달성으로 사내 핵심 워크툴 안착',
      'SpinX, 2분기 PLAYBOOK "새로운 시도와 도전" 부문 수상 🏆',
    ],
  },
  {
    month: '2026. 12',
    emoji: '🎄',
    fun: 'Welcome 정재은·구경민·오수정님!',
    title: '새로운 시작을 함께하며, Welcome New Members!',
    lines: ['정재은님, 구경민님, 오수정님 합류'],
  },
]
