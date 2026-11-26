import { useEffect, useState } from 'react'
import { api, type RankRow } from '../api'
import { CookieFace } from './CookieFace'

// 🏆 산타 랭킹: 산타 행성 레벨(XP) 순서. 1~3위는 시상대, 나머지는 줄로.
// XP 는 놀이(눈싸움·썰매·눈굴리기)와 산타 활동(관찰 리포트·추리노트·메시지 트리·어워즈·숨은 선물)으로 쌓인다.

const PODIUM = [1, 0, 2] // 화면 순서: 2위 · 1위 · 3위

export function Ranking() {
  const [list, setList] = useState<RankRow[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.ranking().then(
      (r) => setList(r.list),
      (e: Error) => setError(e.message),
    )
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!list) return <div className="panel">불러오는 중…</div>
  const top = list.slice(0, 3)
  const rest = list.slice(3)
  const mine = list.find((r) => r.me)

  return (
    <div className="panel ranking">
      <h2>산타 랭킹</h2>
      <p className="muted rank-sub">⭐ 산타 행성 레벨 순 · 놀이와 산타 활동으로 XP가 쌓여요</p>
      <div className="podium">
        {PODIUM.map((i) => {
          const r = top[i]
          if (!r) return <div key={i} />
          return (
            <div key={r.id} className={`podium-card p${r.rank} ${r.me ? 'me' : ''}`}>
              <span className="crown">
                <b>{r.rank}</b>
              </span>
              <div className="podium-face">
                <CookieFace look={r.look} size={r.rank === 1 ? 84 : 70} />
              </div>
              <div className="podium-info">
                <strong>{r.name}</strong>
                <em>{r.xp.toLocaleString()} XP</em>
                <span className="lv-pill">Lv.{r.lv}</span>
              </div>
            </div>
          )
        })}
      </div>
      <ol className="rank-list">
        {rest.map((r) => (
          <li key={r.id} className={r.me ? 'me' : ''}>
            <span className="rank-no">
              <b>{r.rank}</b>
              <small>Lv.{r.lv}</small>
            </span>
            <span className="rank-face">
              <CookieFace look={r.look} size={44} />
            </span>
            <span className="rank-name">
              {r.name}
              {r.me && <i> 나</i>}
            </span>
            <span className="rank-xp">{r.xp.toLocaleString()} XP</span>
          </li>
        ))}
      </ol>
      {mine && <p className="rank-mine">나는 지금 {mine.rank}위 · Lv.{mine.lv} · 다음 레벨까지 {mine.need - mine.cur} XP</p>}
    </div>
  )
}
