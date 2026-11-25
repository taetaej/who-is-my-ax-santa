import { useEffect, useState } from 'react'
import { ApiError, api, type Letter, type LetterState, type Stat } from '../api'
import { PeekButton, mask, usePeek } from './SecretName'

// H5 마니또 소개서 (PRD 5.5). 왼쪽은 문항, 오른쪽은 공개일에 띄워질 카드 미리보기.
// 카드 앞면은 산타 이름 없이 낭독되고, 정체 공개 때 뒤집으면 산타 이름과 선물이 나온다.

const LIMIT = { keyword: 20, first: 40, now: 40, statLabel: 20, genre: 40, bgm: 80, bgmReason: 200, tmi: 120, gift: 60, hint: 120 }
const KW_PH = ['프로집중러', '아아수혈중', '리액션장인']
const STAT_PH = ['업무 몰입도', '점심 메뉴 결정력', '퇴근 준비 속도']
const STAT_CHIPS = ['업무 몰입도', '카페인 의존도', '칼퇴 본능', '리액션 온도', '간식 레이더', '점심 메뉴 결정력']
const GENRES = ['치밀한 두뇌 오피스물', '잔잔한 일상 힐링물', '유쾌한 코미디 시트콤', '반전 있는 미스터리', '청춘 성장 드라마']
const HINTS = ['저는 이분보다 출근 시간이 빠릅니다.', '최근 이분과 점심을 같이 먹은 적이 있습니다.', '저는 이분과 같은 층에 앉아 있습니다.']

