import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type Reveal, type RevealCard } from '../api'
import { confidenceLabel } from '../guess'
import { LetterCard } from './LetterForm'

// 🎬 공개일 더블 리빌 (PRD 5.6). 회식·팀 미팅 화면에 띄워 14명이 같이 본다. 운영자만 연다.
// 주인공 한 명마다 4단계:
//   0 소개 → 1 관찰 리포트 앞면 (산타 이름 없이, 다같이 추리) → 2 주인공의 추리노트 → 3 카드 뒤집기 (산타·선물 + 🎯/🕵️)
// 릴레이: 정체가 밝혀진 산타가 다음 주인공. 14명이 한 줄로 이어져 있어 한 바퀴 돌면 끝.
// → · Space · Enter 다음, ← 이전, Esc 닫기

type Step = 0 | 1 | 2 | 3
const STEPS: Step[] = [0, 1, 2, 3]
const STEP_NAME = ['주인공', '관찰 리포트', '추리노트', '정체 공개']

/** start 부터 "산타 → 다음 주인공" 으로 한 바퀴 */
export function relay(cards: RevealCard[], startTarget: number): RevealCard[] {
  const out: RevealCard[] = []
  let cur = cards.find((c) => c.target.id === startTarget)
  while (cur && !out.includes(cur)) {
    out.push(cur)
    const santa: number = cur.santa.id
    cur = cards.find((c) => c.target.id === santa)
  }
  // 혹시 여러 고리로 나뉘어 있으면 남은 사람도 뒤에 붙인다
  for (const c of cards) if (!out.includes(c)) out.push(c)
  return out
}

export const isHit = (c: RevealCard) => c.guess?.suspect === c.santa.id

