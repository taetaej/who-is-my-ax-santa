import { useEffect, useState } from 'react'
import { ApiError, api, type GuessState } from '../api'
import { CONFIDENCE_MIN, GUESS_LIMITS, confidenceLabel, guessDone, type Guess } from '../guess'

// 🔍 내 산타 추리노트 (src/guess.ts). 공개일 더블 리빌 2단계에서 "내 산타는 ○○! 확신도 95%"로 열린다.
// 공개일 전에는 나만 본다. 진행 기간 동안 몇 번이든 고칠 수 있다.

const TO_SANTA = ['덕분에 연말이 따뜻했어요. 정체 공개되면 커피 한 잔 살게요 ☕', '산타님, 혹시 엉뚱한 사람 지목했다면… 미리 죄송합니다 🙇', '몰래 챙겨 줘서 고마워요! 들킬 뻔한 거 다 알아요 👀']

export function GuessForm({ onSaved }: { onSaved: () => void }) {
  const [st, setSt] = useState<GuessState | null>(null)
  const [g, setG] = useState<Guess | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.guess().then(
      (s) => {
        setSt(s)
        setG(s.body)
      },
      (e: Error) => setError(e instanceof ApiError && e.status === 409 ? e.message : `불러오지 못했어요: ${e.message}`),
    )
  }, [])

  if (!st || !g) {
    return (
      <div className="panel center">
        <h2>🔍 내 산타 추리노트</h2>
        <p className="muted">{error || '불러오는 중…'}</p>
      </div>
    )
  }

  const set = (patch: Partial<Guess>) => {
    setG({ ...g, ...patch })
    setDirty(true)
    setNotice('')
  }
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const s = await api.saveGuess(g)
      setSt(s)
      setG(s.body)
      setDirty(false)
      setNotice(guessDone(s.body) ? '저장했어요! 공개일 전까지 언제든 고칠 수 있어요 🔍' : '저장했어요. 빈칸을 마저 채우면 완성이에요')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const locked = !!st.locked
  const suspect = st.people.find((p) => p.id === g.suspect)?.name
  const done = guessDone(g)
  return (
    <div className="panel letter guess">
      <div className="letter-head">
        <h2>🔍 내 산타 추리노트</h2>
        <span className={`chip ${done && !dirty ? 'ok' : st.updatedAt ? 'warn' : ''}`}>
          {done ? '완성' : st.updatedAt ? '쓰는 중' : '작성 전'}
          {dirty && ' · 저장 안 된 내용 있음'}
        </span>
      </div>
      <p className="muted">
        나를 몰래 챙기는 산타는 누구일까요? 공개일에 <b>산타의 관찰 리포트</b>를 다같이 읽은 뒤, 이 추리노트가 열리고 카드를 뒤집어 정답을 맞춰 봐요. 그 전까지는 나만
        볼 수 있어요 🤫
      </p>

      <fieldset className="letter-form" disabled={locked || busy}>
        <section>
          <h3>1. 🎯 내 산타는 바로…!</h3>
          <div className="kw-people">
            {st.people.map((p) => (
              <button key={p.id} type="button" className={`name ${p.id === g.suspect ? 'on' : ''}`} onClick={() => set({ suspect: p.id })}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="stat-row">
            <span className="muted small">확신도</span>
            <input
              type="range"
              min={CONFIDENCE_MIN}
              max={100}
              step={5}
              value={g.confidence}
              onChange={(e) => set({ confidence: Number(e.target.value) })}
            />
            <b>{g.confidence}%</b>
          </div>
          <p className="q-help">{confidenceLabel(g.confidence)}</p>
        </section>

        <section>
          <h3>2. 지목한 결정적 이유</h3>
          <p className="sentence">
            제가 <b>{suspect ?? '○○'}</b>님을 제 산타로 지목한 결정적 이유는{' '}
            <input className="wide" value={g.reason} maxLength={GUESS_LIMITS.reason} placeholder="내 간식 취향을 너무 잘 알아서" onChange={(e) => set({ reason: e.target.value })} />{' '}
            때문이에요!
          </p>
        </section>

        <section>
          <h3>
            3. 결정적 목격담 <span className="muted small">(선택)</span>
          </h3>
          <p className="q-help">산타가 챙겨 준 흔적 중 가장 의심스러웠던 순간</p>
          <input value={g.evidence} maxLength={GUESS_LIMITS.evidence} placeholder="자리 비운 사이 책상 위에 놓인 핫팩" onChange={(e) => set({ evidence: e.target.value })} />
        </section>

        <section>
          <h3>4. To. 내 산타</h3>
          <input value={g.toSanta} maxLength={GUESS_LIMITS.toSanta} placeholder="아직 정체를 모르는 산타에게 한마디" onChange={(e) => set({ toSanta: e.target.value })} />
          <div className="examples">
            {TO_SANTA.map((t) => (
              <button key={t} type="button" className="ghost small" onClick={() => set({ toSanta: t })}>
                {t}
              </button>
            ))}
          </div>
        </section>
      </fieldset>

      <div className="letter-actions">
        <span className="muted small">{st.updatedAt && `마지막 저장 ${new Date(st.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}</span>
        {locked ? (
          <span className="muted">공개일이 시작돼서 더 고칠 수 없어요</span>
        ) : (
          <button className="primary" disabled={busy || !dirty} onClick={save}>
            저장하기
          </button>
        )}
      </div>
      {notice && <p className="ok-text">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
