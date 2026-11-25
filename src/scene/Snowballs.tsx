import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { M } from './materials'
import { Snowman } from './props'
import { TARGETS, snow, stepSnow } from './snowball'

// ☃️ 눈싸움 장면: 날아가는 눈덩이, 부딪힌 자리의 눈 튀김, 눈밭 가장자리의 과녁 눈사람.
// 움직임 계산은 snowball.ts 의 stepSnow, 여기는 그리기만 한다.

const MAX_BALLS = 40
const MAX_SPLATS = 24
const BITS = 7 // 눈 튀김 한 번에 날리는 알갱이 수
const tmp = new THREE.Object3D()
const BIT_DIRS = Array.from({ length: BITS }, (_, i) => {
  const a = (i / BITS) * Math.PI * 2
  return new THREE.Vector3(Math.cos(a), 0.7 + (i % 3) * 0.25, Math.sin(a)).normalize()
})

export function Snowballs() {
  const balls = useRef<THREE.InstancedMesh>(null)
  const bits = useRef<THREE.InstancedMesh>(null)
  const targets = useRef<(THREE.Group | null)[]>([])
  const ballGeo = useMemo(() => new THREE.SphereGeometry(0.11, 10, 8), [])
  const bitGeo = useMemo(() => new THREE.SphereGeometry(0.05, 6, 5), [])

  useFrame((_, rawDt) => {
    stepSnow(Math.min(rawDt, 0.05))
    const bm = balls.current
    if (bm) {
      bm.count = Math.min(snow.balls.length, MAX_BALLS)
      snow.balls.slice(-MAX_BALLS).forEach((b, i) => {
        tmp.position.set(b.x, b.y, b.z)
        tmp.scale.setScalar(b.big ? 2.2 : 1) // 💥 왕눈덩이
        tmp.updateMatrix()
        bm.setMatrixAt(i, tmp.matrix)
      })
      bm.instanceMatrix.needsUpdate = true
    }
    const tm = bits.current
    if (tm) {
      let n = 0
      for (const s of snow.splats.slice(-MAX_SPLATS)) {
        const k = s.age / 0.6
        for (const d of BIT_DIRS) {
          const r = 0.12 + k * 0.55
          tmp.position.set(s.x + d.x * r, Math.max(0.03, s.y + d.y * r * 0.8 - k * k * 0.5), s.z + d.z * r)
          tmp.scale.setScalar(1 - k * 0.8)
          tmp.updateMatrix()
          tm.setMatrixAt(n++, tmp.matrix)
        }
      }
      tm.count = n
      tm.instanceMatrix.needsUpdate = true
    }
    // 맞은 과녁은 잠깐 흔들린다
    targets.current.forEach((g, i) => {
      if (!g) return
      const w = snow.wobble[i]
      g.rotation.z = w > 0 ? Math.sin(w * 28) * 0.18 * (w / 0.7) : 0
    })
  })

  return (
    <group>
      <instancedMesh ref={balls} args={[ballGeo, M.snow, MAX_BALLS]} castShadow frustumCulled={false} />
      <instancedMesh ref={bits} args={[bitGeo, M.snow, MAX_SPLATS * BITS]} frustumCulled={false} />
      {TARGETS.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[0, t.face, 0]}>
          <group ref={(g) => void (targets.current[i] = g)}>
            <Snowman position={[0, 0, 0]} scale={0.62} />
            {/* 배에 과녁 */}
            <mesh position={[0, 0.3, 0.29]} material={M.ribbon}>
              <circleGeometry args={[0.17, 24]} />
            </mesh>
            <mesh position={[0, 0.3, 0.295]} material={M.snow}>
              <circleGeometry args={[0.11, 24]} />
            </mesh>
            <mesh position={[0, 0.3, 0.3]} material={M.ribbon}>
              <circleGeometry args={[0.05, 16]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

/** 내가 맞았을 때 화면 가장자리에 눈이 묻었다 사라진다 (3D 밖, 화면 위) */
export function SnowHitOverlay() {
  const [key, setKey] = useState(0)
  useEffect(() => {
    snow.onHit = () => setKey((k) => k + 1)
    return () => {
      snow.onHit = null
    }
  }, [])
  if (!key) return null
  return <div key={key} className="snow-hit" aria-hidden />
}
