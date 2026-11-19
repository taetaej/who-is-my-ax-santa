import { useEffect, useRef, useState } from 'react'
import { CAROL, syncedPosition, youtubeId } from '../carol'

// 캐롤 무대 근처에 오면 유튜브 곡이 흐른다. 무대에 가까울수록 크게, 멀어지면 작아지다 멈춘다.
// 다같이 같은 부분을 듣도록 재생 위치는 지금 시각으로 맞춘다 (carol.ts syncedPosition).

type YTPlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(s: number, allowSeekAhead: boolean): void
  setVolume(v: number): void
  getDuration(): number
  getPlayerState(): number
  destroy(): void
}
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width: number
      height: number
      playerVars: Record<string, number | string>
      events: { onReady: () => void; onStateChange: (e: { data: number }) => void; onError: (e: { data: number }) => void }
    },
  ) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const PLAYING = 1
const ENDED = 0

let apiLoading: Promise<YTNamespace> | null = null
function loadApi(): Promise<YTNamespace> {
  apiLoading ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return apiLoading
}

const MUTE_KEY = 'santa-carol-muted'
const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function CarolPlayer({ level }: { level: number }) {
  const id = youtubeId(CAROL.youtube)
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(readMuted)
  const [blocked, setBlocked] = useState(false) // 브라우저가 자동재생을 막은 경우
  const [broken, setBroken] = useState<number | null>(null) // 유튜브 오류 코드 (101·150 = 퍼가기 막힘)
  const near = level > 0

  // 처음 무대 근처에 왔을 때 플레이어를 만든다
  useEffect(() => {
    if (!near || !id || player.current || !host.current) return
    let cancelled = false
    loadApi().then((YT) => {
      if (cancelled || !host.current) return
      // 유튜브가 이 요소를 iframe 으로 바꿔치기하므로, React 가 모르는 자식 요소를 따로 만들어 넘긴다
      const el = document.createElement('div')
      host.current.appendChild(el)
      player.current = new YT.Player(el, {
        videoId: id,
        width: 224,
        height: 126,
        playerVars: { controls: 0, playsinline: 1, rel: 0, modestbranding: 1, disablekb: 1, origin: window.location.origin },
        events: {
          onReady: () => setReady(true),
          onError: (e) => setBroken(e.data),
          onStateChange: (e) => {
            if (e.data === PLAYING) setBlocked(false)
            if (e.data === ENDED) {
              // 다 끝나면 처음부터 (모두 같은 시각에 끝나므로 계속 맞는다)
              player.current?.seekTo(0, true)
              player.current?.playVideo()
            }
          },
        },
      })
    })
    return () => {
      cancelled = true
    }
  }, [near, id])

  // 거리와 끄기 버튼에 맞춰 재생·볼륨을 조절한다
  useEffect(() => {
    const p = player.current
    if (!p || !ready) return
    if (near && !muted) {
      p.setVolume(Math.round(15 + level * 85))
      if (p.getPlayerState() !== PLAYING) {
        p.seekTo(syncedPosition(p.getDuration()), true)
        p.playVideo()
        // 잠시 뒤에도 재생 중이 아니면 자동재생이 막힌 것
        const t = setTimeout(() => player.current && player.current.getPlayerState() !== PLAYING && setBlocked(true), 1500)
        return () => clearTimeout(t)
      }
    } else {
      p.pauseVideo()
    }
  }, [near, muted, level, ready])

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
    const p = player.current
    if (!p) return
    p.seekTo(syncedPosition(p.getDuration()), true)
    p.playVideo()
  }

  return (
    <div className={`carol ${near ? 'on' : ''}`} aria-hidden={!near}>
      <div className="carol-head">
        <span className="carol-eq" data-playing={near && !muted && !blocked}>
          <i />
          <i />
          <i />
        </span>
        <div>
          <b>{CAROL.title}</b>
          <span className="muted small">작곡 · {CAROL.by}</span>
        </div>
        <button className="ghost small" onClick={toggle} title={muted ? '소리 켜기' : '소리 끄기'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      {id ? (
        <div className="carol-video" ref={host} />
      ) : (
        <p className="muted small">곡 링크가 아직 없어요 (src/carol.ts)</p>
      )}
      {broken !== null && (
        <p className="error small">
          {broken === 101 || broken === 150 || broken === 153
            ? '이 영상은 다른 사이트에서 재생할 수 없게 막혀 있어요. 유튜브 스튜디오에서 "퍼가기 허용"을 켜 주세요.'
            : `영상을 불러오지 못했어요 (오류 ${broken})`}
        </p>
      )}
      {blocked && !muted && broken === null && (
        <button className="ghost small" onClick={playNow}>
          ▶ 눌러서 같이 듣기
        </button>
      )}
      <p className="muted small">🎧 무대 가까이 갈수록 크게 들려요</p>
    </div>
  )
}
