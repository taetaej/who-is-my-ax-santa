import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type TreeRecap } from '../api'
import { dayLabel } from './Calendar'

// 🎄 메시지 트리 돌아보기. 공개일에 발표 화면에 띄워 다같이 본다 (운영자만 연다).
// 표지 → 날짜마다 질문 + 모두의 답 (❤️ 많은 순, 1등은 왕관) → 마무리 (❤️ TOP 5 · 개근상)
// → · Space · Enter 다음, ← 이전, Esc 닫기

type Msg = TreeRecap['days'][number]['messages'][number]

export function recapStats(r: TreeRecap) {
  const all = r.days.flatMap((d) => d.messages.map((m) => ({ ...m, day: d.day, question: d.question })))
  const top = [...all].filter((m) => m.hearts > 0).sort((a, b) => b.hearts - a.hearts || a.day.localeCompare(b.day)).slice(0, 5)
  const count = new Map<string, number>()
  for (const d of r.days) for (const name of new Set(d.messages.map((m) => m.name))) count.set(name, (count.get(name) ?? 0) + 1)
  const perfect = r.days.length ? [...count].filter(([, n]) => n === r.days.length).map(([name]) => name).sort() : []
  return { cards: all.length, writers: count.size, hearts: all.reduce((s, m) => s + m.hearts, 0), top, perfect }
}

const byHearts = (ms: Msg[]) => [...ms].sort((a, b) => b.hearts - a.hearts)

export function TreeShow({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<TreeRecap | null>(null)
  const [error, setError] = useState('')
  const [i, setI] = useState(0)

  useEffect(() => {
    api.adminTreeRecap().then(setData, (e: Error) => setError(e.message))
  }, [])

  const last = data ? data.days.length + 1 : 0 // 0 표지, 1..n 날짜, n+1 마무리
  const next = useCallback(() => setI((v) => Math.min(v + 1, last)), [last])
  const prev = useCallback(() => setI((v) => Math.max(v - 1, 0)), [])
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

  let body
  if (!data) body = <p className="reveal-msg">{error || '불러오는 중…'}</p>
  else if (data.days.length === 0) body = <p className="reveal-msg">아직 메시지 트리에 걸린 카드가 없어요 🎄</p>
  else if (i === 0) {
    const s = recapStats(data)
    body = (
      <div className="reveal-center">
        <p className="reveal-kicker">2026 AX 메시지 트리</p>
        <h1 className="reveal-hero">🎄 {data.days.length}일간의 이야기</h1>
        <p className="reveal-lead">
          {s.writers}명이 카드 <b>{s.cards}장</b>을 걸고, ❤️ <b>{s.hearts}개</b>를 주고받았어요
        </p>
        <p className="reveal-lead small">하루씩 다시 펼쳐 볼까요? →</p>
      </div>
    )
  } else if (i <= data.days.length) {
    const d = data.days[i - 1]
    const ms = byHearts(d.messages)
    const best = ms[0]?.hearts ? ms[0].hearts : -1
    body = (
      <div className="tree-show">
        <p className="reveal-kicker">
          {dayLabel(d.day)} · {i}일차 · 카드 {ms.length}장
        </p>
        <h1 className="tree-show-q">{d.question}</h1>
        <div className={`tree-show-cards ${ms.length > 8 ? 'many' : ''}`}>
          {ms.map((m, k) => (
            <div key={k} className={`tree-show-card tone-${k % 5} ${m.hearts === best ? 'best' : ''}`}>
              {m.hearts === best && <span className="crown">👑</span>}
              <p>{m.body}</p>
              <span className="by">
                {m.name}
                {m.hearts > 0 && <b> ❤️ {m.hearts}</b>}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  } else {
    const s = recapStats(data)
    body = (
      <div className="reveal-center tree-show-end">
        <h1>❤️ 가장 많은 마음을 받은 카드</h1>
        {s.top.length === 0 && <p className="reveal-lead">아직 ❤️ 를 받은 카드가 없어요 😆</p>}
        <ol className="tree-show-top">
          {s.top.map((m, k) => (
            <li key={k}>
              <span className="muted small">
                {dayLabel(m.day)} · {m.question}
              </span>
              <p>"{m.body}"</p>
              <b>
                {m.name} · ❤️ {m.hearts}
              </b>
            </li>
          ))}
        </ol>
        {s.perfect.length > 0 && (
          <p className="reveal-lead">
            🏅 {data.days.length}일 개근상: <b>{s.perfect.join(' · ')}</b>
          </p>
        )}
        <p className="reveal-lead small">함께 써 준 모두 고마워요. 2027년에도 같이 가보자고!! 🚀</p>
      </div>
    )
  }

  return createPortal(
    <div className="reveal-stage">
      <header>
        <b>🎄 메시지 트리 돌아보기</b>
        {data && data.days.length > 0 && (
          <span className="reveal-progress">
            {i}/{last}
          </span>
        )}
        <button className="ghost small" onClick={onClose}>
          닫기 (Esc)
        </button>
      </header>
      <main>{body}</main>
      {data && data.days.length > 0 && (
        <footer>
          <button className="ghost" onClick={prev} disabled={i === 0}>
            ← 이전
          </button>
          {i < last && (
            <button className="primary big" onClick={next}>
              {i === 0 ? '🎄 펼쳐 보기' : i === last - 1 ? '❤️ 베스트 카드 →' : '다음 날 →'}
            </button>
          )}
        </footer>
      )}
    </div>,
    document.body,
  )
}
