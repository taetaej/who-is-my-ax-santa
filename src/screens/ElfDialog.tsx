import { useEffect, useMemo, useState } from 'react'
import type { Me } from '../api'
import { MOTTO } from '../team'

// 🧝 AX 엘프와의 대화. 내 할 일(마니또 상자, 메시지 트리, 어워즈 키워드, 소개서)을 확인해서 잔소리하고,
// 마을에서 할 수 있는 것을 하나씩 알려 준다. E·Space·Enter 로 넘기고 Esc 로 닫는다.

export type ElfGo = 'manito' | 'tree' | 'awards' | 'letter' | 'look'
type Line = { text: string; go?: { to: ElfGo; label: string } }

const TIPS = [
  '☕ AX 카페에서 핫초코 받아 가! 손에 들고 다니면 따뜻해 보여.',
  '🔥 불멍 회의실에 앉아 봐. 김민지 2026 캐롤 들으면서 다같이 리듬 타는 중이야 🎶',
  '❄️ 눈밭에서 E 누르면 누워서 스노우엔젤 할 수 있어. 눈싸움도 곧 열린대!',
  '🧊 트리 둘레 얼음 연못은 엄청 미끄러워. 조심… 아니 일부러 가 봐 ⛸️',
  '🎨 아래 메뉴 꾸미기에서 쿠키 옷을 갈아입을 수 있어. 루돌프 뿔 추천!',
  '👋 Space 누르면 인사해. 지나가는 사람한테 해 봐!',
  '🎂 왼쪽 AX 파티 테이블에 3단 케이크 있어! 한 조각 먹고 가 🍰',
  '📜 큰 트리 뒤쪽, 마을 맨 안쪽에 2026 AX 연대기 전시가 있어. 걸어가면서 한 달씩 구경해 봐!',
  '🎄 광장 큰 트리가 메시지 트리야! 오늘의 질문에 답하면 카드가 하나씩 걸려.',
]

/** 지금 내 상태로 엘프가 할 말 (잔소리 → 다 했으면 칭찬 → 마을 팁 하나) */
export function elfLines(me: Me, question: string | null, tipIndex: number): Line[] {
  const nags: Line[] = []
  if (me.phase === 'ACTIVE' && !me.manitoOpened) {
    nags.push({ text: '🎁 잠깐! 아직 마니또 선물 상자도 안 열었어?! 누굴 챙길지는 알아야지!', go: { to: 'manito', label: '🎁 상자 열러 가기' } })
  }
  if (!me.todo.tree) {
    nags.push({
      text: `🎄 오늘 메시지 트리 아직 안 썼지? 오늘 질문은 "${question ?? '…'}" 한 줄이면 돼!`,
      go: { to: 'tree', label: '🎄 메시지 트리 쓰기' },
    })
  }
  if (me.phase !== 'REVEAL' && me.todo.given < me.todo.people) {
    const left = me.todo.people - me.todo.given
    nags.push({
      text:
        me.todo.given === 0
          ? `🏆 동료들한테 키워드 하나도 안 줬더라? 네가 준 키워드로 다들 상을 받는다고!`
          : `🏆 키워드 ${me.todo.given}/${me.todo.people}명… ${left}명 남았어, 마저 주자!`,
      go: { to: 'awards', label: '🏆 키워드 주러 가기' },
    })
  }
  if (me.phase === 'ACTIVE' && me.letter !== 'submitted') {
    nags.push({
      text: me.letter === 'none' ? '💌 마니또 소개서는 시작도 안 했네… 공개일 전에 꼭 제출해야 해!' : '💌 소개서 쓰는 중이구나! 다 쓰면 제출 버튼 누르는 거 잊지 마.',
      go: { to: 'letter', label: '💌 소개서 쓰기' },
    })
  }

  const hello: Line = { text: `${me.name} 님 안녕! 나는 AX 엘프 🧝 우리 팀 명언 알지? "${MOTTO}"` }
  const tip: Line = { text: TIPS[tipIndex % TIPS.length] }
  if (nags.length === 0) {
    return [hello, { text: '오… 오늘 할 일 다 했네?! 👏 그럼 명언대로… 내일 일 해라 ㅋㅋ 농담이고, 마을에서 놀다 가!' }, tip]
  }
  return [hello, { text: `오늘 할 일이 ${nags.length}개 남았어. 하나씩 알려 줄게 👀` }, ...nags, { text: '다 하면 다시 와! 그다음엔 놀아도 돼 🎄' }, tip]
}

/** 머리 위 혼잣말 (짧게). alert = 할 일이 남았는지 (머리 위 ❗) */
export function elfChatter(me: Me): { alert: boolean; chatter: string[] } {
  const out: string[] = []
  if (!me.todo.tree) out.push('메시지 트리 썼어? 🎄')
  if (me.phase !== 'REVEAL' && me.todo.given < me.todo.people) out.push('키워드 다 줬어? 🏆')
  if (me.phase === 'ACTIVE' && me.letter !== 'submitted') out.push('소개서는…? 💌')
  if (me.phase === 'ACTIVE' && !me.manitoOpened) out.unshift('마니또 상자 열었어? 🎁')
  return out.length ? { alert: true, chatter: out } : { alert: false, chatter: [`"${MOTTO}" 🧝`] }
}

export function ElfDialog({ me, question, onGo, onClose }: { me: Me; question: string | null; onGo: (to: ElfGo) => void; onClose: () => void }) {
  const [tip] = useState(() => Math.floor(Math.random() * TIPS.length))
  // 대화를 여는 순간의 상태로 고정 (도중에 바뀌어도 순서가 흔들리지 않게)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lines = useMemo(() => elfLines(me, question, tip), [])
  const [i, setI] = useState(0)
  const line = lines[i]
  const last = i === lines.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['KeyE', 'Space', 'Enter'].includes(e.code)) {
        e.preventDefault()
        if (last) onClose()
        else setI((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onClose])

  return (
    <div className="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-box">
        <div className="dialog-face">🧝</div>
        <div className="dialog-body">
          <b className="dialog-name">AX 엘프</b>
          <p key={i} className="dialog-text">
            {line.text}
          </p>
          <div className="dialog-actions">
            {line.go && (
              <button className="primary" onClick={() => onGo(line.go!.to)}>
                {line.go.label}
              </button>
            )}
            <button className="ghost" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? '알겠어! 👋' : '다음 ▶'}
            </button>
          </div>
          <span className="dialog-progress">
            {i + 1}/{lines.length} · E 다음 · Esc 닫기
          </span>
        </div>
      </div>
    </div>
  )
}
