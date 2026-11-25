import { useState } from 'react'
import { api, type Me } from '../api'
import { isEmptyProfile } from '../profile'
import { addDays, daysBetween } from '../questions'
import {
  AWARDS_DUE,
  EVENTS,
  MATCH_DAY,
  MISSIONS,
  OPEN_DAY,
  OPENING_TO,
  PROFILE_DUE,
  REVEAL_DAY,
  WRITE_FROM,
  eventsOn,
  missionOn,
  missionOpen,
  treeOn,
  type Mission,
} from '../schedule'
import { XP_EVENT } from '../gameRules'

// 📅 이벤트 캘린더 (src/schedule.ts): 위에는 오늘 할 일 체크리스트, 아래는 12월 3주 달력. 날짜를 누르면 그날 일정이 펼쳐진다.
// 산타 미션은 여기서 ✅ 체크한다 (나만 본다).

export type CalGo = 'look' | 'profile' | 'tree' | 'manito' | 'letter' | 'guess' | 'awards'

const WEEK = ['월', '화', '수', '목', '금', '토', '일']
const GRID_FROM = '2026-11-30' // 월요일부터 3주
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const dow = (d: string) => WEEK[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]
export const dayLabel = (d: string) => `${md(d)}(${dow(d)})`
const range = (from: string, to: string) => (from === to ? dayLabel(from) : `${dayLabel(from)} ~ ${dayLabel(to)}`)

type Todo = { key: string; emoji: string; text: string; done: boolean; note?: string; go?: { to: CalGo; label: string }; mission?: Mission }

/** 오늘 내가 할 일 (날짜 + 내 상태로) */
export function todosFor(me: Me, day: string): Todo[] {
  if (day < OPEN_DAY || day >= REVEAL_DAY) return []
  const list: Todo[] = []
  const profileDone = !!me.profile && !isEmptyProfile(me.profile)
  if (day <= OPENING_TO || !me.look) list.push({ key: 'look', emoji: '🎨', text: '입장하고 쿠키 꾸미기', done: !!me.look, go: { to: 'look', label: '꾸미기' } })
  if (day <= OPENING_TO || !profileDone)
    list.push({
      key: 'profile',
      emoji: '📝',
      text: '자기소개(내 프로필) 쓰기',
      note: day <= PROFILE_DUE ? `${md(PROFILE_DUE)}까지` : '늦었지만 지금이라도!',
      done: profileDone,
      go: { to: 'profile', label: '쓰기' },
    })
  if (treeOn(day)) list.push({ key: 'tree', emoji: '🎄', text: '오늘의 메시지 트리', done: me.todo.tree, go: { to: 'tree', label: '쓰기' } })
  if (me.phase === 'ACTIVE') {
    if (!me.manitoOpened) list.push({ key: 'manito', emoji: '🎅', text: '내가 챙길 사람 확인하기', done: false, go: { to: 'manito', label: '확인' } })
    for (const m of MISSIONS) {
      if (!missionOpen(m, day)) continue
      const now = m.from <= day && day <= m.to
      const done = me.missions.includes(m.id)
      if (!now && done) continue // 지난 미션은 안 한 것만 남긴다
      list.push({ key: m.id, emoji: m.emoji, text: `산타 미션 ${'①②③④'[m.n - 1]} ${m.title}`, note: now ? `~${md(m.to)}` : '지난 미션', done, mission: m })
    }
    if (day >= WRITE_FROM) {
      list.push({ key: 'letter', emoji: '🕵️', text: '관찰 리포트 제출', note: `${md(addDays(REVEAL_DAY, -1))}까지`, done: me.letter === 'submitted', go: { to: 'letter', label: '쓰기' } })
      list.push({ key: 'guess', emoji: '🔍', text: '추리노트 완성', note: `${md(addDays(REVEAL_DAY, -1))}까지`, done: me.guess === 'done', go: { to: 'guess', label: '쓰기' } })
    }
  }
  if (day <= AWARDS_DUE && me.todo.given < me.todo.people)
    list.push({ key: 'awards', emoji: '🏆', text: `어워즈 인터뷰 ${me.todo.given}/${me.todo.people}`, note: `${md(AWARDS_DUE)}까지`, done: false, go: { to: 'awards', label: '하기' } })
  return list
}

/** 화면 왼쪽 위 상태 카드: 작은 머리말(kicker) + 지금 가장 중요한 일 (이모지 없이) */
export function headline(me: Me): { kicker: string; text: string; done: boolean } {
  const day = me.today
  if (day < OPEN_DAY) return { kicker: `D-${daysBetween(day, OPEN_DAY)}`, text: `${dayLabel(OPEN_DAY)} 마을 오픈`, done: false }
  if (day >= REVEAL_DAY) return { kicker: '공개일', text: '산타 정체 공개!', done: true }
  const m = missionOn(day)
  if (me.phase === 'ACTIVE' && m) return { kicker: `산타 미션 ${'①②③④'[m.n - 1]}`, text: m.title, done: me.missions.includes(m.id) }
  if (day >= WRITE_FROM) return { kicker: '마감 주간', text: '관찰 리포트 · 추리노트', done: me.letter === 'submitted' && me.guess === 'done' }
  if (day < MATCH_DAY) {
    const todos = todosFor(me, day)
    const left = todos.filter((t) => !t.done).length
    return { kicker: '오프닝 주간', text: left ? `오늘 할 일 ${left}개` : `산타 발표 ${md(MATCH_DAY)}`, done: !left }
  }
  return { kicker: '산타 주간', text: me.phase === 'READY' ? '곧 산타 발표!' : '오늘의 미션 확인', done: false }
}

