import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// 눈 내린 3D 산타마을의 공통 재질.
// 판자벽, 벽돌, 회벽, 기와 지붕은 캔버스로 그린 텍스처를 쓴다 (외부 이미지 없음).

type Paint = (g: CanvasRenderingContext2D, s: number) => void

function canvasTex(paint: Paint): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  paint(g, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const speckle = (g: CanvasRenderingContext2D, s: number, color: string, n: number, alpha: number) => {
  g.fillStyle = color
  for (let i = 0; i < n; i++) {
    g.globalAlpha = Math.random() * alpha
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 6, 1)
  }
  g.globalAlpha = 1
}

/** 가로 판자벽 */
const planks = (base: string, dark: string): Paint => (g, s) => {
  const rows = 8
  const h = s / rows
  for (let r = 0; r < rows; r++) {
    const l = (Math.random() - 0.5) * 18
    g.fillStyle = base
    g.fillRect(0, r * h, s, h)
    g.fillStyle = l > 0 ? '#ffffff' : '#000000'
    g.globalAlpha = Math.abs(l) / 140
    g.fillRect(0, r * h, s, h)
    g.globalAlpha = 1
  }
  speckle(g, s, dark, 900, 0.18)
  g.fillStyle = dark
  for (let r = 0; r < rows; r++) {
    g.globalAlpha = 0.55
    g.fillRect(0, r * h, s, 2)
    g.globalAlpha = 0.25
    const x = ((r * 97) % s) + 20
    g.fillRect(x, r * h, 2, h) // 판자 이음매
  }
  g.globalAlpha = 1
}

/** 벽돌 */
const bricks = (base: string, mortar: string): Paint => (g, s) => {
  g.fillStyle = mortar
  g.fillRect(0, 0, s, s)
  const rows = 10
  const h = s / rows
  const w = s / 4
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? w / 2 : 0
    for (let c = -1; c < 5; c++) {
      const v = (Math.random() - 0.5) * 30
      g.fillStyle = base
      g.fillRect(c * w + off + 2, r * h + 2, w - 4, h - 4)
      g.fillStyle = v > 0 ? '#ffffff' : '#000000'
      g.globalAlpha = Math.abs(v) / 200
      g.fillRect(c * w + off + 2, r * h + 2, w - 4, h - 4)
      g.globalAlpha = 1
    }
  }
}

/** 회벽 + 아래쪽 반목조 띠 */
const plaster = (base: string, dark: string): Paint => (g, s) => {
  g.fillStyle = base
  g.fillRect(0, 0, s, s)
  speckle(g, s, dark, 1600, 0.08)
}

/** 겹친 기와 지붕 */
const shingles = (base: string, dark: string): Paint => (g, s) => {
  g.fillStyle = dark
  g.fillRect(0, 0, s, s)
  const rows = 8
  const h = s / rows
  const w = s / 6
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? w / 2 : 0
    for (let c = -1; c < 7; c++) {
      const v = (Math.random() - 0.5) * 34
      g.fillStyle = base
      g.beginPath()
      g.roundRect(c * w + off + 1.5, r * h + 1, w - 3, h + 4, [0, 0, 8, 8])
      g.fill()
      g.fillStyle = v > 0 ? '#ffffff' : '#000000'
      g.globalAlpha = Math.abs(v) / 220
      g.fill()
      g.globalAlpha = 1
    }
  }
}

const tex = (paint: Paint, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ map: canvasTex(paint), roughness, metalness: 0 })

