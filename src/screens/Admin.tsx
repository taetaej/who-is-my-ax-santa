import { useCallback, useEffect, useState } from 'react'
import { api, type AdminStatus, type Phase } from '../api'
import { AWARDS_LIMIT, AWARD_MAX, cleanAwards } from '../awards'
import { QUESTIONS_LIMIT, QUESTION_MAX, addDays, cleanQuestions } from '../questions'

const NEXT: Partial<Record<Phase, { to: Phase; label: string; confirm: string }>> = {
  READY: {
    to: 'ACTIVE',
    label: '마니또 시작 (Phase 1)',
    confirm: '지금 매칭을 만들고 시작할까요? 되돌릴 수 없어요.',
  },
  ACTIVE: { to: 'REVEAL', label: '공개일 시작 (Phase 2)', confirm: '소개서가 잠기고 공개일이 시작돼요. 되돌릴 수 없어요.' },
}

// A1 운영 대시보드 + A3 PIN 초기화. 매칭과 남의 내용은 보여주지 않는다 (블라인드 어드민)
export function Admin({ onPhaseChange, onQuestions }: { onPhaseChange: () => void; onQuestions: () => void }) {
  const [tab, setTab] = useState<'status' | 'questions' | 'awards'>('status')
  return (
    <div className="panel wide">
      <div className="admin-tabs">
        <button className={tab === 'status' ? 'on' : ''} onClick={() => setTab('status')}>
          ⚙️ 진행 현황
        </button>
        <button className={tab === 'questions' ? 'on' : ''} onClick={() => setTab('questions')}>
          🎄 메시지 트리 질문
        </button>
        <button className={tab === 'awards' ? 'on' : ''} onClick={() => setTab('awards')}>
          🏆 어워즈
        </button>
      </div>
      {tab === 'status' && <Status onPhaseChange={onPhaseChange} />}
      {tab === 'questions' && <Questions onSaved={onQuestions} />}
      {tab === 'awards' && <AwardsAdmin />}
    </div>
  )
}

// 어워즈 상 목록. 결과는 운영자도 공개일 전엔 못 본다 (투표 진행 수만)
function AwardsAdmin() {
  const [text, setText] = useState<string | null>(null)
  const [stat, setStat] = useState({ done: 0, started: 0 })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminAwards().then(
      (r) => {
        setText(r.categories.join('\n'))
        setStat({ done: r.done, started: r.started })
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  if (text === null) return <p className="muted">{error || '불러오는 중…'}</p>
  const list = cleanAwards(text)

  const save = async () => {
    setError('')
    try {
      await api.saveAwards(list)
      setMsg('저장했어요 🏆')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="questions">
      <p className="muted">
        한 줄에 상 하나씩. 투표 결과는 <b>공개일</b>에 모두에게 열리고, 그 전에는 운영자도 볼 수 없어요. 지금 <b>{stat.done}명</b>이 모든 상에 투표했고,{' '}
        {stat.started}명이 투표를 시작했어요.
      </p>
      <textarea rows={10} value={text} onChange={(e) => (setText(e.target.value), setMsg(''))} />
      <p className="muted small">
        {list.length}개 · 상 이름 {AWARD_MAX}자, 최대 {AWARDS_LIMIT}개까지 · 이미 받은 표는 상 이름으로 묶여 있어서, 이름을 바꾸면 그 상의 표는 다시 받아야 해요
      </p>
      <div className="letter-actions">
        {msg && <span className="ok-text">{msg}</span>}
        <button className="primary" disabled={!list.length} onClick={save}>
          저장
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

// 메시지 트리 "오늘의 질문" 목록. 한 줄에 하나, 시작일부터 하루에 하나씩 차례로 나온다
function Questions({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [start, setStart] = useState('')
  const [today, setToday] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.questions().then(
      (r) => {
        setText(r.list.join('\n'))
        setStart(r.start)
        setToday(r.today)
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  if (text === null) return <p className="muted">{error || '불러오는 중…'}</p>
  const list = cleanQuestions(text)

  const save = async () => {
    setError('')
    try {
      await api.saveQuestions(list, start)
      setMsg('저장했어요. 메시지 트리에 바로 반영돼요 🎄')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="questions">
      <p className="muted">
        한 줄에 질문 하나씩 적어 주세요. <b>시작일</b>부터 하루에 하나씩 위에서부터 차례로 나오고, 끝까지 가면 처음으로 돌아가요 (한국 시간 자정에 바뀜).
      </p>
      <div className="questions-body">
        <div>
          <label className="field">
            <span>첫 질문이 나오는 날</span>
            <input type="date" value={start} onChange={(e) => (setStart(e.target.value), setMsg(''))} />
          </label>
          <textarea
            rows={16}
            value={text}
            onChange={(e) => (setText(e.target.value), setMsg(''))}
            placeholder="올해 가장 자랑스러웠던 일은? 🏆"
          />
          <p className="muted small">
            {list.length}개 · 한 질문 {QUESTION_MAX}자, 최대 {QUESTIONS_LIMIT}개까지
          </p>
        </div>
        <div>
          <h3>📅 날짜별 미리보기</h3>
          <ol className="schedule">
            {list.map((q, i) => {
              const day = addDays(start, i)
              return (
                <li key={i} className={day === today ? 'today' : day < today ? 'past' : ''}>
                  <span>{day.slice(5).replace('-', '/')}</span>
                  {q}
                  {day === today && <b> ← 오늘</b>}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
      <div className="letter-actions">
        {msg && <span className="ok-text">{msg}</span>}
        <button className="primary" disabled={!list.length || !start} onClick={save}>
          저장
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function Status({ onPhaseChange }: { onPhaseChange: () => void }) {
  const [s, setS] = useState<AdminStatus | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => api.adminStatus().then(setS, (e: Error) => setError(e.message)), [])
  useEffect(() => {
    void load()
  }, [load])

  if (!s) return <p className="muted">{error || '불러오는 중…'}</p>
  const next = NEXT[s.phase]

  const advance = async () => {
    if (!next || !confirm(next.confirm)) return
    try {
      await api.setPhase(next.to)
      await load()
      onPhaseChange()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const reset = async (id: number, name: string) => {
    if (!confirm(`${name} 님의 PIN 을 초기화할까요?`)) return
    await api.resetPin(id).catch((e: Error) => setError(e.message))
    await load()
  }

  return (
    <div>
      <p>
        현재 단계 <b>{s.phase}</b> · 매칭 {s.matched ? '완료' : '전'}
      </p>
      {next && <button className="primary" onClick={advance}>{next.label}</button>}
      <table>
        <thead>
          <tr><th>이름</th><th>PIN</th><th>프로필</th><th>상자 개봉</th><th>소개서</th><th /></tr>
        </thead>
        <tbody>
          {s.players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.hasPin ? '✓' : '–'}</td>
              <td>{p.hasProfile ? '✓' : '–'}</td>
              <td>{p.opened ? '✓' : '–'}</td>
              <td>{{ none: '–', draft: '쓰는 중', submitted: '제출 ✓' }[p.letter]}</td>
              <td>{p.hasPin && <button className="ghost small" onClick={() => reset(p.id, p.name)}>PIN 초기화</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
