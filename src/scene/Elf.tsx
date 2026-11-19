import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ELF } from './world'

// 🧝 AX 엘프: 광장에 서서 할 일을 챙겨 주는 잔소리꾼. 할 일이 남아 있으면 머리 위에 ❗가 뜬다.

const GREEN = new THREE.MeshStandardMaterial({ color: '#2e8a52', roughness: 0.7 })
const DARK_GREEN = new THREE.MeshStandardMaterial({ color: '#1f5e38', roughness: 0.7 })
const RED = new THREE.MeshStandardMaterial({ color: '#c62a24', roughness: 0.6 })
const SKIN = new THREE.MeshStandardMaterial({ color: '#f6c9a4', roughness: 0.6 })
const WHITE = new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.5 })
const EYE = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.4 })
const GOLD = new THREE.MeshStandardMaterial({ color: '#e8b53a', roughness: 0.25, metalness: 0.7 })

export function Elf({ alert, chatter }: { alert: boolean; chatter: string[] }) {
  // 혼잣말: 4초 말하고 4초 쉬고, 다음 말
  const [line, setLine] = useState<string | null>(null)
  const key = chatter.join('|')
  useEffect(() => {
    const list = key ? key.split('|') : []
    if (!list.length) return setLine(null)
    let i = 0
    let on = false
    const tick = () => {
      on = !on
      setLine(on ? list[i++ % list.length] : null)
    }
    const t = setInterval(tick, 4000)
    tick()
    return () => clearInterval(t)
  }, [key])
  const body = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    const g = body.current
    if (!g) return
    // 통통 튀며 카메라 쪽을 본다
    g.position.y = Math.abs(Math.sin(t * 2.4)) * (alert ? 0.08 : 0.03)
    g.rotation.y = Math.atan2(camera.position.x - ELF.x, camera.position.z - ELF.z) * 0.6
    // 할 일이 남았으면 손을 흔들어 부른다
    if (arm.current) arm.current.rotation.z = alert ? 2.3 + Math.sin(t * 9) * 0.4 : 0.6 + Math.sin(t * 1.5) * 0.1
  })
  return (
    <group position={[ELF.x, 0, ELF.z]}>
      <group ref={body}>
        {/* 다리와 신발 */}
        {[-0.07, 0.07].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.14, 0]} material={RED}>
              <cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />
            </mesh>
            <mesh position={[0, 0.03, 0.04]} rotation={[0.3, 0, 0]} material={DARK_GREEN}>
              <coneGeometry args={[0.055, 0.16, 8]} />
            </mesh>
          </group>
        ))}
        {/* 옷 (종 모양) */}
        <mesh position={[0, 0.42, 0]} material={GREEN} castShadow>
          <coneGeometry args={[0.2, 0.42, 12]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]} material={WHITE}>
          <torusGeometry args={[0.18, 0.03, 6, 18]} />
        </mesh>
        <mesh position={[0, 0.36, 0]} material={GOLD}>
          <torusGeometry args={[0.13, 0.015, 6, 16]} />
        </mesh>
        {/* 팔 */}
        <group position={[-0.12, 0.54, 0]} rotation={[0, 0, -0.6]}>
          <mesh position={[0, -0.1, 0]} material={GREEN}>
            <capsuleGeometry args={[0.03, 0.14, 4, 8]} />
          </mesh>
        </group>
        <group ref={arm} position={[0.12, 0.54, 0]}>
          <mesh position={[0, -0.1, 0]} material={GREEN}>
            <capsuleGeometry args={[0.03, 0.14, 4, 8]} />
          </mesh>
          <mesh position={[0, -0.2, 0]} material={SKIN}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        </group>
        {/* 머리 */}
        <group position={[0, 0.74, 0]}>
          <mesh material={SKIN} castShadow>
            <sphereGeometry args={[0.15, 16, 12]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.16, 0.02, 0]} rotation={[0, 0, -sx * 1.2]} material={SKIN}>
              <coneGeometry args={[0.04, 0.16, 6]} />
            </mesh>
          ))}
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.135]} material={EYE}>
              <sphereGeometry args={[0.02, 8, 6]} />
            </mesh>
          ))}
          <mesh position={[0, -0.04, 0.14]} material={RED}>
            <sphereGeometry args={[0.02, 8, 6]} />
          </mesh>
          {/* 모자 */}
          <group position={[0, 0.1, 0]} rotation={[-0.3, 0, 0.2]}>
            <mesh position={[0, 0.14, 0]} material={RED} castShadow>
              <coneGeometry args={[0.15, 0.34, 14]} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={WHITE}>
              <torusGeometry args={[0.14, 0.035, 8, 18]} />
            </mesh>
            <mesh position={[0, 0.32, 0]} material={GOLD}>
              <sphereGeometry args={[0.045, 10, 8]} />
            </mesh>
          </group>
        </group>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.28, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <Html position={[0, 1.35, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="elf-head">
          {alert && <div className="elf-alert">❗</div>}
          {line && <div className="elf-bubble">{line}</div>}
          <div className="tag elf-tag">🧝 AX 엘프</div>
        </div>
      </Html>
    </group>
  )
}