export function LetterForm({ meName, onSaved }: { meName: string; onSaved: () => void }) {
  const [st, setSt] = useState<LetterState | null>(null)
  const peek = usePeek() // 🤫 챙길 사람 이름은 꾹 누를 때만
  const [l, setL] = useState<Letter | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.letter().then(
      (s) => {
        setSt(s)
        setL(s.body)
      },
      (e: Error) => setError(e instanceof ApiError && e.status === 409 ? e.message : `불러오지 못했어요: ${e.message}`),
    )
  }, [])

  if (!st || !l) {
    return (
      <div className="panel center">
        <h2>산타의 관찰 리포트</h2>
        <p className="muted">{error || '불러오는 중…'}</p>
      </div>
    )
  }

  const locked = !!st.locked
  const submitted = !!st.submittedAt
  const set = (patch: Partial<Letter>) => {
    setL({ ...l, ...patch })
    setDirty(true)
    setNotice('')
  }
  const setKw = (i: number, v: string) => {
    const k = [...l.keywords] as Letter['keywords']
    k[i] = v.replace(/^#+/, '')
    set({ keywords: k })
  }
  const setStat = (i: number, patch: Partial<Stat>) => {
    const s = l.stats.map((x, j) => (j === i ? { ...x, ...patch } : x)) as Letter['stats']
    set({ stats: s })
  }

  const save = async (submit: boolean) => {
    setBusy(true)
    setError('')
    try {
      const s = await api.saveLetter(l, submit)
      setSt(s)
      setL(s.body)
      setDirty(false)
      setNotice(submit && !submitted ? '제출했어요! 공개일 전까지는 계속 고칠 수 있어요 🎄' : '저장했어요')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const time = st.updatedAt ? new Date(st.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="panel letter">
      <div className="letter-head">
        <h2>산타의 관찰 리포트</h2>
        <span className={`chip ${submitted ? 'ok' : dirty ? 'warn' : ''}`}>
          {submitted ? '제출 완료' : st.updatedAt ? '임시저장' : '작성 전'}
          {dirty && ' · 저장 안 된 내용 있음'}
        </span>
      </div>
      {st.target && (
        <p className="letter-to">
          To. <b className="secret">{peek.peek ? st.target : mask(st.target)}</b> 님 <PeekButton {...peek} />
          <span className="muted small"> 옆자리에서 보일까 봐 이름은 가려 뒀어요 🤫</span>
        </p>
      )}
      <p className="muted">
        공개일에 <b>쓴 사람 이름 없이</b> 카드 앞면이 펼쳐지고, 다같이 산타가 누군지 추리해요. 카드를 뒤집으면 산타 이름과 선물이 공개돼요 🤫
      </p>

      <div className="letter-body">
        <fieldset className="letter-form" disabled={locked || busy}>
          <section>
            <h3>1. 해시태그 3개</h3>
            <p className="q-help">이분을 가장 잘 설명하는 키워드</p>
            <div className="kws">
              {l.keywords.map((k, i) => (
                <label key={i} className="kw">
                  #
                  <input value={k} maxLength={LIMIT.keyword} placeholder={KW_PH[i]} onChange={(e) => setKw(i, e.target.value)} />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3>2. 첫인상 vs 몰래 지켜본 현인상</h3>
            <p className="sentence">
              처음엔 <input value={l.first} maxLength={LIMIT.first} placeholder="차가운" onChange={(e) => set({ first: e.target.value })} />한 분인 줄
              알았는데, 산타가 되어 몰래 관찰해 보니 의외로{' '}
              <input value={l.now} maxLength={LIMIT.now} placeholder="다정한" onChange={(e) => set({ now: e.target.value })} />한 면이 있었습니다.
            </p>
          </section>

          <section>
            <h3>3. 산타가 스캔한 캐릭터 스탯</h3>
            <p className="q-help">관찰 결과로 산타가 임의로 매겨 본 능력치 3가지</p>
            {l.stats.map((s, i) => (
              <div key={i} className="stat-row">
                <input value={s.label} maxLength={LIMIT.statLabel} placeholder={STAT_PH[i]} onChange={(e) => setStat(i, { label: e.target.value })} />
                <input type="range" min={0} max={100} value={s.value} onChange={(e) => setStat(i, { value: Number(e.target.value) })} />
                <b>{s.value}%</b>
              </div>
            ))}
            <div className="examples">
              {STAT_CHIPS.map((c) => {
                const used = l.stats.some((s) => s.label === c)
                const empty = l.stats.findIndex((s) => !s.label)
                return (
                  <button key={c} type="button" className="ghost small" disabled={used || empty < 0} onClick={() => setStat(empty, { label: c })}>
                    {c}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3>4. 이 사람이 드라마·영화 주인공이라면?</h3>
            <input value={l.genre} maxLength={LIMIT.genre} placeholder="장르 (예: 잔잔한 일상 힐링물)" list="genres" onChange={(e) => set({ genre: e.target.value })} />
            <datalist id="genres">
              {GENRES.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <input className="gap" value={l.bgm} maxLength={LIMIT.bgm} placeholder="🎵 테마 BGM (가수 - 노래 제목)" onChange={(e) => set({ bgm: e.target.value })} />
            <input className="gap" value={l.bgmReason} maxLength={LIMIT.bgmReason} placeholder="이 노래가 떠오르는 이유 (선택)" onChange={(e) => set({ bgmReason: e.target.value })} />
          </section>

          <section>
            <h3>5. 산타의 비밀 관찰 TMI & 맞춤 선물</h3>
            <p className="sentence">
              몰래 관찰해 보니{' '}
              <input className="wide" value={l.tmi} maxLength={LIMIT.tmi} placeholder="책상에 늘 귤을 두는" onChange={(e) => set({ tmi: e.target.value })} />
              모습이 눈에 띄더라고요. 그래서 이 선물을 준비했어요!
            </p>
            <input value={l.gift} maxLength={LIMIT.gift} placeholder="🎁 준비한 선물 (카드를 뒤집을 때 공개돼요)" onChange={(e) => set({ gift: e.target.value })} />
            <p className="hint">💡 선물 예산은 2만 원 이하예요</p>
          </section>

          <section>
            <h3>6. 산타의 은밀한 정체 힌트 한 줄</h3>
            <p className="q-help">정체 공개 직전, 다같이 추리해 볼 단서</p>
            <input value={l.hint} maxLength={LIMIT.hint} placeholder={HINTS[0]} onChange={(e) => set({ hint: e.target.value })} />
            <div className="examples">
              {HINTS.map((h) => (
                <button key={h} type="button" className="ghost small" onClick={() => set({ hint: h })}>
                  {h}
                </button>
              ))}
            </div>
          </section>
        </fieldset>

        <LetterCard l={l} target={st.target && (peek.peek ? st.target : mask(st.target))} santa={meName} />
      </div>

      <div className="letter-actions">
        <span className="muted small">{time && `마지막 저장 ${time}`}</span>
        {locked ? (
          <span className="muted">공개일이 시작돼서 더 고칠 수 없어요</span>
        ) : submitted ? (
          <button className="primary" disabled={busy || !dirty} onClick={() => save(false)}>
            고친 내용 저장
          </button>
        ) : (
          <>
            <button className="ghost" disabled={busy || !dirty} onClick={() => save(false)}>
              임시저장
            </button>
            <button className="primary" disabled={busy} onClick={() => save(true)}>
              제출하기
            </button>
          </>
        )}
      </div>
      {notice && <p className="ok-text">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** 공개일에 펼쳐질 카드 미리보기. 앞면(낭독) ↔ 뒷면(정체 공개) */
export function LetterCard({ l, target, santa, side }: { l: Letter; target: string | null; santa: string; side?: 'front' | 'back' }) {
  const [backSel, setBack] = useState(false)
  const back = side ? side === 'back' : backSel
  const blank = (v: string, ph = '______') => (v ? <b>{v}</b> : <span className="blank">{ph}</span>)
  return (
    <div className="card-wrap">
      {!side && (
        <div className="card-toggle">
        <button className={back ? 'ghost small' : 'ghost small on'} onClick={() => setBack(false)}>
          앞면 · 낭독
        </button>
        <button className={back ? 'ghost small on' : 'ghost small'} onClick={() => setBack(true)}>
          뒷면 · 정체 공개
        </button>
        </div>
      )}
      <div className={`flip ${back ? 'flipped' : ''}`}>
        <article className="letter-card front">
          <div className="card-top">
            <span>🎄 산타의 관찰 리포트</span>
            <span className="muted small">from. ??? 🎅</span>
          </div>
          <h4>{target ?? '???'}</h4>
          <div className="card-kws">
            {l.keywords.map((k, i) => (
              <span key={i} className={k ? '' : 'blank'}>
                #{k || '키워드'}
              </span>
            ))}
          </div>
          <p className="quote">
            처음엔 {blank(l.first)}한 분인 줄 알았는데, 관찰해 보니 의외로 {blank(l.now)}한 면이 있었습니다.
          </p>
          <h5>📊 캐릭터 스탯</h5>
          <div className="stats">
            {l.stats.map((s, i) => (
              <div key={i} className="stat">
                <span className={s.label ? '' : 'blank'}>{s.label || '능력치'}</span>
                <div className="bar">
                  <i style={{ width: `${s.value}%` }} />
                </div>
                <b>{s.value}%</b>
              </div>
            ))}
          </div>
          <h5>🎬 주인공이라면</h5>
          <p>
            {blank(l.genre, '장르')} <span className="muted small">·</span> 🎵 {blank(l.bgm, 'BGM')}
            {l.bgmReason && <span className="pre reason">{l.bgmReason}</span>}
          </p>
          <h5>🔍 비밀 관찰 TMI</h5>
          <p>
            몰래 관찰해 보니 {blank(l.tmi)} 모습이 눈에 띄더라고요. 그래서 이 선물을 준비했어요! 🎁 <span className="blank">(뒷면에서 공개)</span>
          </p>
          <div className="hint-box">
            <span>🕵️ 산타의 정체 힌트</span>
            <p>{l.hint || <span className="blank">"저는 …"</span>}</p>
          </div>
        </article>
        <article className="letter-card back">
          <div className="card-top">
            <span>🎉 정체 공개</span>
          </div>
          <p className="muted">{target ?? '???'} 님의 산타는…</p>
          <h4 className="santa">🎅 {santa}</h4>
          <h5>🎁 준비한 선물</h5>
          <p className="gift">{blank(l.gift, '선물 이름')}</p>
        </article>
      </div>
    </div>
  )
}
