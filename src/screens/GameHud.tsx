import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { AMMO_MAX, HP_MAX, XP_GAIN, XP_LABEL, type XpKind } from '../gameRules'
import { game, xpStore } from '../scene/game'
import { POWER_INFO, buff, buffOn, nowSec } from '../scene/powerups'
import { DOUGHS, EXTRAS, HATS, OUTFITS, unlocksAt } from '../look'

/** 이 레벨에 열리는 꾸미기 이름들 */
const unlockNames = (lv: number) =>
  unlocksAt(lv).map((k) => {
    const [kind, key] = k.split(':')
    const label = kind === 'hat' ? HATS[key as keyof typeof HATS] : kind === 'extra' ? EXTRAS[key as keyof typeof EXTRAS] : kind === 'outfit' ? OUTFITS[key as keyof typeof OUTFITS] : DOUGHS[key as keyof typeof DOUGHS]?.label
    return typeof label === 'string' ? label : key
  })
import { snow } from '../scene/snowball'

// 🎮 놀이 화면: ⭐ 레벨·XP 바 (오른쪽 위), ❤️ 체력·⚪ 눈덩이·💪 모으기 (눈싸움할 때), 😵 기절 화면, ⛄ 눈굴리기 시계, 레벨업 축하

type View = {
  hp: number
  ammo: number
  charge: number
  zone: boolean
  ko: number
  koSecs: number
  koBy: string
  roll: { left: number; cm: number } | null
  mash: { power: number; left: number; taps: number } | null
  buff: { icon: string; name: string; left: number; shots: number } | null
}

const read = (): View => ({
  hp: Math.round(game.hp),
  ammo: game.ammo,
  charge: game.charge,
  zone: game.inThrowZone,
  ko: game.koUntil > 0 ? Math.max(0, Math.ceil(game.koUntil - game.now)) : 0,
  koSecs: game.koSecs,
  koBy: game.koBy,
  roll: game.roll ? { left: Math.ceil(game.roll.left), cm: game.roll.cm } : null,
  mash: game.sledCharge ? { ...game.sledCharge } : null,
  buff:
    buff.kind && buffOn(buff.kind)
      ? { icon: POWER_INFO[buff.kind].icon, name: POWER_INFO[buff.kind].name, left: Math.ceil(buff.until - nowSec()), shots: buff.shots }
      : null,
})

