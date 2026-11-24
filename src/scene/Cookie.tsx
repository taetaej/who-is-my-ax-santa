import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import * as THREE from 'three'
import { DOUGHS, cleanLook, defaultLook, type Look } from '../look'
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
const HEART = new THREE.MeshStandardMaterial({ color: '#e0324a', roughness: 0.35 })
const CANDY = new THREE.MeshStandardMaterial({ color: '#d8252f', roughness: 0.35 })
const PINK = new THREE.MeshStandardMaterial({ color: '#f2a0a8', roughness: 0.6 })
const BLUSH = new THREE.MeshStandardMaterial({ color: '#f07f86', roughness: 0.7, transparent: true, opacity: 0.85 })
const FRECKLE = new THREE.MeshStandardMaterial({ color: '#7a3d1c', roughness: 0.7 })
const SHINE = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const MOUTH_IN = new THREE.MeshStandardMaterial({ color: '#5a1f1c', roughness: 0.6, side: THREE.DoubleSide })

// 몸 비율: 큰 머리 + 짧고 통통한 몸 (2.5등신 쯤)
const BODY_Y = 0.33
const BODY_R = 0.2
const BODY_Z = 0.72 // 쿠키라 앞뒤로 납작
const NECK_Y = 0.52
const HEAD_Y = 0.75
const HEAD_R = 0.25
const [HEAD_SX, HEAD_SY, HEAD_SZ] = [1.05, 0.93, 0.75]
const HAT_SCALE: [number, number, number] = [1.5, 1.42, 1.5] // 예전 머리(반지름 0.17)에 맞춘 모자를 지금 머리에 맞게

const ell = (x: number, y: number, rx: number, ry: number, rz: number) => rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2))
/** 몸 앞면의 z (장식을 겉에 붙이려고) */
const onBody = (x: number, dy: number) => ell(x, dy, BODY_R, BODY_R * 0.95, BODY_R * BODY_Z) - 0.004
/** 머리 앞면의 z */
const onHead = (x: number, y: number) => ell(x, y, HEAD_R * HEAD_SX, HEAD_R * HEAD_SY, HEAD_R * HEAD_SZ) - 0.004

type FaceLook = Pick<Look, 'eyes' | 'mouth' | 'cheek' | 'hat' | 'extra'>