export const M = {
  // 벽 (키 이름은 House.tsx 에서 쓰는 역할 이름)
  kraft: tex(planks('#a8754a', '#4e2f17')), // 나무 판자
  kraftLight: tex(planks('#d9bf98', '#7a5a38')), // 밝은 판자 / 울타리
  red: tex(bricks('#a5392c', '#d9cfc2')), // 붉은 벽돌
  cream: tex(plaster('#efe4cf', '#a08e6c')), // 회벽
  green: tex(planks('#3d6e55', '#173426')), // 초록 페인트 판자
  // 지붕
  roofRed: tex(shingles('#a8302a', '#5e1712'), 0.8),
  roofGreen: tex(shingles('#2f6249', '#14301f'), 0.8),
  roofBrown: tex(shingles('#6d4630', '#36210f'), 0.85),
  roofSlate: tex(shingles('#566170', '#2a3038'), 0.7),
  snow: new THREE.MeshStandardMaterial({ color: '#fbfdff', roughness: 0.85 }),
  snowShade: new THREE.MeshStandardMaterial({ color: '#eef3fa', roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: '#9b9690', roughness: 1 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: '#7d7872', roughness: 1 }),
  ice: new THREE.MeshStandardMaterial({ color: '#4fa3d1', roughness: 0.15, metalness: 0.1, emissive: '#0d3d63', emissiveIntensity: 0.25 }),
  pine: new THREE.MeshStandardMaterial({ color: '#1d4733', roughness: 1 }),
  pineDark: new THREE.MeshStandardMaterial({ color: '#163a29', roughness: 1 }),
  wreath: new THREE.MeshStandardMaterial({ color: '#21573a', roughness: 0.9 }),
  ribbon: new THREE.MeshStandardMaterial({ color: '#c8231f', roughness: 0.55 }),
  berry: new THREE.MeshStandardMaterial({ color: '#d4201b', roughness: 0.35 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9a93a', roughness: 0.3, metalness: 0.6 }),
  iron: new THREE.MeshStandardMaterial({ color: '#1f1f22', roughness: 0.5, metalness: 0.4 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4f2e', roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: '#5b3a22', roughness: 0.9 }),
  doorRed: new THREE.MeshStandardMaterial({ color: '#a8282a', roughness: 0.7 }),
  pot: new THREE.MeshStandardMaterial({ color: '#a8643a', roughness: 0.9 }),
  coal: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }),
  carrot: new THREE.MeshStandardMaterial({ color: '#f07a1a', roughness: 0.6 }),
  scarf: new THREE.MeshStandardMaterial({ color: '#c62a24', roughness: 0.9 }),
  trim: new THREE.MeshStandardMaterial({ color: '#f6f1e7', roughness: 0.6 }), // 흰 페인트 창틀
  trimWood: new THREE.MeshStandardMaterial({ color: '#6a4428', roughness: 0.75 }),
  // 빛나는 재질: toneMapped=false 라서 블룸이 이 재질에만 걸린다
  glow: new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb04a', emissiveIntensity: 2.2, toneMapped: false }),
  glowSoft: new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffc265', emissiveIntensity: 1.4, toneMapped: false }),
  bulbs: [
    new THREE.MeshStandardMaterial({ color: '#ff5a4a', emissive: '#ff3b2a', emissiveIntensity: 3, toneMapped: false }),
    new THREE.MeshStandardMaterial({ color: '#ffd45a', emissive: '#ffbf2a', emissiveIntensity: 3, toneMapped: false }),
    new THREE.MeshStandardMaterial({ color: '#5aff8a', emissive: '#2aff6a', emissiveIntensity: 2.4, toneMapped: false }),
    new THREE.MeshStandardMaterial({ color: '#6ab4ff', emissive: '#3a8aff', emissiveIntensity: 2.6, toneMapped: false }),
  ],
  ornaments: [
    new THREE.MeshStandardMaterial({ color: '#c8231f', roughness: 0.2, metalness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: '#d9a93a', roughness: 0.2, metalness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: '#e8e8ee', roughness: 0.15, metalness: 0.8 }),
  ],
  presents: [
    new THREE.MeshStandardMaterial({ color: '#2f6b4a', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: '#c99a3a', roughness: 0.5, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: '#b3302a', roughness: 0.6 }),
  ],
}

// ── 지오메트리 도우미 ──────────────────────────────────────────

/** 작은 구(눈 방울, 고드름 끝)를 여러 개 합친 지오메트리 하나. 드로우콜을 아낀다. */
export function blobs(points: [number, number, number, number][], seg = 8): THREE.BufferGeometry {
  const parts = points.map(([x, y, z, r]) => {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2))
    g.scale(1, 0.8, 1)
    g.translate(x, y, z)
    return g
  })
  return parts.length ? mergeGeometries(parts)! : new THREE.BufferGeometry()
}

/** 아치형(위가 반원) 2D 모양. 창문과 문에 쓴다. */
export function archShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape()
  const r = w / 2
  s.moveTo(-r, 0)
  s.lineTo(r, 0)
  s.lineTo(r, h - r)
  s.absarc(0, h - r, r, 0, Math.PI, false)
  s.lineTo(-r, 0)
  return s
}

/** 박공(오각형) 집 단면을 깊이만큼 밀어낸 몸체. 앞면이 +z, 바닥 중심이 원점. */
export function gableBody(w: number, h: number, rise: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.lineTo(0, h + rise)
  s.lineTo(-w / 2, h)
  s.lineTo(-w / 2, 0)
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  // 텍스처 좌표를 월드 크기에 맞춘다 (종이 결이 늘어나지 않게)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.45, uv.getY(i) * 0.45)
  return g
}

/** 결정적 의사난수 (집마다 매번 같은 모양이 나오게) */
export function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
