import { useCallback, useEffect, useState } from 'react'
import { api, type AdminAwards, type AdminStatus, type AdminTreasure, type AwardCardRow, type Phase } from '../api'
import { KEYWORDS } from '../awards'
import { tierOf } from '../treasure'
import { TreeShow } from './TreeShow'
import { RevealShow } from './RevealShow'
import { FIRST_DAY, QUESTIONS, QUESTIONS_LIMIT, QUESTION_MAX, cleanQuestions, questionDay } from '../questions'

const NEXT: Partial<Record<Phase, { to: Phase; label: string; confirm: string }>> = {
  READY: {
    to: 'ACTIVE',
    label: '산타 배정 시작 (Phase 1)',
    confirm: '지금 매칭을 만들고 시작할까요? 되돌릴 수 없어요.',
  },
  ACTIVE: { to: 'REVEAL', label: '공개일 시작 (Phase 2)', confirm: '관찰 리포트가 잠기고 공개일이 시작돼요. 되돌릴 수 없어요.' },
}

// A1 운영 대시보드 + A3 PIN 초기화. 매칭과 남의 내용은 보여주지 않는다 (블라인드 어드민)
export function Admin({ onPhaseChange, onQuestions }: { onPhaseChange: () => void; onQuestions: () => void }) {
  const [tab, setTab] = useState<'status' | 'questions' | 'awards' | 'treasure'>('status')
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
        <button className={tab === 'treasure' ? 'on' : ''} onClick={() => setTab('treasure')}>
          🎀 보물찾기
        </button>
      </div>
      {tab === 'status' && <Status onPhaseChange={onPhaseChange} />}
      {tab === 'questions' && <Questions onSaved={onQuestions} />}
      {tab === 'awards' && <AwardsAdmin />}
      {tab === 'treasure' && <TreasureAdmin />}
    </div>
  )
}

// 어워즈 진행: 사람마다 동료 몇 명을 인터뷰했는지만. 누가 누구에게 무슨 말을 했는지는 운영자도 못 본다.
// 상장: 공개일 전에 Claude Code 가 받은 사람별 답(누가 했는지는 빼고)으로 써서 넣고(scripts/awards.ts), 운영자가 여기서 읽고 고친다.
function AwardsAdmin() {
  const [data, setData] = useState<AdminAwards | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => api.adminAwards().then(setData, (e: Error) => setError(e.message)), [])
  useEffect(() => {
    void load()
  }, [load])

  if (!data) return <p className="muted">{error || '불러오는 중…'}</p>
  const done = data.players.filter((p) => p.given >= data.people).length
  const setCard = (row: AwardCardRow) => setData((d) => d && { ...d, cards: d.cards.map((c) => (c.id === row.id ? { ...c, ...row } : c)) })

  const made = data.cards.filter((c) => c.title).length
  const setNewcomer = async (id: number, newcomer: boolean) => {
    setError('')
    setData((d) => d && { ...d, players: d.players.map((p) => (p.id === id ? { ...p, newcomer } : p)) })
    try {
      await api.setNewcomer(id, newcomer)
    } catch (e) {
      setError((e as Error).message)
      void load()
    }
  }

  return (
    <div className="questions">
      <p className="muted">
        🧝 엘프가 동료 한 명씩 인터뷰하고, 답은 키워드와 한 줄 메모로 정리돼요. 누가 무슨 말을 했는지는 운영자도 볼 수 없어요. 지금{' '}
        <b>
          {done}/{data.players.length}명
        </b>
        이 모두를 인터뷰했어요.
      </p>
      <p className="muted small">
        🌱 <b>새로 온 사람</b>에 체크하면, 그 사람이 들어간 인터뷰(그 사람이 묻거나 그 사람에 대해 묻거나)는 &quot;함께한 순간&quot; 대신 <b>첫인상·앞으로 기대되는 점</b>을
        물어요. 아직 팀과 같이 일해 본 적 없는 분께 체크해 주세요.
      </p>
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>🌱 새로 온 사람</th>
            <th>인터뷰한 동료</th>
          </tr>
        </thead>
        <tbody>
          {data.players.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>
                <input type="checkbox" aria-label={`${p.name} 새로 온 사람`} checked={p.newcomer} onChange={(e) => setNewcomer(p.id, e.target.checked)} />
              </td>
              <td className={p.given >= data.people ? 'ok-text' : ''}>
                {p.given}/{data.people}명
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>🏆 상장 ({made}/{data.cards.length})</h3>
      <p className="muted small">
        인터뷰가 모이면 (12/15쯤) Claude Code 에 <b>"어워즈 상장 만들어줘"</b>라고 말해 주세요. 사람마다 받은 답을 모아(누가 했는지는 빼고) 상 이름과 상장 문구를 써서
        여기에 넣어 줘요. 읽어 보고 어색하면 ✏️ 고치면 돼요. 상장은 <b>공개일</b>에 모두에게 열려요. (상장이 없는 사람은 가장 많이 받은 키워드가 상이 돼요)
      </p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>상장</th>
          </tr>
        </thead>
        <tbody>
          {data.cards.map((c) => (
            <CardRow key={c.id} card={c} onSaved={setCard} />
          ))}
        </tbody>
      </table>
      <p className="muted small">
        키워드 칩 {KEYWORDS.length}개: {KEYWORDS.map((k) => k.chip).join(' · ')}
      </p>
    </div>
  )
}

