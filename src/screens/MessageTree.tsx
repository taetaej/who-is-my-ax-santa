import { useCallback, useEffect, useState } from 'react'
import { api, type TreeDay } from '../api'

// 🎄 메시지 트리. 매일 바뀌는 질문에 한 줄씩 답을 걸고, 서로의 답에 ❤️ 를 누른다.
// 오늘 답은 언제든 고칠 수 있고, 지난 날짜는 읽기만 한다.

const MAX = 140
const CARD_TONES = ['red', 'gold', 'green', 'cream', 'blue']

const dayLabel = (day: string, today: string) => {
  if (day === today) return '오늘'
  const d = new Date(`${day}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

export function MessageTree({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<TreeDay | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (day?: string) => {
    try {
      const d = await api.tree(day)
      setData(d)
      setDraft(d.day === d.today ? (d.messages.find((m) => m.mine)?.body ?? '') : '')
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!data) return <div className="panel center">{error || '불러오는 중…'}</div>

  const isToday = data.day === data.today
  const mine = data.messages.find((m) => m.mine)
  const idx = data.days.indexOf(data.day)
  const older = data.days[idx + 1]
  const newer = idx > 0 ? data.days[idx - 1] : undefined

  const post = async (text: string) => {
    setBusy(true)
    try {
      await api.postTree(text)
      await load()
      onChange()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const heart = async (id: number) => {
    // 먼저 화면을 바꾸고, 서버 결과로 맞춘다
    setData({ ...data, messages: data.messages.map((m) => (m.id === id ? { ...m, liked: !m.liked, hearts: m.hearts + (m.liked ? -1 : 1) } : m)) })
    try {
      await api.heart(id)
    } catch {
      void load(data.day)
    }
  }

  return (
    <div className="panel tree">
      <div className="tree-head">
        <button className="ghost small" disabled={!older} onClick={() => older && load(older)} aria-label="이전 날">
          ‹
        </button>
        <span className="tree-day">{dayLabel(data.day, data.today)}</span>
        <button className="ghost small" disabled={!newer} onClick={() => newer && load(newer)} aria-label="다음 날">
          ›
        </button>
      </div>
      <h2 className="tree-q">
        <span>🎄 오늘의 질문</span>
        {data.question}
      </h2>

      {isToday && (
        <form
          className="tree-write"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) void post(draft)
          }}
        >
          <input value={draft} maxLength={MAX} placeholder="한 줄로 답을 걸어 주세요" onChange={(e) => setDraft(e.target.value)} />
          <button className="primary" disabled={busy || !draft.trim() || draft.trim() === mine?.body}>
            {mine ? '고치기' : '트리에 걸기 🎄'}
          </button>
          {mine && (
            <button type="button" className="ghost small" disabled={busy} onClick={() => post('')}>
              떼기
            </button>
          )}
        </form>
      )}
      {isToday && <p className="muted small">하루에 한 장, 이름과 함께 걸려요. 내일이 되면 새 질문이 열려요.</p>}

      {!isToday && data.messages.length > 0 && <Digest key={data.day} day={data.day} />}

      {data.messages.length === 0 ? (
        <p className="tree-empty">{isToday ? '아직 아무도 안 걸었어요. 첫 오너먼트를 걸어 보세요! ✨' : '이날은 걸린 답이 없어요'}</p>
      ) : (
        <div className="tree-cards">
          {data.messages.map((m, i) => (
            <article key={m.id} className={`tree-card ${CARD_TONES[i % CARD_TONES.length]} ${m.mine ? 'mine' : ''}`}>
              <p>{m.body}</p>
              <footer>
                <span>— {m.name}</span>
                <button className={`heart ${m.liked ? 'on' : ''}`} onClick={() => heart(m.id)} disabled={m.mine} title={m.mine ? '내 답이에요' : '좋아요'}>
                  {m.liked ? '❤️' : '🤍'} {m.hearts || ''}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** 🤖 지난 날의 엘프 정리. 처음 여는 사람 화면에서 쓰이는 동안은 "정리하는 중", 누가 쓰는 중이면 잠깐 뒤 다시 본다 */
function Digest({ day }: { day: string }) {
  const [state, setState] = useState<{ summary: string; keywords: string[] } | 'loading' | null>('loading')
  useEffect(() => {
    let alive = true
    let timer = 0
    const get = async (tries: number) => {
      try {
        const r = await api.treeDigest(day)
        if (!alive) return
        if (r.digest) setState(r.digest)
        else if (r.pending && tries < 6) timer = window.setTimeout(() => void get(tries + 1), 4000)
        else setState(null)
      } catch {
        if (alive) setState(null)
      }
    }
    void get(0)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [day])
  if (state === null) return null
  return (
    <aside className="tree-digest">
      <b>🧝 엘프의 하루 정리</b>
      {state === 'loading' ? (
        <p className="iv-typing">
          <i />
          <i />
          <i />
        </p>
      ) : (
        <>
          <p>{state.summary}</p>
          {state.keywords.length > 0 && (
            <div className="tags">
              {state.keywords.map((k) => (
                <span key={k}>#{k}</span>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
