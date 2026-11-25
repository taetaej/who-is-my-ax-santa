import { useEffect, useRef, useState } from 'react'
import { rng } from '../scene/materials'
import { camView } from '../scene/Player'
import { snow } from '../scene/snowball'
import { ARENA, ELF, ISLAND_EDGE, PARTY, ROCKET, ROLL, SCOPE, SLED, SPOT, VILLAGE_R, ZONE_PATHS, at, sledLocal, sledPoint } from '../scene/world'

// 🗺️ 미니맵: 화면 오른쪽 위의 동화책 지도. 위쪽 = 화면 안쪽(-z), 기본 카메라와 같은 방향.
// 별 뜬 우주에 떠 있는 눈 행성 섬, 눈 덮인 나무, 스티커 같은 장소 아이콘, 통통 튀는 나, 이름표 단 동료.
// 숨은 선물 자리는 절대 안 그린다. 누르면 크게/작게, − 로 접기 (이 브라우저에 기억)

type Mark = { x: number; z: number; emoji: string; name: string; tint: string }
const p2 = (s: { a: number; r: number }) => {
  const [x, , z] = at(s)
  return { x, z }
}
const MARKS: Mark[] = [
  { ...p2(SPOT.post), emoji: '📮', name: '우편함', tint: '#ffe3e0' },
  { ...p2(SPOT.cocoa), emoji: '☕', name: '카페', tint: '#f6e7d6' },
  { ...p2(SPOT.fire), emoji: '🔥', name: '불멍', tint: '#ffe9cf' },
  { ...p2(SPOT.awards), emoji: '🏆', name: '어워즈', tint: '#fff3c4' },
  { ...PARTY, emoji: '🎂', name: '파티', tint: '#ffe0ef' },
  { ...ELF, emoji: '🧝', name: '엘프', tint: '#dff5e3' },
  { x: ARENA.x, z: ARENA.z, emoji: '⚔️', name: '눈싸움장', tint: '#ffe0dd' },
  { x: ROLL.x, z: ROLL.z, emoji: '⛄', name: '눈굴리기', tint: '#dde9ff' },
  { ...sledPoint(SLED.len * 0.35), emoji: '🛷', name: '썰매 산', tint: '#e3e6ff' },
  { x: ROCKET.x, z: ROCKET.z, emoji: '🚀', name: 'WithSet 호', tint: '#e2e8ff' },
  { x: SCOPE.x, z: SCOPE.z, emoji: '🔭', name: '망원경', tint: '#efe3ff' },
]
const PEER_TINTS = ['#ff8fab', '#7cc6fe', '#ffc857', '#9be3a8', '#c3a6ff', '#ffa69e', '#6fd3c7']
const FONT = '"Paperlogy", "Pretendard", system-ui, sans-serif'
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

/** 나무 자리: 바깥 링에 듬성듬성, 놀이 구역·썰매 산·꾸밈은 비운다 */
const TREES = (() => {
  const rand = rng(77)
  const out: { x: number; z: number; s: number }[] = []
  for (let i = 0; out.length < 34 && i < 400; i++) {
    const a = rand() * Math.PI * 2
    const r = VILLAGE_R + 2.5 + rand() * (ISLAND_EDGE - VILLAGE_R - 4.5)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const near = (p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) < d
    const sl = sledLocal(x, z)
    if (near(ARENA, ARENA.r + 2) || near(ROLL, ROLL.r + 2) || near(ROCKET, 4.5) || near(SCOPE, 3)) continue
    if (sl.s > -SLED.back - 2 && sl.s < SLED.len + SLED.run && Math.abs(sl.w) < SLED.half + 2.5) continue
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue
    out.push({ x, z, s: 0.8 + rand() * 0.5 })
  }
  return out
})()

