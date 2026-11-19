import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import * as THREE from 'three'
import { DOUGHS, defaultLook, type Look } from '../look'
import { rng } from './materials'
import { inCarol } from './world'

// 진저브레드 쿠키 주민. 모델이 정적이라 걷기·인사는 코드로 팔다리를 흔들어 표현한다 (PRD 1.6).

/** 매 프레임 바깥(Player 등)에서 바꾸는 상태. 리렌더 없이 ref 로 읽는다. */
export type CookieState = {
  x: number
  z: number
  y: number // 점프 높이
  rot: number // 바라보는 방향 (Y 회전)
  speed: number // 0 이면 서 있음
  waveUntil: number // 이 시각(초)까지 손 흔들기
  say: string | null
  pose: Pose
  cup: boolean // 핫초코를 들고 있는지
}

export type Pose = 'stand' | 'sit' | 'lie'

export const newCookieState = (x = 0, z = 0, rot = 0): CookieState => ({ x, z, y: 0, rot, speed: 0, waveUntil: 0, say: null, pose: 'stand', cup: false })

const ICING = new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.4 })
const CHOCO = new THREE.MeshStandardMaterial({ color: '#3a1d0e', roughness: 0.5 })
const MUG = new THREE.MeshStandardMaterial({ color: '#f6efe4', roughness: 0.4 })
const COCOA = new THREE.MeshStandardMaterial({ color: '#5a2e15', roughness: 0.3 })
const PALETTE = ['#c62a24', '#2e7d4f', '#2f62b0', '#e0a21a', '#7a3fb0', '#e06a9a', '#1f8a8a']
const mats = new Map<string, THREE.MeshStandardMaterial>()
const paint = (c: string, roughness = 0.75) => {
  const key = `${c}/${roughness}`
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness }))
  return mats.get(key)!
}
const GOLD = new THREE.MeshStandardMaterial({ color: '#e8b53a', roughness: 0.25, metalness: 0.7 })
const ANTLER = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.8 })
const NOSE = new THREE.MeshStandardMaterial({ color: '#ff3b2a', emissive: '#ff2a1a', emissiveIntensity: 1.6, toneMapped: false })
const LENS = new THREE.MeshStandardMaterial({ color: '#1d1d22', roughness: 0.3, metalness: 0.4 })