/** 얼굴: 눈·입·볼 (+ 루돌프 코, 안경) */
function Face({ look }: { look: FaceLook }) {
  const EX = 0.085
  const EY = 0.035
  const eye = (side: -1 | 1) => {
    const x = side * EX
    const z = onHead(x, EY)
    const kind = look.eyes === 'wink' ? (side === 1 ? 'happy' : 'sparkle') : look.eyes
    if (kind === 'happy' || kind === 'sleepy')
      // ^ (웃는 눈) / ‿ (졸린 눈)
      return (
        <mesh key={side} position={[x, EY - (kind === 'sleepy' ? 0.01 : 0), z]} rotation={[0, 0, kind === 'sleepy' ? Math.PI : 0]} material={CHOCO}>
          <torusGeometry args={[0.028, 0.009, 6, 14, Math.PI]} />
        </mesh>
      )
    const r = kind === 'sparkle' ? 0.038 : 0.03
    return (
      <group key={side} position={[x, EY, z]}>
        <mesh scale={[1, 1.12, 0.45]} material={CHOCO}>
          <sphereGeometry args={[r, 14, 12]} />
        </mesh>
        <mesh position={[r * 0.35, r * 0.4, r * 0.4]} material={SHINE}>
          <sphereGeometry args={[kind === 'sparkle' ? 0.013 : 0.008, 8, 6]} />
        </mesh>
        {kind === 'sparkle' && (
          <mesh position={[-r * 0.35, -r * 0.35, r * 0.4]} material={SHINE}>
            <sphereGeometry args={[0.006, 6, 5]} />
          </mesh>
        )}
      </group>
    )
  }
  const MY = -0.065
  const mz = onHead(0, MY)
  return (
    <group>
      {eye(-1)}
      {eye(1)}
      {look.mouth === 'smile' && (
        <mesh position={[0, MY + 0.025, mz]} rotation={[0, 0, Math.PI]} material={ICING}>
          <torusGeometry args={[0.045, 0.011, 6, 16, Math.PI]} />
        </mesh>
      )}
      {look.mouth === 'open' && (
        <group position={[0, MY + 0.012, mz + 0.002]}>
          <mesh material={MOUTH_IN}>
            <circleGeometry args={[0.042, 16, Math.PI, Math.PI]} />
          </mesh>
          <mesh position={[0, -0.022, 0.001]} scale={[1, 0.5, 1]} material={PINK}>
            <circleGeometry args={[0.022, 12]} />
          </mesh>
        </group>
      )}
      {look.mouth === 'cat' &&
        [-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.022, MY + 0.012, mz]} rotation={[0, 0, Math.PI]} material={ICING}>
            <torusGeometry args={[0.022, 0.009, 6, 12, Math.PI]} />
          </mesh>
        ))}
      {look.mouth === 'o' && (
        <mesh position={[0, MY, mz]} material={ICING}>
          <torusGeometry args={[0.02, 0.009, 6, 14]} />
        </mesh>
      )}
      {look.cheek === 'pink' &&
        [-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.15, -0.025, onHead(sx * 0.15, -0.025)]} scale={[1.3, 0.8, 0.25]} material={BLUSH}>
            <sphereGeometry args={[0.03, 12, 8]} />
          </mesh>
        ))}
      {look.cheek === 'freckle' &&
        [-1, 1].flatMap((sx) =>
          [
            [0.13, -0.02],
            [0.16, -0.035],
            [0.145, -0.05],
          ].map(([x, y]) => (
            <mesh key={`${sx}${x}`} position={[sx * x, y, onHead(sx * x, y)]} material={FRECKLE}>
              <sphereGeometry args={[0.007, 6, 5]} />
            </mesh>
          )),
        )}
      {look.hat === 'antlers' && (
        // 루돌프 코
        <mesh position={[0, -0.015, onHead(0, -0.015) + 0.012]} material={NOSE}>
          <sphereGeometry args={[0.032, 12, 10]} />
        </mesh>
      )}
      {look.extra === 'glasses' && (
        <group position={[0, EY, onHead(EX, EY) + 0.012]}>
          {[-EX, EX].map((x) => (
            <mesh key={x} position={[x, 0, 0]} material={LENS}>
              <torusGeometry args={[0.05, 0.008, 6, 18]} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.01]} material={LENS}>
            <boxGeometry args={[0.04, 0.009, 0.009]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

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
    // 다른 사람 모습은 실시간(예전 화면 포함)으로도 오니 한 번 더 정리한다
    const l = custom ? cleanLook(custom, seed) : defaultLook(seed)
    return {
      ...l,
      dough: paint(DOUGHS[l.dough].color, 0.8),
      scarf: paint(l.scarf),
      hatMat: l.hat === 'santa' ? paint('#c62a24') : paint(l.hatColor),
      buttons: [0, 1, 2].map(() => paint(PALETTE[Math.floor(r() * PALETTE.length)], 0.35)),
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
        {/* 다리 (엉덩이 축): 짧고 통통하게 */}
        {[
          [legL, -0.095],
          [legR, 0.095],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as RefObject<THREE.Group>} position={[x as number, 0.2, 0]}>
            <mesh position={[0, -0.08, 0]} material={look.dough} scale={[1, 1, 0.75]} castShadow>
              <capsuleGeometry args={[0.085, 0.05, 6, 12]} />
            </mesh>
            <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]} material={ICING}>
              <torusGeometry args={[0.078, 0.012, 6, 16, Math.PI]} />
            </mesh>
          </group>
        ))}
        {/* 몸통: 동글 통통 */}
        <mesh position={[0, BODY_Y, 0]} material={look.dough} scale={[1, 0.95, BODY_Z]} castShadow>
          <sphereGeometry args={[BODY_R, 22, 18]} />
        </mesh>
        {look.deco === 'buttons' &&
          [0.07, -0.01, -0.09].map((dy, i) => (
            <mesh key={i} position={[0, BODY_Y + dy, onBody(0, dy)]} scale={[1, 1, 0.6]} material={look.buttons[i]}>
              <sphereGeometry args={[0.03, 10, 8]} />
            </mesh>
          ))}
        {look.deco === 'heart' && (
          <group position={[0, BODY_Y + 0.01, onBody(0, 0.01)]} scale={[1, 1, 0.45]}>
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * 0.028, 0.018, 0]} material={HEART}>
                <sphereGeometry args={[0.036, 12, 10]} />
              </mesh>
            ))}
            <mesh position={[0, -0.02, 0]} rotation={[0, 0, Math.PI / 4]} material={HEART}>
              <boxGeometry args={[0.058, 0.058, 0.05]} />
            </mesh>
          </group>
        )}
        {look.deco === 'star' && (
          <mesh position={[0, BODY_Y + 0.01, onBody(0, 0.01)]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1, 0.35]} material={GOLD}>
            <octahedronGeometry args={[0.05, 0]} />
          </mesh>
        )}
        {look.extra === 'cape' && (
          <mesh position={[0, BODY_Y + 0.02, -BODY_R * BODY_Z - 0.015]} rotation={[0.12, 0, 0]} material={look.scarf} castShadow>
            <boxGeometry args={[0.34, 0.36, 0.02]} />
          </mesh>
        )}
        {/* 팔 (어깨 축): 짤막하게 */}
        {[
          [armL, -0.17],
          [armR, 0.17],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as RefObject<THREE.Group>} position={[x as number, 0.44, 0]}>
            <mesh position={[0, -0.075, 0]} material={look.dough} scale={[1, 1, 0.75]} castShadow>
              <capsuleGeometry args={[0.068, 0.05, 6, 12]} />
            </mesh>
            {look.extra === 'mittens' ? (
              <mesh position={[0, -0.13, 0]} material={look.scarf} castShadow>
                <sphereGeometry args={[0.072, 12, 10]} />
              </mesh>
            ) : (
              <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]} material={ICING}>
                <torusGeometry args={[0.062, 0.011, 6, 14, Math.PI]} />
              </mesh>
            )}
            {(x as number) < 0 && look.extra === 'candy' && (
              // 지팡이 사탕 (왼손)
              <group position={[0, -0.15, 0.04]} rotation={[0, 0, 1.05]}>
                <mesh material={ICING}>
                  <cylinderGeometry args={[0.016, 0.016, 0.22, 8]} />
                </mesh>
                {[-0.08, -0.03, 0.02, 0.07].map((y) => (
                  <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={CANDY}>
                    <torusGeometry args={[0.017, 0.006, 6, 10]} />
                  </mesh>
                ))}
                <mesh position={[0.035, 0.11, 0]} material={CANDY}>
                  <torusGeometry args={[0.035, 0.016, 8, 14, Math.PI]} />
                </mesh>
              </group>
            )}
            {(x as number) > 0 && (
              // 핫초코 머그 (오른손)
              <group ref={cup} position={[0, -0.16, 0.04]} rotation={[0, 0, -1.05]} visible={false}>
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
        {/* 머리: 크고 동그랗게 (몸보다 크게 = 귀여운 비율) */}
        <group position={[0, HEAD_Y, 0]}>
          <mesh material={look.dough} scale={[HEAD_SX, HEAD_SY, HEAD_SZ]} castShadow>
            <sphereGeometry args={[HEAD_R, 26, 20]} />
          </mesh>
          <Face look={look} />
          {/* 모자·머리 장식은 예전 머리(반지름 0.17) 기준으로 만든 걸 키워서 씌운다 */}
          <group scale={HAT_SCALE} position={[0, 0.01, 0]}>
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
              <group position={[0, 0.06, 0]}>
                <mesh material={look.hatMat} scale={[1.02, 0.85, 0.82]} castShadow>
                  <sphereGeometry args={[0.165, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                </mesh>
                <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]} material={look.hatMat}>
                  <torusGeometry args={[0.163, 0.022, 6, 20]} />
                </mesh>
                <mesh position={[0, 0.15, 0]} material={ICING}>
                  <sphereGeometry args={[0.048, 10, 8]} />
                </mesh>
              </group>
            )}
            {look.hat === 'elf' && (
              <group position={[0, 0.11, -0.01]} rotation={[-0.35, 0, -0.25]}>
                <mesh position={[0, 0.14, 0]} material={look.hatMat} castShadow>
                  <coneGeometry args={[0.14, 0.32, 14]} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={look.hatMat}>
                  <torusGeometry args={[0.135, 0.028, 8, 18]} />
                </mesh>
                <mesh position={[0, 0.31, 0]} material={GOLD}>
                  <sphereGeometry args={[0.032, 10, 8]} />
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
              </group>
            )}
            {look.hat === 'cat' && (
              <group>
                {[-1, 1].map((sx) => (
                  <group key={sx} position={[sx * 0.1, 0.13, 0]} rotation={[0, 0, -sx * 0.4]}>
                    <mesh material={look.dough} scale={[1, 1, 0.55]} castShadow>
                      <coneGeometry args={[0.055, 0.1, 4]} />
                    </mesh>
                    <mesh position={[0, -0.008, 0.02]} scale={[1, 1, 0.3]} material={PINK}>
                      <coneGeometry args={[0.032, 0.065, 4]} />
                    </mesh>
                  </group>
                ))}
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
            {(look.hat === 'earmuffs' || look.hat === 'headphones') && (
              <group>
                <mesh position={[0, 0.02, 0]} material={look.hatMat} castShadow>
                  <torusGeometry args={[0.178, look.hat === 'headphones' ? 0.02 : 0.016, 6, 20, Math.PI]} />
                </mesh>
                {[-1, 1].map((sx) =>
                  look.hat === 'earmuffs' ? (
                    <mesh key={sx} position={[sx * 0.17, 0.0, 0]} material={ICING} scale={[0.7, 1, 1]}>
                      <sphereGeometry args={[0.055, 10, 8]} />
                    </mesh>
                  ) : (
                    <mesh key={sx} position={[sx * 0.172, 0.0, 0]} rotation={[0, 0, Math.PI / 2]} material={look.hatMat}>
                      <cylinderGeometry args={[0.058, 0.058, 0.045, 16]} />
                    </mesh>
                  ),
                )}
              </group>
            )}
            {look.extra === 'bow' && (
              <group position={[0.12, 0.12, 0.03]} rotation={[0, 0, -0.5]}>
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
        </group>
        {/* 목도리 (머리와 몸 사이) */}
        <mesh position={[0, NECK_Y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.75, 1]} material={look.scarf} castShadow>
          <torusGeometry args={[0.15, 0.045, 8, 20]} />
        </mesh>
        <mesh position={[0.08, NECK_Y - 0.08, 0.12]} rotation={[0.25, 0, 0.2]} material={look.scarf}>
          <boxGeometry args={[0.065, 0.13, 0.03]} />
        </mesh>
        {look.extra === 'bell' && (
          <mesh position={[-0.04, NECK_Y - 0.05, 0.15]} material={GOLD}>
            <sphereGeometry args={[0.035, 10, 8]} />
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
        <Html position={[0, 1.3, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={tag} className={`tag${me ? ' me' : ''}${dim ? ' dim' : ''}`} style={{ transition: 'opacity 0.3s' }}>
            {me ? `${name} (나)` : name}
          </div>
          <div ref={bubble} className="bubble" />
        </Html>
      )}
    </group>
  )
}
