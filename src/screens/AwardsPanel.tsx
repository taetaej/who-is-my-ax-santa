import { useCallback, useEffect, useState } from 'react'
import { api, type Awards } from '../api'

// 🏆 AX 어워즈 투표소. 상마다 한 명씩 고른다 (나는 못 고름). 공개일 전까지는 언제든 바꿀 수 있고,
// 결과는 공개일에 마니또 공개와 함께 열린다.

export function AwardsPanel({ meId, onChange }: { meId: number; onChange: () => void }) {
  const [data, setData] = useState<Awards | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(() => api.awards().then(setData, (e: Error) => setError(e.message)), [])
  useEffect(() => {
    void load()
  }, [load])

  if (!data) return <div className="panel center">{error || '불러오는 중…'}</div>

  const name = (id: number) => data.players.find((p) => p.id === id)?.name ?? '?'
  const voted = data.categories.filter((c) => c.myVote !== null).length
  const total = data.categories.length

  const vote = async (category: string, nomineeId: number | null) => {
    setSaving(category)
    setError('')
    setData({ ...data, categories: data.categories.map((c) => (c.name === category ? { ...c, myVote: nomineeId } : c)) })
    try {
      await api.vote(category, nomineeId)
      onChange()
    } catch (e) {
      setError((e as Error).message)
      void load()
    } finally {
      setSaving(null)
    }
  }

  if (data.results) {
    return (
      <div className="panel awards">
        <h2>🏆 2026 AX 어워즈 결과</h2>
        <p className="muted">모두의 표로 뽑힌 올해의 주인공들이에요 🎉</p>
        <div className="award-results">
          {data.results.map((r) => (
            <article key={r.category} className="award-result">
              <span className="award-name">{r.category}</span>
              <b>{r.winners.length ? r.winners.map(name).join(' · ') : '표가 없었어요'}</b>
              {r.votes > 0 && <span className="muted small">{r.votes}표</span>}
            </article>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="panel awards">
      <div className="letter-head">
        <h2>🏆 2026 AX 어워즈 투표</h2>
        <span className={`chip ${voted === total ? 'ok' : 'warn'}`}>
          {voted}/{total} 투표
        </span>
      </div>
      <p className="muted">상마다 딱 한 명! 공개일 전까지는 몇 번이든 바꿀 수 있고, 결과는 공개일에 마니또 공개와 함께 발표돼요. 누가 누구를 뽑았는지는 아무도 몰라요 🤫</p>
      <div className="award-list">
        {data.categories.map((c) => (
          <label key={c.name} className={`award-row ${c.myVote ? 'done' : ''}`}>
            <span className="award-name">{c.name}</span>
            <select value={c.myVote ?? ''} disabled={saving === c.name} onChange={(e) => vote(c.name, e.target.value ? Number(e.target.value) : null)}>
              <option value="">누구일까? 🤔</option>
              {data.players
                .filter((p) => p.id !== meId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>
      {voted === total && <p className="ok-text">모든 상에 투표했어요! 공개일을 기다려 주세요 🎄</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
