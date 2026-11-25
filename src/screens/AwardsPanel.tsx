import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { api, type Awards } from '../api'
import { CHIPS_MAX, CUSTOM_MAX, KEYWORDS, isEmptyGift, type AwardCard, type Gift } from '../awards'
import { ANSWER_MAX, INTERVIEW_MAX, questions, type QA } from '../interview'

// 🏆 AX 어워즈: 🧝 엘프 인터뷰로 만드는 상장.
// 공개일 전: 동료 한 명씩 엘프가 고정 질문 3개를 묻는다. 끝나면 키워드 칩(선택)을 고른다. 언제든 다시 인터뷰할 수 있다.
// 공개일: 운영자가 답을 모아 미리 만든 상장(상 이름 + 문구)과 받은 키워드 워드 클라우드. 상장이 없으면 키워드 1등이 상.

export function AwardsPanel({ meId, onChange }: { meId: number; onChange: () => void }) {
  const [data, setData] = useState<Awards | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => api.awards().then(setData, (e: Error) => setError(e.message)), [])
  useEffect(() => {
    void load()
  }, [load])

  if (!data) return <div className="panel center">{error || '불러오는 중…'}</div>
  if (data.results) return <Results results={data.results} meId={meId} />
  return <Give data={data} setData={setData} onChange={onChange} reload={load} />
}

type Person = Awards['people'][number]
const interviewed = (p: Person) => p.chat !== null || !isEmptyGift(p.gift)