export function Cookie({
  state,
  seed,
  name,
  me = false,
  dim = false,
  look: custom,
}: {
  state: MutableRefObject<CookieState>
  seed: number
  name?: string
  me?: boolean
  dim?: boolean
  look?: Look | null // 꾸민 모습. 없으면 번호로 정해지는 기본 모습
}) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const posed = useRef<THREE.Group>(null)
  const cup = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const tag = useRef<HTMLDivElement>(null)
  const phase = useRef(0)

  const lookKey = custom ? JSON.stringify(custom) : ''
  const look = useMemo(() => {
    const r = rng(seed + 3)
    const l = custom ?? defaultLook(seed)
    return {
      dough: paint(DOUGHS[l.dough].color, 0.8),
      scarf: paint(l.scarf),
      hat: l.hat,
      hatMat: l.hat === 'santa' ? paint('#c62a24') : paint(l.hatColor),
      extra: l.extra,
      buttons: [0, 1, 2].map(() => paint(PALETTE[Math.floor(r() * PALETTE.length)])),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, lookKey])

  useFrame(({ clock, camera }, dt) => {
    const s = state.current
    const g = root.current
    if (!g) return
    // 카메라가 아주 가까우면(클로즈업 시점) 이름표가 화면을 가려서 숨긴다
    if (tag.current) {
      const near = camera.position.distanceTo(g.position) < 5.6
      tag.current.style.opacity = near ? '0' : '1'
    }
    g.position.set(s.x, s.y, s.z)
    // 회전은 가장 짧은 쪽으로 부드럽게
    let diff = s.rot - g.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    g.rotation.y += diff * Math.min(1, dt * 12)

    const t = clock.elapsedTime
    const moving = s.speed > 0.05
    phase.current += dt * (moving ? 6 + s.speed * 2.2 : 0)
    const p = phase.current
    const swing = moving ? Math.sin(p) * 0.7 : 0
    legL.current!.rotation.x = swing
    legR.current!.rotation.x = -swing
    // 팔은 쿠키답게 옆으로 벌린 채 앞뒤로 흔든다
    armL.current!.rotation.x = -swing * 0.8
    armR.current!.rotation.x = swing * 0.8
    const waving = t < s.waveUntil
    armR.current!.rotation.z = waving ? 2.6 + Math.sin(t * 16) * 0.35 : 1.05
    armL.current!.rotation.z = -1.05
    legL.current!.rotation.z = 0
    legR.current!.rotation.z = 0
    // 걸을 때 통통 + 뒤뚱, 서 있을 땐 숨쉬기
    body.current!.position.y = moving ? Math.abs(Math.sin(p)) * 0.06 : Math.sin(t * 2 + seed) * 0.01
    body.current!.rotation.z = moving ? Math.sin(p) * 0.08 : 0
    // 캐롤 무대 앞에 서 있으면 음악에 맞춰 흔들흔들
    const groove = !moving && s.pose !== 'lie' && inCarol(s.x, s.z)
    if (groove) {
      const beat = t * 4.2 + seed
      body.current!.rotation.z = Math.sin(beat) * 0.13
      body.current!.position.y = Math.abs(Math.sin(beat)) * 0.05
      if (t >= s.waveUntil) armR.current!.rotation.z = 1.05 + Math.max(0, Math.sin(beat)) * 0.9
      armL.current!.rotation.z = -1.05 - Math.max(0, -Math.sin(beat)) * 0.9
    }

    // 자세: 앉기(모닥불), 눕기(눈밭 — 스노우엔젤)
    const pg = posed.current!
    if (s.pose === 'sit') {
      pg.position.set(0, 0.05, 0)
      pg.rotation.x = 0
      legL.current!.rotation.x = -1.35
      legR.current!.rotation.x = -1.25
      armL.current!.rotation.x = -0.5
      armR.current!.rotation.x = waving ? 0 : -0.5
      armL.current!.rotation.z = -0.5
      if (!waving) armR.current!.rotation.z = 0.5
      if (groove) {
        // 불가에 앉아서 박수 치듯 리듬
        const beat = t * 4.2 + seed
        armL.current!.rotation.x = -0.9 + Math.sin(beat) * 0.35
        if (!waving) armR.current!.rotation.x = -0.9 + Math.sin(beat) * 0.35
        armL.current!.rotation.z = -0.25 - Math.max(0, Math.sin(beat * 2)) * 0.2
        if (!waving) armR.current!.rotation.z = 0.25 + Math.max(0, Math.sin(beat * 2)) * 0.2
      }
    } else if (s.pose === 'lie') {
      pg.position.set(0, 0.1, 0.25)
      pg.rotation.x = -Math.PI / 2
      const flap = (Math.sin(t * 3 + seed) + 1) / 2 // 팔다리를 쓸었다 모았다
      armL.current!.rotation.z = -(1.0 + flap * 1.5)
      armR.current!.rotation.z = 1.0 + flap * 1.5
      legL.current!.rotation.z = -flap * 0.45
      legR.current!.rotation.z = flap * 0.45
      body.current!.position.y = 0
    } else {
      pg.position.set(0, 0, 0)
      pg.rotation.x = 0
    }
    if (cup.current) cup.current.visible = s.cup && s.pose !== 'lie'

    if (bubble.current) {
      bubble.current.style.opacity = s.say ? '1' : '0'
      if (s.say && bubble.current.textContent !== s.say) bubble.current.textContent = s.say
    }
  })

  return (
    <group ref={root}>
      <group ref={posed}>
      <group ref={body}>
        {/* 다리 (엉덩이 축) */}
        {[
          [legL, -0.085],
          [legR, 0.085],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as RefObject<THREE.Group>} position={[x as number, 0.3, 0]}>
            <mesh position={[0, -0.14, 0]} material={look.dough} scale={[1, 1, 0.6]} castShadow>
              <capsuleGeometry args={[0.075, 0.16, 4, 10]} />
            </mesh>
            <mesh position={[0, -0.2, 0.0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.5]} material={ICING}>
              <torusGeometry args={[0.07, 0.012, 6, 14, Math.PI]} />
            </mesh>
          </group>
        ))}
        {/* 몸통 */}
        <mesh position={[0, 0.44, 0]} material={look.dough} scale={[1, 1, 0.55]} castShadow>
          <capsuleGeometry args={[0.15, 0.12, 4, 14]} />
        </mesh>
        {look.buttons.map((m, i) => (
          <mesh key={i} position={[0, 0.5 - i * 0.08, 0.085]} material={m}>
            <sphereGeometry args={[0.028, 10, 8]} />
          </mesh>
        ))}
        {/* 팔 (어깨 축) */}
        {[
          [armL, -0.13],
          [armR, 0.13],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as RefObject<THREE.Group>} position={[x as number, 0.54, 0]}>
            <mesh position={[0, -0.12, 0]} material={look.dough} scale={[1, 1, 0.6]} castShadow>
              <capsuleGeometry args={[0.065, 0.14, 4, 10]} />
            </mesh>
            <mesh position={[0, -0.17, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.5]} material={ICING}>
              <torusGeometry args={[0.06, 0.011, 6, 14, Math.PI]} />
            </mesh>
            {(x as number) > 0 && (
              // 핫초코 머그 (오른손)
              <group ref={cup} position={[0, -0.24, 0.04]} rotation={[0, 0, -1.05]} visible={false}>
                <mesh material={MUG}>
                  <cylinderGeometry args={[0.06, 0.055, 0.12, 12]} />
                </mesh>
                <mesh position={[0, 0.061, 0]} rotation={[-Math.PI / 2, 0, 0]} material={COCOA}>
                  <circleGeometry args={[0.052, 12]} />
                </mesh>
                <mesh position={[0, 0.07, 0]} material={ICING}>
                  <boxGeometry args={[0.03, 0.025, 0.03]} />
                </mesh>
              </group>
            )}
          </group>
        ))}
        {/* 머리 */}
        <group position={[0, 0.74, 0]}>
          <mesh material={look.dough} scale={[1, 0.95, 0.62]} castShadow>
            <sphereGeometry args={[0.17, 20, 16]} />
          </mesh>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.03, 0.1]} material={CHOCO}>
              <sphereGeometry args={[0.022, 10, 8]} />
            </mesh>
          ))}
          <mesh position={[0, -0.035, 0.098]} rotation={[0, 0, Math.PI]} material={ICING}>
            <torusGeometry args={[0.055, 0.011, 6, 14, Math.PI]} />
          </mesh>
          {/* 볼터치 */}
          {[-0.1, 0.1].map((x) => (
            <mesh key={`c${x}`} position={[x, -0.02, 0.085]} scale={[1, 0.7, 0.3]}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <meshStandardMaterial color="#e2665a" roughness={0.6} />
            </mesh>
          ))}
          {look.hat === 'santa' && (
            <group position={[0, 0.12, -0.01]} rotation={[-0.25, 0, 0.15]}>
              <mesh position={[0, 0.1, 0]} material={look.hatMat} castShadow>
                <coneGeometry args={[0.14, 0.26, 14]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={ICING}>
                <torusGeometry args={[0.135, 0.035, 8, 18]} />
              </mesh>
              <mesh position={[0, 0.24, 0]} material={ICING}>
                <sphereGeometry args={[0.04, 10, 8]} />
              </mesh>
            </group>
          )}
          {look.hat === 'beanie' && (
            <group position={[0, 0.07, 0]}>
              <mesh material={look.hatMat} scale={[1, 0.8, 0.75]} castShadow>
                <sphereGeometry args={[0.165, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.14, 0]} material={ICING}>
                <sphereGeometry args={[0.045, 10, 8]} />
              </mesh>
            </group>
          )}
          {look.hat === 'antlers' && (
            <group>
              {[-1, 1].map((sx) => (
                <group key={sx} position={[sx * 0.08, 0.13, -0.02]} rotation={[0, 0, -sx * 0.35]}>
                  <mesh position={[0, 0.08, 0]} material={ANTLER} castShadow>
                    <cylinderGeometry args={[0.014, 0.02, 0.17, 6]} />
                  </mesh>
                  <mesh position={[sx * 0.04, 0.13, 0]} rotation={[0, 0, -sx * 0.9]} material={ANTLER}>
                    <cylinderGeometry args={[0.011, 0.014, 0.09, 6]} />
                  </mesh>
                  <mesh position={[-sx * 0.025, 0.1, 0]} rotation={[0, 0, sx * 0.8]} material={ANTLER}>
                    <cylinderGeometry args={[0.01, 0.012, 0.07, 6]} />
                  </mesh>
                </group>
              ))}
              {/* 루돌프 코 */}
              <mesh position={[0, -0.005, 0.11]} material={NOSE}>
                <sphereGeometry args={[0.028, 10, 8]} />
              </mesh>
            </group>
          )}
          {look.hat === 'crown' && (
            <group position={[0, 0.13, 0]}>
              <mesh material={GOLD} castShadow>
                <cylinderGeometry args={[0.1, 0.11, 0.07, 16, 1, true]} />
              </mesh>
              {Array.from({ length: 6 }, (_, i) => {
                const a = (i / 6) * Math.PI * 2
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1]} material={GOLD}>
                    <coneGeometry args={[0.022, 0.06, 6]} />
                  </mesh>
                )
              })}
              <mesh position={[0, 0.0, 0.105]} material={paint('#c62a24', 0.3)}>
                <sphereGeometry args={[0.018, 8, 6]} />
              </mesh>
            </group>
          )}
          {look.hat === 'earmuffs' && (
            <group>
              <mesh position={[0, 0.02, 0]} rotation={[0, 0, 0]} material={look.hatMat} castShadow>
                <torusGeometry args={[0.175, 0.016, 6, 20, Math.PI]} />
              </mesh>
              {[-1, 1].map((sx) => (
                <mesh key={sx} position={[sx * 0.17, 0.0, 0]} material={ICING} scale={[0.7, 1, 1]}>
                  <sphereGeometry args={[0.055, 10, 8]} />
                </mesh>
              ))}
            </group>
          )}
          {look.extra === 'glasses' && (
            <group position={[0, 0.03, 0.108]}>
              {[-0.06, 0.06].map((x) => (
                <mesh key={x} position={[x, 0, 0]} material={LENS}>
                  <torusGeometry args={[0.038, 0.007, 6, 16]} />
                </mesh>
              ))}
              <mesh material={LENS}>
                <boxGeometry args={[0.04, 0.008, 0.008]} />
              </mesh>
            </group>
          )}
          {look.extra === 'bow' && (
            <group position={[0.11, 0.11, 0.02]} rotation={[0, 0, -0.5]}>
              {[-1, 1].map((sx) => (
                <mesh key={sx} position={[sx * 0.035, 0, 0]} rotation={[0, 0, (sx * Math.PI) / 2]} material={paint('#e8436a', 0.5)}>
                  <coneGeometry args={[0.03, 0.06, 8]} />
                </mesh>
              ))}
              <mesh material={paint('#e8436a', 0.5)}>
                <sphereGeometry args={[0.015, 8, 6]} />
              </mesh>
            </group>
          )}
          {look.extra === 'star' && (
            <mesh position={[-0.11, 0.1, 0.04]} rotation={[0, 0, 0.3]} material={GOLD}>
              <octahedronGeometry args={[0.035, 0]} />
            </mesh>
          )}
        </group>
        {/* 목도리 */}
        <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]} material={look.scarf} castShadow>
          <torusGeometry args={[0.11, 0.04, 8, 18]} />
        </mesh>
        <mesh position={[0.06, 0.52, 0.07]} rotation={[0.1, 0, 0.2]} material={look.scarf}>
          <boxGeometry args={[0.06, 0.14, 0.03]} />
        </mesh>
        {look.extra === 'bell' && (
          <mesh position={[-0.03, 0.53, 0.1]} material={GOLD}>
            <sphereGeometry args={[0.032, 10, 8]} />
          </mesh>
        )}
      </group>
      </group>

      {/* 그림자 대신 발밑 원 (내 캐릭터는 눈에 띄게) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color={me ? '#ffcf4a' : '#000000'} transparent opacity={me ? 0.55 : 0.12} depthWrite={false} />
      </mesh>

      {name && (
        <Html position={[0, 1.15, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={tag} className={`tag${me ? ' me' : ''}${dim ? ' dim' : ''}`} style={{ transition: 'opacity 0.3s' }}>
            {me ? `${name} (나)` : name}
          </div>
          <div ref={bubble} className="bubble" />
        </Html>
      )}
    </group>
  )
}