const KEY = 'santa-minimap'
const read = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** 움직이지 않는 바탕 (우주·섬·나무·구역·장소 스티커). 크기가 바뀔 때만 다시 그린다 */
function paintBase(size: number, dpr: number, big: boolean) {
  const c = document.createElement('canvas')
  c.width = size * dpr
  c.height = size * dpr
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const half = size / 2
  const k = (half - 10) / ISLAND_EDGE
  const X = (x: number) => half + x * k
  const Z = (z: number) => half + z * k

  // 🌌 우주: 남보라 그라데이션 + 반짝이는 별
  const sky = g.createRadialGradient(half, half * 0.8, 10, half, half, half)
  sky.addColorStop(0, '#4b3f8f')
  sky.addColorStop(1, '#1e1a45')
  g.fillStyle = sky
  g.fillRect(0, 0, size, size)
  const rand = rng(5)
  for (let i = 0; i < (big ? 60 : 34); i++) {
    const x = rand() * size
    const y = rand() * size
    const r = rand() < 0.15 ? 1.4 : 0.7
    g.fillStyle = rand() < 0.25 ? '#ffe9a8' : '#ffffff'
    g.globalAlpha = 0.5 + rand() * 0.5
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  // 🪐 떠 있는 섬: 아래로 비치는 보라 절벽 + 눈 덮인 윗면
  const R = ISLAND_EDGE * k
  g.fillStyle = '#8f86c9'
  g.beginPath()
  g.arc(half, half + R * 0.08, R * 0.98, 0, Math.PI * 2)
  g.fill()
  const snowTop = g.createRadialGradient(half - R * 0.25, half - R * 0.3, R * 0.1, half, half, R)
  snowTop.addColorStop(0, '#ffffff')
  snowTop.addColorStop(1, '#e4e9fb')
  g.fillStyle = snowTop
  g.beginPath()
  g.arc(half, half, R, 0, Math.PI * 2)
  g.fill()

  // 🏘️ 원래 마을: 따뜻한 크림색 + 등불 점선
  g.fillStyle = '#fff4e2'
  g.beginPath()
  g.arc(half, half, VILLAGE_R * k, 0, Math.PI * 2)
  g.fill()
  g.setLineDash([1.5, 4])
  g.lineCap = 'round'
  g.strokeStyle = '#f0b44c'
  g.lineWidth = big ? 2.4 : 1.8
  g.beginPath()
  g.arc(half, half, VILLAGE_R * k, 0, Math.PI * 2)
  g.stroke()

  // 🛤️ 등불 돌길
  g.setLineDash([2, 3.5])
  g.strokeStyle = '#d9c3a2'
  g.lineWidth = big ? 2.2 : 1.6
  for (const path of ZONE_PATHS) {
    g.beginPath()
    path.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))))
    g.stroke()
  }
  g.setLineDash([])

  // 놀이 구역: 파스텔 동그라미 + 흰 점선 테두리
  const zone = (z: { x: number; z: number; r: number }, fill: string) => {
    g.fillStyle = fill
    g.beginPath()
    g.arc(X(z.x), Z(z.z), z.r * k, 0, Math.PI * 2)
    g.fill()
    g.setLineDash([2, 3])
    g.strokeStyle = '#ffffff'
    g.lineWidth = 1.5
    g.stroke()
    g.setLineDash([])
  }
  zone(ARENA, '#ffd6d1')
  zone(ROLL, '#d4e4ff')

  // 🛷 썰매 산: 연보라 산 + 하늘색 썰매 길
  const corners = [sledPoint(-SLED.back, -SLED.half), sledPoint(-SLED.back, SLED.half), sledPoint(SLED.len, SLED.half), sledPoint(SLED.len, -SLED.half)]
  g.fillStyle = '#d8d6f5'
  g.beginPath()
  corners.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))))
  g.closePath()
  g.fill()
  const s0 = sledPoint(0)
  const s1 = sledPoint(SLED.len + SLED.run * 0.85)
  g.strokeStyle = '#a9c8ff'
  g.lineWidth = Math.max(3, SLED.track * 2 * k)
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(X(s0.x), Z(s0.z))
  g.lineTo(X(s1.x), Z(s1.z))
  g.stroke()

  // 🌲 눈 덮인 나무
  for (const t of TREES) {
    const x = X(t.x)
    const y = Z(t.z)
    const h = (big ? 7 : 4.6) * t.s
    g.fillStyle = '#3f8f62'
    g.beginPath()
    g.moveTo(x, y - h)
    g.lineTo(x + h * 0.62, y + h * 0.45)
    g.lineTo(x - h * 0.62, y + h * 0.45)
    g.closePath()
    g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.moveTo(x, y - h)
    g.lineTo(x + h * 0.25, y - h * 0.45)
    g.lineTo(x - h * 0.25, y - h * 0.45)
    g.closePath()
    g.fill()
  }

  // 🎄 가운데 큰 트리 (반짝이 후광)
  const gr = big ? 22 : 13
  const glow = g.createRadialGradient(half, half, 0, half, half, gr)
  glow.addColorStop(0, 'rgba(255, 220, 120, 0.85)')
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)')
  g.fillStyle = glow
  g.beginPath()
  g.arc(half, half, gr, 0, Math.PI * 2)
  g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `${big ? 24 : 15}px ${EMOJI}`
  g.fillStyle = '#000'
  g.fillText('🎄', half, half)

  // 장소 스티커: 파스텔 동그라미 + 흰 테두리 + 그림자
  const r = big ? 11 : 7
  for (const m of MARKS) {
    const x = X(m.x)
    const y = Z(m.z)
    g.save()
    g.shadowColor = 'rgba(40, 30, 80, 0.3)'
    g.shadowBlur = 3
    g.shadowOffsetY = 1
    g.fillStyle = m.tint
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
    g.restore()
    g.strokeStyle = '#ffffff'
    g.lineWidth = big ? 2 : 1.4
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.stroke()
    g.font = `${big ? 13 : 8.5}px ${EMOJI}`
    g.fillStyle = '#000'
    g.fillText(m.emoji, x, y + 0.5)
    if (big && m.emoji !== '🧝') {
      g.font = `700 9.5px ${FONT}`
      const w = g.measureText(m.name).width + 8
      g.fillStyle = 'rgba(255, 255, 255, 0.92)'
      roundRect(g, x - w / 2, y + r + 2, w, 13, 6.5)
      g.fill()
      g.fillStyle = '#4a4466'
      g.fillText(m.name, x, y + r + 9)
    }
  }
  return c
}

