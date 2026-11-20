import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { V3 } from './world'

// 간판 글씨를 캔버스에 그려 3D 판에 붙인다.
// HTML 라벨(drei Html)은 다른 물체 뒤에 있어도 비쳐 보여서, 장소에 붙은 글씨는 이걸로 그린다.

export type TextLine = {
  text: string
  size: number
  color?: string
  weight?: number
  gap?: number
  hand?: boolean
  kr?: boolean
  wrap?: boolean
  align?: 'center' | 'left'
} // hand = 손글씨, kr = 영문도 페이퍼로지로, wrap = 폭에 맞춰 줄바꿈

const FONT = "Sora, Paperlogy, 'Apple SD Gothic Neo', 'Apple Color Emoji', sans-serif"
const HAND = "'Poor Story', Paperlogy, 'Apple Color Emoji', sans-serif"
const KR = "Paperlogy, 'Apple SD Gothic Neo', 'Apple Color Emoji', sans-serif"

// 웹폰트가 받아지기 전에 그리면 기본 서체로 굳어 버리므로, 받아진 뒤 한 번 더 그린다
const fontReady: Promise<unknown> =
  typeof document !== 'undefined' && document.fonts
    ? Promise.all(
        ['800 40px Sora', '800 40px Paperlogy', '700 40px Paperlogy', '500 40px Paperlogy', '400 40px "Poor Story"'].map((f) => document.fonts.load(f, '가A')),
      ).catch(() => null)
    : Promise.resolve()
const PX = 220 // 1 월드 단위당 픽셀

function paint(lines: TextLine[], w: number, h: number, bg?: string, radius = 0) {
  const c = document.createElement('canvas')
  c.width = Math.round(w * PX)
  c.height = Math.round(h * PX)
  const g = c.getContext('2d')!
  if (bg) {
    g.fillStyle = bg
    const r = radius * PX
    g.beginPath()
    g.roundRect(0, 0, c.width, c.height, r)
    g.fill()
  }
  g.textBaseline = 'middle'
  const max = c.width * 0.88
  const pad = (c.width - max) / 2
  const fontOf = (l: TextLine, px: number) => (l.hand ? `400 ${px * 1.15}px ${HAND}` : `${l.weight ?? 800} ${px}px ${l.kr ? KR : FONT}`)

  // wrap 줄은 폭에 맞춰 여러 줄로 나누고, 아닌 줄은 넘치면 글씨를 줄인다
  type Row = { l: TextLine; text: string; px: number; h: number }
  const layout = (scale: number) => {
    const rows: Row[] = []
    for (const l of lines) {
      const px = l.size * PX * scale
      g.font = fontOf(l, px)
      if (l.wrap) {
        const parts: string[] = []
        let cur = ''
        for (const word of l.text.split(' ')) {
          const next = cur ? `${cur} ${word}` : word
          if (g.measureText(next).width <= max || !cur) cur = next
          else {
            parts.push(cur)
            cur = word
          }
        }
        if (cur) parts.push(cur)
        parts.forEach((t, k) =>
          rows.push({
            l,
            text: t,
            px,
            h: px * 1.35 + (k === parts.length - 1 ? (l.gap ?? 0) * PX * scale : 0),
          }),
        )
      } else {
        const m = g.measureText(l.text).width
        const fit = m > max ? (px * max) / m : px
        rows.push({
          l,
          text: l.text,
          px: fit,
          h: px * 1.15 + (l.gap ?? 0) * PX * scale,
        })
      }
    }
    return rows
  }
  // 판에 다 안 들어가면 전체 글씨를 조금씩 줄인다 (내용이 많은 달도 넘치지 않게)
  let rows = layout(1)
  for (let scale = 0.93, i = 0; i < 10 && rows.reduce((a, r) => a + r.h, 0) > c.height * 0.94; scale *= 0.93, i++) rows = layout(scale)
  let y = (c.height - rows.reduce((a, r) => a + r.h, 0)) / 2
  for (const r of rows) {
    g.font = fontOf(r.l, r.px)
    g.fillStyle = r.l.color ?? '#3a2a20'
    const left = r.l.align === 'left'
    g.textAlign = left ? 'left' : 'center'
    const lineH = r.px * (r.l.wrap ? 1.35 : 1.15)
    g.fillText(r.text, left ? pad : c.width / 2, y + lineH / 2)
    y += r.h
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function TextSign({
  lines,
  w,
  h,
  position,
  rotation = [0, 0, 0],
  bg,
  radius = 0,
  glow = false,
}: {
  lines: TextLine[]
  w: number
  h: number
  position: V3
  rotation?: V3
  bg?: string
  radius?: number
  glow?: boolean // true 면 어두운 저녁에도 밝게 (조명 영향 없음)
}) {
  const [fontVer, setFontVer] = useState(0)
  useEffect(() => {
    let alive = true
    void fontReady.then(() => alive && setFontVer(1))
    return () => {
      alive = false
    }
  }, [])
  const key = JSON.stringify([lines, w, h, bg, radius, fontVer])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(() => paint(lines, w, h, bg, radius), [key])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      {glow ? (
        <meshBasicMaterial map={tex} transparent toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      ) : (
        <meshStandardMaterial map={tex} transparent roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
      )}
    </mesh>
  )
}
