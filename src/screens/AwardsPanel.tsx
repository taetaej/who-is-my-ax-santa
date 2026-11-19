import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { api, type Awards } from '../api'
import { CHIPS_MAX, CUSTOM_MAX, KEYWORDS, isEmptyGift, type AwardCard, type Gift } from '../awards'

// 🏆 AX 어워즈: 동료 키워드 상.
// 공개일 전: 나를 뺀 동료마다 키워드 칩 1~3개 + 직접 쓰기 1개. 고르는 즉시 저장되고 언제든 바꿀 수 있다.
// 공개일: 내가 받은 상장(상 이름 + 받은 키워드 워드 클라우드)과 모두의 상.

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

function Give({ data, setData, onChange, reload }: { data: Awards; setData: (d: Awards) => void; onChange: () => void; reload: () => void }) {
  const firstTodo = data.people.find((p) => isEmptyGift(p.gift))?.id ?? data.people[0]?.id
  const [sel, setSel] = useState<number | undefined>(firstTodo)
  const [error, setError] = useState('')
  const person = data.people.find((p) => p.id === sel)
  const [custom, setCustom] = useState(person?.gift.custom ?? '')
  const given = data.people.filter((p) => !isEmptyGift(p.gift)).length
  const total = data.people.length

  const pick = (id: number) => {
    setSel(id)
    setCustom(data.people.find((p) => p.id === id)?.gift.custom ?? '')
  }

  const save = async (id: number, gift: Gift) => {
    setError('')
    setData({ ...data, people: data.people.map((p) => (p.id === id ? { ...p, gift } : p)) })
    try {
      await api.giveKeywords(id, gift)
      onChange()
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  if (!person) return <div className="panel center">함께할 동료가 아직 없어요</div>
  const { gift } = person
  const toggle = (chip: string) => {
    const chips = gift.chips.includes(chip) ? gift.chips.filter((c) => c !== chip) : [...gift.chips, chip]
    if (chips.length > CHIPS_MAX) return
    void save(person.id, { ...gift, chips })
  }
  const saveCustom = () => {
    const v = custom.replace(/\s+/g, ' ').trim()
    if (v !== (gift.custom ?? '')) void save(person.id, { ...gift, custom: v || null })
  }
  const idx = data.people.findIndex((p) => p.id === person.id)
  const next = () => {
    saveCustom()
    const after = [...data.people.slice(idx + 1), ...data.people.slice(0, idx)]
    pick((after.find((p) => isEmptyGift(p.gift)) ?? after[0]).id)
  }

  return (
    <div className="panel awards">
      <div className="letter-head">
        <h2>🏆 동료에게 키워드 주기</h2>
        <span className={`chip ${given === total ? 'ok' : 'warn'}`}>
          {given}/{total}명
        </span>
      </div>
      <p className="muted">
        동료마다 어울리는 키워드를 <b>1~{CHIPS_MAX}개</b> 골라 주세요. 가장 많이 받은 키워드가 그 사람의 상이 돼서, 모두가 상을 받아요. 결과는 공개일에 열리고,
        누가 어떤 키워드를 줬는지는 끝까지 비밀이에요 🤫
      </p>
      <div className="kw-people">
        {data.people.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`name ${p.id === person.id ? 'on' : ''} ${isEmptyGift(p.gift) ? '' : 'done'}`}
            onClick={() => (saveCustom(), pick(p.id))}
          >
            {isEmptyGift(p.gift) ? '' : '✓ '}
            {p.name}
          </button>
        ))}
      </div>
      <section className="kw-card">
        <h3>
          <b>{person.name}</b>님은 어떤 동료예요?{' '}
          <span className="muted small">
            {gift.chips.length}/{CHIPS_MAX}
          </span>
        </h3>
        <div className="kw-chips">
          {KEYWORDS.map((k) => {
            const on = gift.chips.includes(k.id)
            return (
              <button
                key={k.id}
                type="button"
                title={k.who}
                className={`kw-chip ${on ? 'on' : ''}`}
                disabled={!on && gift.chips.length >= CHIPS_MAX}
                onClick={() => toggle(k.id)}
              >
                {k.chip}
              </button>
            )
          })}
        </div>
        <label className="kw-custom">
          <span>✍️ 칩에 없는 말 (선택)</span>
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
          {given === total && <span className="ok-text">모두에게 키워드를 줬어요! 공개일을 기다려 주세요 🎄</span>}
          <button className="primary" type="button" onClick={next}>
            다음 사람 →
          </button>
        </div>
      </section>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function Results({ results, meId }: { results: NonNullable<Awards['results']>; meId: number }) {
  const mine = results.find((r) => r.id === meId)
  return (
    <div className="panel awards">
      <h2>🏆 2026 AX 어워즈</h2>
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

function Certificate({ name, card }: { name: string; card: AwardCard }) {
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
      <p className="muted small">동료 {card.givers}명이 준 키워드로 만든 상이에요</p>
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