function Give({ data, setData, onChange, reload }: { data: Awards; setData: (d: Awards) => void; onChange: () => void; reload: () => void }) {
  const firstTodo = data.people.find((p) => !interviewed(p))?.id ?? data.people[0]?.id
  const [sel, setSel] = useState<number | undefined>(firstTodo)
  const [error, setError] = useState('')
  const person = data.people.find((p) => p.id === sel)
  const given = data.people.filter(interviewed).length
  const total = data.people.length

  const update = (id: number, patch: Partial<Person>) => setData({ ...data, people: data.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  const save = async (id: number, gift: Gift) => {
    setError('')
    update(id, { gift })
    try {
      await api.giveKeywords(id, gift)
      onChange()
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  if (!person) return <div className="panel center">함께할 동료가 아직 없어요</div>
  const idx = data.people.findIndex((p) => p.id === person.id)
  const next = () => {
    const after = [...data.people.slice(idx + 1), ...data.people.slice(0, idx)]
    setSel((after.find((p) => !interviewed(p)) ?? after[0]).id)
  }

  return (
    <div className="panel awards">
      <div className="letter-head">
        <h2>AX 어워즈 · 엘프 인터뷰</h2>
        <span className={`chip ${given === total ? 'ok' : 'warn'}`}>
          {given}/{total}명
        </span>
      </div>
      <p className="muted">
        🧝 엘프가 동료 한 명씩 짧게 물어봐요 (질문 {INTERVIEW_MAX}개, 1분). 모두의 답을 모아 공개일에 <b>그 사람만의 상장</b>을 만들어요. 누가 무슨 말을 했는지는 끝까지 비밀이에요 🤫
      </p>
      <div className="kw-people">
        {data.people.map((p) => (
          <button key={p.id} type="button" className={`name ${p.id === person.id ? 'on' : ''} ${interviewed(p) ? 'done' : ''}`} onClick={() => setSel(p.id)}>
            {interviewed(p) ? '✓ ' : ''}
            {p.name}
          </button>
        ))}
      </div>
      <Interview
        key={person.id}
        person={person}
        onDone={(gift, chat) => {
          update(person.id, { gift, chat })
          onChange()
        }}
        onChips={(gift) => void save(person.id, gift)}
        onNext={next}
        allDone={given === total}
      />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** 한 사람 인터뷰: 엘프 질문 → 내 답 → (AI 꼬리 질문) … → 엘프가 정리한 키워드 */
function Interview({
  person,
  onDone,
  onChips,
  onNext,
  allDone,
}: {
  person: Person
  onDone: (gift: Gift, chat: QA[]) => void
  onChips: (gift: Gift) => void
  onNext: () => void
  allDone: boolean
}) {
  const [mode, setMode] = useState<'chat' | 'done'>(interviewed(person) ? 'done' : 'chat')
  const [chat, setChat] = useState<QA[]>([])
  const [question, setQuestion] = useState(() => questions(person.name, person.fresh)[0])
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [custom, setCustom] = useState(person.gift.custom ?? '')
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [chat, busy])

  const send = async (finish = false) => {
    const a = answer.replace(/\s+/g, ' ').trim()
    const list = a ? [...chat, { q: question, a }] : chat
    if (!list.length || busy) return
    setChat(list)
    setAnswer('')
    setBusy(true)
    setError('')
    try {
      const r = await api.interview(person.id, list, finish)
      if (r.done) {
        onDone(r.gift, r.chat)
        setCustom(r.gift.custom ?? '')
        setMode('done')
      } else setQuestion(r.question)
    } catch (e) {
      setError((e as Error).message)
      if (a) {
        setChat(chat)
        setAnswer(a)
      }
    } finally {
      setBusy(false)
    }
  }
  const restart = () => {
    setChat([])
    setQuestion(questions(person.name, person.fresh)[0])
    setMode('chat')
  }

  if (mode === 'done') {
    const { gift } = person
    const toggle = (chip: string) => {
      const chips = gift.chips.includes(chip) ? gift.chips.filter((c) => c !== chip) : [...gift.chips, chip]
      if (chips.length <= CHIPS_MAX) onChips({ ...gift, chips })
    }
    const saveCustom = () => {
      const v = custom.replace(/\s+/g, ' ').trim()
      if (v !== (gift.custom ?? '')) onChips({ ...gift, custom: v || null })
    }
    return (
      <section className="kw-card">
        <h3>
          🧝 <b>{person.name}</b>님 인터뷰 정리
        </h3>
        {person.chat && person.chat.length > 0 && (
          <ul className="iv-mine">
            {person.chat.map((x, i) => (
              <li key={i}>{x.a}</li>
            ))}
          </ul>
        )}
        <p className="muted small">
          {person.chat ? '고마워요! 엘프가 잘 전해 둘게요 🎁 어울리는 키워드도 골라 주면 공개일 워드 클라우드에 들어가요' : '어울리는 키워드를 1~3개 골라 주세요'} ({gift.chips.length}/{CHIPS_MAX})
        </p>
        <div className="kw-chips">
          {KEYWORDS.map((k) => {
            const on = gift.chips.includes(k.id)
            return (
              <button key={k.id} type="button" title={k.who} className={`kw-chip ${on ? 'on' : ''}`} disabled={!on && gift.chips.length >= CHIPS_MAX} onClick={() => toggle(k.id)}>
                {k.chip}
              </button>
            )
          })}
        </div>
        <label className="kw-custom">
          <span>✍️ {person.name}님만의 키워드</span>
          <input
            maxLength={CUSTOM_MAX}
            placeholder="예: 엑셀 마법사"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={saveCustom}
            onKeyDown={(e) => e.key === 'Enter' && saveCustom()}
          />
        </label>
        <div className="letter-actions">
          <button className="ghost small" type="button" onClick={restart}>
            🎤 다시 인터뷰
          </button>
          {allDone && <span className="ok-text">모두 인터뷰했어요! 공개일을 기다려 주세요 🎄</span>}
          <button className="primary" type="button" onClick={() => (saveCustom(), onNext())}>
            다음 사람 →
          </button>
        </div>
      </section>
    )
  }

  const left = INTERVIEW_MAX - chat.length
  return (
    <section className="kw-card iv">
      <div className="iv-chat">
        {chat.map((x, i) => (
          <div key={i} className="iv-pair">
            <p className="iv-q">🧝 {x.q}</p>
            <p className="iv-a">{x.a}</p>
          </div>
        ))}
        {busy ? <p className="iv-q iv-typing">🧝 <i /><i /><i /></p> : <p className="iv-q">🧝 {question}</p>}
        <div ref={bottom} />
      </div>
      <textarea
        className="iv-input"
        rows={2}
        maxLength={ANSWER_MAX}
        placeholder={left === INTERVIEW_MAX ? '떠오르는 대로 편하게 적어 주세요 (Enter 로 보내기)' : '답하기 (Enter 로 보내기)'}
        value={answer}
        disabled={busy}
        autoFocus
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            void send()
          }
        }}
      />
      <div className="letter-actions">
        <span className="muted small">
          질문 {Math.min(chat.length + 1, INTERVIEW_MAX)}/{INTERVIEW_MAX}
        </span>
        {chat.length === 0 ? (
          <button className="ghost small" type="button" onClick={() => setMode('done')}>
            인터뷰 없이 키워드만 고를래요
          </button>
        ) : (
          <button className="ghost small" type="button" disabled={busy} onClick={() => void send(true)}>
            여기까지만 할게요
          </button>
        )}
        <button className="primary" type="button" disabled={busy || !answer.trim()} onClick={() => void send()}>
          보내기
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function Results({ results, meId }: { results: NonNullable<Awards['results']>; meId: number }) {
  const mine = results.find((r) => r.id === meId)
  return (
    <div className="panel awards">
      <h2>2026 AX 어워즈</h2>
      {mine && <Certificate name={mine.name} card={mine} />}
      <h3 className="kw-all-title">모두의 상 🎉</h3>
      <div className="award-results">
        {results
          .filter((r) => r.id !== meId)
          .map((r) => (
            <article key={r.id} className="award-result">
              <b>{r.name}</b>
              {r.titles.map((t) => (
                <span key={t} className="award-name">
                  {t}
                </span>
              ))}
              {r.citation && <p className="award-cite">{r.citation}</p>}
              <span className="muted small">
                {r.words
                  .slice(0, 5)
                  .map((w) => w.label)
                  .join(' · ')}
              </span>
            </article>
          ))}
      </div>
    </div>
  )
}

function Certificate({ name, card }: { name: string; card: AwardCard & { citation: string | null } }) {
  const max = Math.max(1, ...card.words.map((w) => w.n))
  return (
    <section className="certificate">
      <span className="cert-kicker">상장</span>
      <h3>{name}</h3>
      {card.titles.map((t) => (
        <p key={t} className="cert-title">
          {t}
        </p>
      ))}
      {card.titles.length > 1 && <span className="chip ok">2관왕</span>}
      {card.citation && <p className="cert-citation">{card.citation}</p>}
      <p className="muted small">동료 {card.givers}명의 이야기로 만든 상이에요</p>
      {card.words.length > 0 && (
        <div className="cloud">
          {card.words.map((w) => (
            <span key={w.label} style={{ '--s': 0.85 + (w.n / max) * 1.15 } as CSSProperties}>
              {w.label}
              {w.n > 1 && <sup>{w.n}</sup>}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