export function RevealShow({ onClose, onTree }: { onClose: () => void; onTree?: () => void }) {
  const [data, setData] = useState<Reveal | null>(null)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<RevealCard[] | null>(null)
  const [i, setI] = useState(0)
  const [step, setStep] = useState<Step>(0)

  useEffect(() => {
    api.adminReveal().then(setData, (e: Error) => setError(e.message))
  }, [])

  const done = !!order && i >= order.length
  const next = useCallback(() => {
    if (!order || done) return
    if (step < 3) setStep((step + 1) as Step)
    else {
      setI(i + 1)
      setStep(0)
    }
  }, [order, done, step, i])
  const prev = useCallback(() => {
    if (!order) return
    if (done) {
      setI(order.length - 1)
      setStep(3)
    } else if (step > 0) setStep((step - 1) as Step)
    else if (i > 0) {
      setI(i - 1)
      setStep(3)
    }
  }, [order, done, step, i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  const start = (targetId: number) => {
    if (!data) return
    setOrder(relay(data.cards, targetId))
    setI(0)
    setStep(0)
  }

  let body
  if (!data) body = <p className="reveal-msg">{error || '불러오는 중…'}</p>
  else if (data.cards.length === 0) body = <p className="reveal-msg">짝이 없어요. 산타 배정을 먼저 시작해야 해요.</p>
  else if (!order) body = <Pick data={data} onStart={start} />
  else if (done) body = <Summary order={order} onTree={onTree} />
  else body = <Stage card={order[i]} step={step} n={i + 1} total={order.length} next={order[i + 1]} />

  return createPortal(
    <div className="reveal-stage">
      <header>
        <b>🎅 Who is my AX Santa?</b>
        {order && !done && (
          <span className="reveal-progress">
            {i + 1}/{order.length} · {STEPS.map((s) => (s === step ? `【${STEP_NAME[s]}】` : STEP_NAME[s])).join(' → ')}
          </span>
        )}
        <button className="ghost small" onClick={onClose}>
          닫기 (Esc)
        </button>
      </header>
      <main>{body}</main>
      {order && (
        <footer>
          <button className="ghost" onClick={prev} disabled={i === 0 && step === 0}>
            ← 이전
          </button>
          {!done && (
            <button className="primary big" onClick={next}>
              {step === 2 ? '🎁 카드 뒤집기' : step === 3 ? (i + 1 < order.length ? `다음 주인공: ${order[i].santa.name} →` : '🎉 마무리 →') : '다음 →'}
            </button>
          )}
        </footer>
      )}
    </div>,
    document.body,
  )
}

function Pick({ data, onStart }: { data: Reveal; onStart: (id: number) => void }) {
  const ids = data.cards.map((c) => c.target.id)
  return (
    <div className="reveal-center">
      <h1>🎬 공개일 더블 리빌</h1>
      <p className="reveal-lead">
        첫 주인공을 골라 주세요. 그 사람의 산타가 밝혀지면, 그 산타가 다음 주인공이 돼요.
        <br />
        14명이 한 줄로 이어져 있어서 한 바퀴 돌면 모두 공개돼요.
      </p>
      <div className="reveal-names">
        {data.people
          .filter((p) => ids.includes(p.id))
          .map((p) => (
            <button key={p.id} className="ghost" onClick={() => onStart(p.id)}>
              {p.name}
            </button>
          ))}
      </div>
      <button className="primary big" onClick={() => onStart(ids[Math.floor(Math.random() * ids.length)])}>
        🎲 아무나 먼저
      </button>
    </div>
  )
}

function Stage({ card, step, n, total, next }: { card: RevealCard; step: Step; n: number; total: number; next?: RevealCard }) {
  const { target, santa, letter, guess } = card
  if (step === 0) {
    return (
      <div className="reveal-center">
        <p className="reveal-kicker">
          {n}번째 주인공 {n === total && '(마지막!)'}
        </p>
        <h1 className="reveal-hero">{target.name}</h1>
        <p className="reveal-lead">{target.name}님을 몰래 챙긴 산타는 누구일까요? 🤫</p>
      </div>
    )
  }
  if (step === 1 || step === 3) {
    const side = step === 1 ? 'front' : 'back'
    return (
      <div className="reveal-card-row">
        {step === 3 && <Verdict card={card} />}
        <div className="reveal-card">
          {letter ? (
            <LetterCard l={letter} target={target.name} santa={santa.name} side={side} />
          ) : step === 1 ? (
            <div className="letter-card reveal-empty">
              <h4>{target.name}</h4>
              <p>🙈 관찰 리포트가 비어 있어요… 산타님, 정체 공개 뒤에 직접 말로 소개해 주세요!</p>
            </div>
          ) : (
            <div className="letter-card reveal-empty">
              <p className="muted">{target.name} 님의 산타는…</p>
              <h4 className="santa">🎅 {santa.name}</h4>
            </div>
          )}
        </div>
        {step === 1 && <p className="reveal-lead">🕵️ 힌트를 보고 다같이 산타를 추리해 봐요! 이름은 아직 비밀이에요.</p>}
        {step === 3 && card.photo && (
          <figure className="reveal-photo">
            <img src={card.photo} alt={`${santa.name}님이 마을에서 찍은 사진`} />
            <figcaption>📸 {santa.name} 산타가 마을에서 몰래 찍은 사진</figcaption>
          </figure>
        )}
        {step === 3 && next && next.target.id !== card.target.id && n < total && (
          <p className="reveal-lead small">이제 {santa.name}님이 다음 주인공이에요 →</p>
        )}
      </div>
    )
  }
  // step 2: 주인공의 추리노트
  return (
    <div className="reveal-center">
      <p className="reveal-kicker">🔍 {target.name}님의 추리노트</p>
      {guess ? (
        <>
          <h1 className="reveal-hero">
            내 산타는 <span className="reveal-accent">{guess.suspectName}</span>님!
          </h1>
          <p className="reveal-confidence">
            확신도 <b>{guess.confidence}%</b> · {confidenceLabel(guess.confidence)}
          </p>
          {guess.reason && (
            <p className="reveal-quote">
              "{guess.suspectName}님을 지목한 결정적 이유는 <b>{guess.reason}</b> 때문이에요!"
            </p>
          )}
          {guess.evidence && <p className="reveal-lead">👀 결정적 목격담: {guess.evidence}</p>}
          {guess.toSanta && <p className="reveal-lead">💌 To. 내 산타: {guess.toSanta}</p>}
          {card.suspectIsMyTarget && <p className="reveal-joke">😂 잠깐! {guess.suspectName}님은 {target.name}님이 몰래 챙기던 사람이에요!</p>}
        </>
      ) : (
        <>
          <h1 className="reveal-hero">🙈 추리노트가 비어 있어요</h1>
          <p className="reveal-lead">{target.name}님, 지금 바로 말로 지목해 주세요! 내 산타는…?</p>
        </>
      )}
    </div>
  )
}

function Verdict({ card }: { card: RevealCard }) {
  if (!card.guess) return <p className="reveal-badge">🎅 정체 공개!</p>
  return isHit(card) ? (
    <p className="reveal-badge hit">🎯 추리 성공! {card.target.name}님 명탐정 인정</p>
  ) : (
    <p className="reveal-badge miss">🕵️ 완전범죄 성공! {card.santa.name} 산타 승리</p>
  )
}

function Summary({ order, onTree }: { order: RevealCard[]; onTree?: () => void }) {
  const hits = useMemo(() => order.filter(isHit), [order])
  const perfect = useMemo(() => order.filter((c) => c.guess && !isHit(c)), [order])
  return (
    <div className="reveal-center">
      <h1>🎉 14명 모두 공개!</h1>
      <div className="reveal-summary">
        <section>
          <h3>🎯 명탐정 ({hits.length}명)</h3>
          <p>{hits.map((c) => c.target.name).join(' · ') || '아무도 못 맞혔어요 😆'}</p>
        </section>
        <section>
          <h3>🕵️ 완전범죄 산타 ({perfect.length}명)</h3>
          <p>{perfect.map((c) => c.santa.name).join(' · ') || '모두 들켰어요 😆'}</p>
        </section>
      </div>
      <ul className="reveal-pairs">
        {order.map((c) => (
          <li key={c.target.id}>
            🎅 {c.santa.name} → 🎁 {c.target.name}
            {c.letter?.gift && <span className="muted"> · {c.letter.gift}</span>}
          </li>
        ))}
      </ul>
      <p className="reveal-lead">🏆 이제 어워즈 상장을 열어 볼까요? 마을의 🏆 어워즈 부스에서 모두의 상을 볼 수 있어요.</p>
      {onTree && (
        <button className="primary big" onClick={onTree}>
          🎄 메시지 트리 돌아보기 →
        </button>
      )}
    </div>
  )
}