const KIND_CLASS = { open: 'k-open', all: 'k-all', santa: 'k-santa', mission: 'k-mission', due: 'k-due', reveal: 'k-reveal' } as const

export function Calendar({ me, onGo, onChange }: { me: Me; onGo: (to: CalGo) => void; onChange: () => void }) {
  const today = me.today
  const [sel, setSel] = useState(today >= OPEN_DAY && today <= REVEAL_DAY ? today : OPEN_DAY)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const todos = todosFor(me, today)

  const check = async (m: Mission, done: boolean) => {
    setBusy(true)
    setNotice('')
    try {
      await api.checkMission(m.id, done)
      setNotice(done ? `${m.emoji} 미션 완료! +${XP_EVENT.mission} XP 🎉 (체크는 나만 봐요)` : '체크를 풀었어요')
      onChange()
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const missionBtn = (m: Mission) => {
    const done = me.missions.includes(m.id)
    const open = me.phase === 'ACTIVE' && missionOpen(m, today)
    if (!open) return <span className="muted small">{today < m.from ? `${md(m.from)}부터` : me.phase === 'READY' ? '산타 발표 뒤에' : ''}</span>
    return (
      <button className={`cal-check ${done ? 'on' : ''}`} disabled={busy} onClick={() => check(m, !done)}>
        {done ? '✅ 완료' : '했어요 ✔'}
      </button>
    )
  }

  const days = Array.from({ length: 21 }, (_, i) => addDays(GRID_FROM, i))
  const dday = daysBetween(today, REVEAL_DAY)

  return (
    <div className="panel wide calendar">
      <h2>AX 산타 일정</h2>
      <p className="muted">
        {dayLabel(OPEN_DAY)} 오픈 · {dayLabel(MATCH_DAY)} 산타 발표 · {dayLabel(REVEAL_DAY)} 공개일
        {dday > 0 && <b className="cal-dday"> 공개일까지 D-{dday}</b>}
      </p>

      {todos.length > 0 && (
        <section className="cal-today">
          <h3>오늘 할 일 · {dayLabel(today)}</h3>
          <ul>
            {todos.map((t) => (
              <li key={t.key} className={t.done ? 'done' : ''}>
                <span className="cal-emoji">{t.emoji}</span>
                <span className="cal-text">
                  {t.text}
                  {t.note && <span className="muted small"> · {t.note}</span>}
                </span>
                {t.mission ? (
                  missionBtn(t.mission)
                ) : t.done ? (
                  <span className="ok-text">완료 ✓</span>
                ) : (
                  t.go && (
                    <button className="ghost" onClick={() => onGo(t.go!.to)}>
                      {t.go.label} →
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
          {notice && <p className="hint">{notice}</p>}
        </section>
      )}

      <div className="cal-grid">
        {WEEK.map((w, i) => (
          <div key={w} className={`cal-head ${i >= 5 ? 'weekend' : ''}`}>
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const evs = eventsOn(d).filter((e) => e.from === d || e.kind === 'mission')
          const period = d === REVEAL_DAY ? 'p-reveal' : d >= MATCH_DAY && d < REVEAL_DAY ? 'p-santa' : d >= OPEN_DAY && d <= OPENING_TO ? 'p-open' : ''
          return (
            <button
              key={d}
              className={`cal-day ${period} ${i % 7 >= 5 ? 'weekend' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''} ${d.slice(5, 7) !== '12' ? 'other' : ''}`}
              onClick={() => setSel(d)}
            >
              <span className="cal-num">{md(d).split('/')[1]}</span>
              <span className="cal-evs">
                {evs.map((e) => (
                  <span key={e.title} title={e.title}>
                    {e.emoji}
                  </span>
                ))}
                {treeOn(d) && <i className="cal-tree" title="메시지 트리" />}
              </span>
            </button>
          )
        })}
      </div>
      <p className="cal-legend muted small">
        <span className="lg p-open" /> 오프닝 <span className="lg p-santa" /> 산타 주간 <span className="lg p-reveal" /> 공개일 <i className="cal-tree" /> 메시지 트리 (평일 매일)
      </p>

      <section className="cal-detail">
        <h3>
          {dayLabel(sel)}
          {sel === today && ' · 오늘'}
        </h3>
        {eventsOn(sel).length === 0 && !treeOn(sel) && <p className="muted">이날은 쉬어 가요 ☕ 마을에서 썰매 한 판?</p>}
        <ul>
          {treeOn(sel) && (
            <li className="cal-ev k-all">
              <span className="cal-emoji">🎄</span>
              <span className="cal-text">
                <b>메시지 트리</b>
                <span className="muted small">오늘의 질문에 한 장 (+{XP_EVENT.treeDay} XP)</span>
              </span>
            </li>
          )}
          {eventsOn(sel).map((e) => {
            const m = e.mission ? MISSIONS.find((x) => x.id === e.mission)! : null
            return (
              <li key={e.title} className={`cal-ev ${KIND_CLASS[e.kind]}`}>
                <span className="cal-emoji">{e.emoji}</span>
                <span className="cal-text">
                  <b>{e.title}</b>
                  <span className="muted small">
                    {range(e.from, e.to)} · {e.desc}
                  </span>
                  {m && <span className="hint small">💡 {m.tip}</span>}
                </span>
                {m && missionBtn(m)}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="cal-all">
        <h3>전체 일정</h3>
        <ul>
          {EVENTS.map((e) => (
            <li key={e.title} className={`${KIND_CLASS[e.kind]} ${e.to < today ? 'past' : ''}`} onClick={() => setSel(e.from)}>
              <span className="cal-when">{range(e.from, e.to)}</span>
              <span>
                {e.emoji} {e.title}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