function CardRow({ card, onSaved }: { card: AwardCardRow & { name: string }; onSaved: (row: AwardCardRow) => void }) {
  const [edit, setEdit] = useState(false)
  const [title, setTitle] = useState(card.title ?? '')
  const [citation, setCitation] = useState(card.citation ?? '')
  const [err, setErr] = useState('')
  const save = async () => {
    try {
      onSaved(await api.saveCard(card.id, title, citation))
      setEdit(false)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <tr>
      <td>{card.name}</td>
      <td>
        {edit ? (
          <div className="card-edit">
            <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="상 이름" />
            <textarea value={citation} maxLength={600} onChange={(e) => setCitation(e.target.value)} placeholder="상장 문구" />
            <div className="letter-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="primary small" type="button" onClick={() => void save()}>
                저장
              </button>
              <button className="ghost small" type="button" onClick={() => setEdit(false)}>
                취소
              </button>
              {err && <span className="error">{err}</span>}
            </div>
          </div>
        ) : card.title ? (
          <>
            <b>{card.title}</b>
            <p className="muted small" style={{ margin: '4px 0' }}>
              {card.citation}
            </p>
            <button
              className="ghost small"
              type="button"
              onClick={() => {
                setTitle(card.title ?? '')
                setCitation(card.citation ?? '')
                setEdit(true)
              }}
            >
              ✏️ 고치기
            </button>
          </>
        ) : (
          <>
            <span className="muted small">아직 없어요 </span>
            <button className="ghost small" type="button" onClick={() => setEdit(true)}>
              ✏️ 직접 쓰기
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

// 보물찾기 현황: 선물을 전달해야 하니 누가 어떤 선물을 찾았는지 보여 준다
function TreasureAdmin() {
  const [data, setData] = useState<AdminTreasure | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.adminTreasure().then(setData, (e: Error) => setError(e.message))
  }, [])
  if (!data) return <p className="muted">{error || '불러오는 중…'}</p>
  const found = data.boxes.filter((b) => b.finder).length
  const time = (at: string) => new Date(at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="questions">
      <p className="muted">
        진짜 선물 {data.boxes.length}개 중 <b>{found}개</b>를 찾았어요. 마을에는 꽝을 합쳐 {data.spots}곳이 숨어 있고, 지금까지 꽝을 {data.duds}번 열었어요.
        선물 상자는 <b>산타 배정 시작</b>과 함께 마을에 나타나고
        {data.phase === 'READY' ? ' (지금은 아직 숨겨져 있어요)' : ''}, 12/14부터는 남은 상자가 반짝이며 엘프가 위치 힌트를 줘요. 진짜 자리와 등수는{' '}
        <code>server/treasure.ts</code>, 등수별 선물 이름과 숨긴 위치는 <code>src/treasure.ts</code> 에서 바꿔요.
      </p>
      <table>
        <thead>
          <tr>
            <th>등수</th>
            <th>숨긴 곳</th>
            <th>선물</th>
            <th>찾은 사람</th>
          </tr>
        </thead>
        <tbody>
          {data.boxes.map((b) => (
            <tr key={b.id}>
              <td>{tierOf(b.tier).label}</td>
              <td>{b.place}</td>
              <td>{b.gift}</td>
              <td className={b.finder ? 'ok-text' : 'muted'}>{b.finder ? `${b.finder} · ${time(b.at!)}` : '아직'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        한 줄에 질문 하나씩 적어 주세요. <b>시작일</b>부터 <b>평일</b> 하루에 하나씩 위에서부터 차례로 나오고, 끝까지 가면 처음으로 돌아가요. 주말에는 금요일
        질문이 이어져요 (한국 시간 자정에 바뀜).
      </p>
      <div className="questions-body">
        <div>
          <label className="field">
            <span>첫 질문이 나오는 날</span>
            <input type="date" value={start} onChange={(e) => (setStart(e.target.value), setMsg(''))} />
          </label>
          <textarea rows={16} value={text} onChange={(e) => (setText(e.target.value), setMsg(''))} placeholder="올해 가장 자랑스러웠던 일은? 🏆" />
          <p className="muted small">
            {list.length}개 · 한 질문 {QUESTION_MAX}자, 최대 {QUESTIONS_LIMIT}개까지
          </p>
        </div>
        <div>
          <h3>📅 날짜별 미리보기</h3>
          <ol className="schedule">
            {list.map((q, i) => {
              const day = questionDay(start, i) // 평일만 (주말은 금요일 질문이 이어짐)
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
        <button
          className="ghost"
          onClick={() => {
            setText(QUESTIONS.join('\n'))
            setStart(FIRST_DAY)
            setMsg('기본 질문 12개(12/1 시작)를 불러왔어요. 저장을 눌러야 적용돼요')
          }}
        >
          🔄 기본 질문 불러오기
        </button>
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
  const [show, setShow] = useState(false)
  const [treeShow, setTreeShow] = useState(false)

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
      {next && (
        <button className="primary" onClick={advance}>
          {next.label}
        </button>
      )}
      {s.phase === 'REVEAL' && (
        <>
          <button className="primary" onClick={() => setShow(true)}>
            🎬 공개일 발표 화면 열기
          </button>
          <p className="muted small">회식·미팅 화면에 띄워 주세요. → / Space 로 넘기고 ← 로 돌아가요. 짝과 내용은 이 화면에서 처음 보여요.</p>
        </>
      )}
      <button className="ghost" onClick={() => setTreeShow(true)}>
        🎄 메시지 트리 돌아보기 화면 열기
      </button>
      <p className="muted small">공개일에 다같이 보는 화면이에요. 날짜마다 질문과 모두의 답, 마지막에 ❤️ 베스트 카드와 개근상이 나와요. 미리 열어 봐도 괜찮아요.</p>
      {show && (
        <RevealShow
          onClose={() => setShow(false)}
          onTree={() => {
            setShow(false)
            setTreeShow(true)
          }}
        />
      )}
      {treeShow && <TreeShow onClose={() => setTreeShow(false)} />}
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>PIN</th>
            <th>프로필</th>
            <th>상자 개봉</th>
            <th>관찰 리포트</th>
            <th>추리노트</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {s.players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.hasPin ? '✓' : '–'}</td>
              <td>{p.hasProfile ? '✓' : '–'}</td>
              <td>{p.opened ? '✓' : '–'}</td>
              <td>{{ none: '–', draft: '쓰는 중', submitted: '제출 ✓' }[p.letter]}</td>
              <td>{{ none: '–', draft: '쓰는 중', done: '완성 ✓' }[p.guess]}</td>
              <td>
                {p.hasPin && (
                  <button className="ghost small" onClick={() => reset(p.id, p.name)}>
                    PIN 초기화
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="error">{error}</p>}
      <DangerZone />
    </div>
  )
}

/** ⚠️ 전체 초기화: 행사 전에 테스트 흔적을 지울 때. 확인 문구를 직접 입력해야 눌린다 */
const RESET_CONFIRM = '전체 초기화'
function DangerZone() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await api.resetAll(text)
      window.location.reload() // 운영자도 로그아웃되므로 처음 화면으로
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="danger">
      {!open ? (
        <button className="ghost small" onClick={() => setOpen(true)}>
          ⚠️ 전체 초기화…
        </button>
      ) : (
        <>
          <b>⚠️ 전체 초기화 (되돌릴 수 없어요)</b>
          <p className="muted small">
            매칭, 관찰 리포트, 메시지 트리 답과 ❤️, 어워즈 투표, <b>모든 사람의 PIN·로그인·꾸미기·프로필</b>, 운영 화면에서 바꾼 질문·상 목록이 지워지고 단계가 READY
            로 돌아가요. 14명 명단만 남아요. 나도 로그아웃돼요.
          </p>
          <p className="small">
            계속하려면 <code>{RESET_CONFIRM}</code> 을 입력하세요.
          </p>
          <div className="danger-row">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={RESET_CONFIRM} />
            <button className="danger-btn" disabled={busy || text !== RESET_CONFIRM} onClick={run}>
              초기화
            </button>
            <button className="ghost small" onClick={() => (setOpen(false), setText(''))}>
              취소
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  )
}