export function GameHud({ show }: { show: boolean }) {
  const [v, setV] = useState<View>(read)
  const [xp, setXp] = useState(xpStore.board)
  const [gains, setGains] = useState<{ id: number; text: string }[]>([])
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const gid = useRef(0)
  // ⚔️ 눈싸움 소식판: 기절·연속 KO·아이템 (5초 뒤 사라짐, 최대 4줄)
  const [feed, setFeed] = useState<{ id: number; text: string }[]>([])
  useEffect(() => {
    snow.feed = (text) => {
      const id = ++gid.current
      setFeed((f) => [...f.slice(-3), { id, text }])
      setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 5000)
    }
    return () => {
      snow.feed = null
    }
  }, [])

  // 놀이 상태는 10번/초로 읽는다 (3D 장면이 매 프레임 바꾼다)
  useEffect(() => {
    const t = setInterval(() => setV(read()), 50)
    return () => clearInterval(t)
  }, [])

  // ⭐ XP: 처음에 불러오고, 1분마다 다시 (리포트·트리·선물 찾기로 저절로 쌓이는 XP 반영). 놀이로 얻으면 바로 올린다
  useEffect(() => {
    let alive = true
    const apply = (b: Awaited<ReturnType<typeof api.xp>>) => {
      if (!alive) return
      const before = xpStore.board?.mine?.lv
      xpStore.set(b)
      setXp(b)
      const now = b.mine?.lv
      if (before && now && now > before) {
        setLevelUp(now)
        setTimeout(() => alive && setLevelUp(null), 4200)
      }
    }
    const load = () => void api.xp().then(apply).catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    game.gainXp = (kind: XpKind) => {
      const id = ++gid.current
      setGains((g) => [...g.slice(-3), { id, text: `+${XP_GAIN[kind]} XP · ${XP_LABEL[kind]}` }])
      setTimeout(() => alive && setGains((g) => g.filter((x) => x.id !== id)), 1800)
      void api
        .gainXp(kind)
        .then((b) => {
          apply(b)
          if (b.capped) setGains((g) => [...g, { id: ++gid.current, text: `오늘 ${XP_LABEL[kind]} XP는 다 모았어요` }])
        })
        .catch(() => {})
    }
    return () => {
      alive = false
      clearInterval(t)
      game.gainXp = null
    }
  }, [])

  const me = xp?.mine
  const combat = v.zone || v.hp < HP_MAX || v.charge >= 0
  return (
    <>
      {me && (
        <div className="xp-hud" title="놀이·관찰 리포트·추리노트·메시지 트리·어워즈·숨은 선물로 XP가 쌓여요">
          <b>⭐ Lv.{me.lv}</b>
          <span className="xp-bar">
            <i style={{ width: `${(me.cur / me.need) * 100}%` }} />
          </span>
          <span className="xp-num">
            {me.cur}/{me.need}
          </span>
          {me.rank && <span className="xp-rank">{me.rank}위</span>}
          <div className="xp-gains">
            {gains.map((g) => (
              <span key={g.id}>{g.text}</span>
            ))}
          </div>
        </div>
      )}
      {show && combat && !v.ko && (
        <div className="combat-hud">
          <span className="hp">
            ❤️
            <span className="hp-bar">
              <i style={{ width: `${v.hp}%`, background: v.hp > 50 ? '#4fd17a' : v.hp > 25 ? '#ffc24a' : '#ff5a4a' }} />
            </span>
            {v.hp}
          </span>
          {v.zone && (
            <span className="ammo" title="눈덩이 (눈밭 안에서 저절로 다시 뭉쳐져요)">
              {Array.from({ length: AMMO_MAX }, (_, i) => (i < v.ammo ? '⚪' : '◌')).join('')}
            </span>
          )}
          {v.buff && (
            <span className="buff">
              {v.buff.icon} {v.buff.name} {v.buff.shots > 0 ? `×${v.buff.shots}` : `${v.buff.left}초`}
            </span>
          )}
          {v.charge >= 0 && (
            <span className="charge">
              💪
              <span className="charge-bar">
                <i style={{ width: `${v.charge * 100}%` }} />
              </span>
            </span>
          )}
        </div>
      )}
      {show && feed.length > 0 && (
        <div className="kill-feed" role="status">
          {feed.map((f) => (
            <span key={f.id}>{f.text}</span>
          ))}
        </div>
      )}
      {show && v.roll && (
        <div className="combat-hud roll-hud">
          ⛄ <b>{v.roll.left}초</b> · 지름 <b>{v.roll.cm}cm</b>
        </div>
      )}
      {show && v.mash && (
        <div className={`mash${v.mash.power >= 1 ? ' max' : ''}`} key={v.mash.taps}>
          <div className="mash-count">{v.mash.left > 0.05 ? Math.ceil(v.mash.left) : '출발!'}</div>
          <div className="mash-title">{v.mash.power >= 1 ? '🚀 풀파워!!' : 'SPACE 연타!! 💪'}</div>
          <div className="mash-bar">
            <i style={{ width: `${v.mash.power * 100}%` }} />
          </div>
          <div className="mash-taps">{v.mash.taps}번</div>
        </div>
      )}
      {v.ko > 0 && (
        <div className="ko-screen">
          <div className="ko-card">
            <div className="ko-face">😵</div>
            <b>기절했어요!</b>
            <p>{v.koBy ? `${v.koBy}님의 눈덩이에 맞았어요.` : ''} {v.ko}초 뒤에 일어나요</p>
            <p className="muted">{v.koSecs >= 60 ? '10분 안에 또 기절해서 1분이에요 😭' : '10분 안에 또 기절하면 1분 누워 있어야 해요'} · 옆에서 동료가 E를 연타하면 바로 일어나요</p>
          </div>
        </div>
      )}
      {levelUp && (
        <div className="level-up" role="status">
          <span>LEVEL UP!</span>
          <b>⭐ Lv.{levelUp}</b>
          {unlockNames(levelUp).length > 0 && <em>🔓 새 꾸미기: {unlockNames(levelUp).join(', ')} · 🎨 꾸미기에서 입어 보세요</em>}
        </div>
      )}
    </>
  )
}
