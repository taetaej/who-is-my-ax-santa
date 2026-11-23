import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { labelHue, mmss, onAir, songsFrom, type Song } from '../carol'
import { music } from '../scene/music'

// 📻 AX 캐롤 라디오 (🔥 불멍 회의실). 무대 근처에 오면 소리가 나고, 가까울수록 크다.
// - 곡은 src/carols/ 폴더의 음원 파일. 라디오처럼 모두 같은 곡의 같은 부분을 듣는다 (carol.ts onAir).
// - 소리를 분석해 박자를 3D 장면(스피커·불·전구)에 알려 준다 (scene/music.ts).

const FILES = import.meta.glob('../carols/*.{mp3,m4a,ogg,wav,aac,MP3,M4A}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const SONGS: Song[] = songsFrom(FILES)

const MUTE_KEY = 'santa-carol-muted'
const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** 곡 길이를 미리 읽어 둔다 (파일 앞부분만). 모두 같은 파일이라 모두 같은 길이 → 같은 라디오 시간표 */
function useDurations(songs: Song[], enabled: boolean) {
  const [d, setD] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!enabled) return
    const els = songs.map((s) => {
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => setD((prev) => ({ ...prev, [s.file]: a.duration }))
      a.onerror = () => setD((prev) => ({ ...prev, [s.file]: 0 }))
      a.src = s.url
      return a
    })
    return () => els.forEach((a) => (a.src = ''))
  }, [songs, enabled])
  return d
}

/** 소리 분석기를 붙인다 (처음 재생할 때 한 번). 못 붙이면 3D 는 가짜 박자로 움직인다 */
function attachAnalyser(a: HTMLAudioElement) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const src = ctx.createMediaElementSource(a)
    const an = ctx.createAnalyser()
    an.fftSize = 256
    an.smoothingTimeConstant = 0.6
    src.connect(an)
    an.connect(ctx.destination)
    const bins = new Uint8Array(an.frequencyBinCount)
    music.read = () => {
      an.getByteFrequencyData(bins)
      let bass = 0
      for (let i = 1; i < 6; i++) bass += bins[i]
      let all = 0
      for (let i = 1; i < 64; i++) all += bins[i]
      return { bass: bass / (5 * 255), level: Math.min(1, (all / (63 * 255)) * 2.2) }
    }
    return ctx
  } catch {
    return null
  }
}

export function CarolPlayer({ level, onSongChange }: { level: number; onSongChange?: (text: string) => void }) {
  const near = level > 0
  const [seen, setSeen] = useState(false) // 한 번이라도 무대 근처에 왔는지 (그 전엔 길이도 안 읽는다)
  useEffect(() => {
    if (near) setSeen(true)
  }, [near])
  const durations = useDurations(SONGS, seen)
  const audio = useRef<HTMLAudioElement | null>(null)
  const ctx = useRef<AudioContext | null | undefined>(undefined)
  const [muted, setMuted] = useState(readMuted)
  const [blocked, setBlocked] = useState(false) // 브라우저가 자동재생을 막은 경우
  const [listOpen, setListOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const lastFile = useRef<string | null>(null)
  const songChange = useRef(onSongChange)
  songChange.current = onSongChange

  // 1초마다 시계 → 지금 흐르는 곡
  useEffect(() => {
    if (!near) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [near])
  const air = useMemo(() => onAir(SONGS, (s) => durations[s.file] ?? 0, now), [durations, now])

  const play = (a: HTMLAudioElement) => {
    if (ctx.current === undefined) ctx.current = attachAnalyser(a)
    void ctx.current?.resume()
    a.play().then(
      () => {
        setBlocked(false)
        music.playing = true
      },
      () => {
        setBlocked(true)
        music.playing = false
      },
    )
  }

  // 곡이 바뀌면 그 곡을 그 위치부터. 같은 곡이면 너무 어긋났을 때만 맞춘다
  useEffect(() => {
    const a = (audio.current ??= new Audio())
    music.song = near && air ? { title: air.song.title, composer: air.song.composer } : null
    if (!near || muted || !air) {
      a.pause()
      music.playing = false
      return
    }
    a.volume = Math.min(1, 0.15 + level * 0.85)
    const changed = lastFile.current !== air.song.file
    if (changed) {
      if (lastFile.current !== null) songChange.current?.(`🎶 다음 곡: ${air.song.title}${air.song.composer ? ` — ${air.song.composer}` : ''}`)
      lastFile.current = air.song.file
      a.src = air.song.url
      a.currentTime = air.pos
    } else if (Math.abs(a.currentTime - air.pos) > 2.5) a.currentTime = air.pos
    if (a.paused) play(a)
    music.playing = !a.paused
  }, [near, muted, level, air])

  useEffect(
    () => () => {
      audio.current?.pause()
      music.playing = false
      music.song = null
    },
    [],
  )

  const toggle = () => {
    const m = !muted
    setMuted(m)
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    } catch {
      /* 저장 못 해도 괜찮다 */
    }
  }
  const playNow = () => {
    const a = audio.current
    if (!a || !air) return
    a.currentTime = air.pos
    play(a)
  }

  const playing = near && !muted && !blocked && !!air
  const hue = air ? labelHue(air.song.title) : 8

  return (
    <div className={`carol ${near ? 'on' : ''}`} aria-hidden={!near}>
      <p className="carol-kicker">
        📻 AX 캐롤 라디오 {SONGS.length > 0 && <span>· {SONGS.length}곡</span>}
        <button className="carol-mute" onClick={toggle} title={muted ? '소리 켜기' : '소리 끄기'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </p>
      <div className="carol-now">
        <div className={`vinyl ${playing ? 'spin' : ''}`} style={{ '--hue': hue } as CSSProperties}>
          <i />
        </div>
        <div className="carol-meta">
          <b>{air ? air.song.title : SONGS.length ? '곡을 불러오는 중…' : '곡이 아직 없어요'}</b>
          <span>{air ? (air.song.composer ? `🎼 ${air.song.composer}` : 'AX 팀원 작곡') : SONGS.length ? '' : '팀원들의 캐롤을 기다리는 중 🎄'}</span>
          {air && (
            <div className="carol-progress">
              <div className="bar">
                <i style={{ width: `${(air.pos / (air.pos + air.left)) * 100}%` }} />
              </div>
              <span>
                {mmss(air.pos)} / {mmss(air.pos + air.left)}
              </span>
            </div>
          )}
        </div>
      </div>
      {blocked && !muted && air && (
        <button className="ghost small carol-play" onClick={playNow}>
          ▶ 눌러서 같이 듣기
        </button>
      )}
      {air?.next && air.next.file !== air.song.file && (
        <p className="carol-next">
          다음 곡 · {air.next.title}
          {air.next.composer && <span> — {air.next.composer}</span>}
        </p>
      )}
      {SONGS.length > 0 && (
        <button className="carol-list-toggle" onClick={() => setListOpen((v) => !v)}>
          {listOpen ? '플레이리스트 접기 ▴' : `🎵 플레이리스트 ${SONGS.length}곡 ▾`}
        </button>
      )}
      {listOpen && (
        <ol className="carol-list">
          {SONGS.map((s) => (
            <li key={s.file} className={air?.song.file === s.file ? 'on' : ''}>
              <span className="dot" style={{ '--hue': labelHue(s.title) } as CSSProperties} />
              <span className="t">
                {s.title}
                {s.composer && <em> {s.composer}</em>}
              </span>
              <span className="d">{durations[s.file] ? mmss(durations[s.file]) : ''}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="carol-foot">🔥 불가에 앉아서 들어 보세요 · 가까울수록 크게</p>
    </div>
  )
}