export function MiniMap({ show }: { show: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'small' | 'big' | 'off'>(() => (read() === 'off' ? 'off' : read() === 'big' ? 'big' : 'small'))
  useEffect(() => {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* 저장 못 해도 괜찮다 */
    }
  }, [mode])

  const big = mode === 'big'
  const size = big ? 300 : 172
  useEffect(() => {
    if (!show || mode === 'off') return
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = size * dpr
    c.height = size * dpr
    const g = c.getContext('2d')!
    let base = paintBase(size, dpr, big)
    // 글꼴이 늦게 오면 이름표를 다시 그린다
    document.fonts?.ready.then(() => (base = paintBase(size, dpr, big))).catch(() => {})
    const half = size / 2
    const k = (half - 10) / ISLAND_EDGE
    const X = (x: number) => half + x * k
    const Z = (z: number) => half + z * k
    let raf = 0
    let last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 66) return // 15fps 면 충분
      last = now
      const t = now / 1000
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, c.width, c.height)
      g.drawImage(base, 0, 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.textAlign = 'center'
      g.textBaseline = 'middle'

      // 동료: 파스텔 점 + 이름표
      for (const p of snow.peers.values()) {
        const x = X(p.s.x)
        const y = Z(p.s.z)
        const tint = PEER_TINTS[Math.abs(p.id) % PEER_TINTS.length]
        g.fillStyle = tint
        g.strokeStyle = '#ffffff'
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(x, y, big ? 4.5 : 3.2, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        const label = big ? p.name : p.name.slice(-2)
        g.font = `700 ${big ? 10 : 8}px ${FONT}`
        const w = g.measureText(label).width + (big ? 8 : 6)
        const h = big ? 13 : 10
        const ly = y - (big ? 14 : 10)
        g.fillStyle = tint
        roundRect(g, x - w / 2, ly - h / 2, w, h, h / 2)
        g.fill()
        g.fillStyle = '#2b2546'
        g.fillText(label, x, ly + 0.5)
      }

      // 나: 퐁퐁 퍼지는 물결 + 통통 튀는 빨간 핀 (뾰족한 쪽이 바라보는 쪽)
      const me = snow.me?.s
      if (me) {
        const x = X(me.x)
        const y = Z(me.z)
        // 🎥 지금 화면이 보고 있는 쪽 (노란 부채꼴)
        const a = Math.atan2(Math.cos(camView.facing), Math.sin(camView.facing))
        const reach = big ? 46 : 28
        const cone = g.createRadialGradient(x, y, 2, x, y, reach)
        cone.addColorStop(0, 'rgba(255, 216, 107, 0.65)')
        cone.addColorStop(1, 'rgba(255, 216, 107, 0)')
        g.fillStyle = cone
        g.beginPath()
        g.moveTo(x, y)
        g.arc(x, y, reach, a - 0.55, a + 0.55)
        g.closePath()
        g.fill()
        const wave = (t * 0.9) % 1
        g.strokeStyle = `rgba(255, 90, 90, ${0.7 * (1 - wave)})`
        g.lineWidth = 2
        g.beginPath()
        g.arc(x, y, (big ? 7 : 5) + wave * (big ? 14 : 9), 0, Math.PI * 2)
        g.stroke()
        const bob = Math.sin(t * 5) * (big ? 1.5 : 1)
        const r = big ? 7 : 5
        g.save()
        g.translate(x, y + bob)
        g.rotate(Math.PI - me.rot) // rot 0 = +z (지도 아래)
        g.fillStyle = '#ff5a5f'
        g.strokeStyle = '#ffffff'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(0, -r * 1.75)
        g.arc(0, 0, r, -Math.PI * 0.2, Math.PI * 1.2)
        g.closePath()
        g.fill()
        g.stroke()
        g.restore()
        g.fillStyle = '#ffffff'
        g.font = `800 ${big ? 9 : 7}px ${FONT}`
        g.fillText('나', x, y + bob + 0.5)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [show, mode, size, big])

  if (!show) return null
  if (mode === 'off')
    return (
      <button className="minimap-open" onClick={() => setMode('small')} title="미니맵 열기">
        🗺️
      </button>
    )
  return (
    <div className={`minimap ${mode}`}>
      <canvas ref={canvas} style={{ width: size, height: size }} onClick={() => setMode(big ? 'small' : 'big')} title={big ? '작게 보기' : '크게 보기'} />
      <span className="minimap-star" aria-hidden>
        ⭐
      </span>
      <span className="minimap-ribbon">🎅 AX 산타 행성</span>
      <button className="minimap-x" onClick={() => setMode('off')} aria-label="미니맵 접기">
        −
      </button>
    </div>
  )
}
