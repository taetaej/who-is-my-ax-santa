import { Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Look } from '../look'
import { Church } from './Church'
import { type CookieState } from './Cookie'
import { Batch } from './Batch'
import { Fade } from './Fade'
import { LiveCarolCount, LivePeers, LivePublisher, LiveSnow } from './live'
import { SnowHitOverlay, Snowballs } from './Snowballs'
import { SledHill } from './SledHill'
import { M, rng } from './materials'
import { Player, type PanelAction } from './Player'
import { Bench, BigTree, Bridge, FenceRing, Lamp, PineTree, Present, Snowman } from './props'
import { CarolCount, Spots, type TreeInfo } from './Spots'
import { Festive } from './Festive'
import { Elf } from './Elf'
import { Timeline } from './Timeline'
import { Party } from './Party'
import { DecoyMounds, GiftBoxes, type Burst } from './GiftBoxes'
import {
  GATE_ANGLE, ISLAND_R, LAMP_ANGLES, LAMP_R, PLAZA_R, POND_OUT, SNOWMAN, SPOT, VILLAGE_R,
  addTreeColliders, at, faceCenter, onSledRun, polar, type V3,
} from './world'

// 눈 덮인 산타마을. 집 없이 다같이 모이는 광장과 놀이 장소로 이루어져 있다 (world.ts 배치 참고)
//   광장(트리 섬 + 얼음 연못 + 다리 + 게시판) → 디딤돌 길 → 우체국·교회·핫초코 포차·눈밭·벤치·모닥불 → 숲 → 울타리 → 설원과 먼 산

// 해 질 녘 크리스마스 저녁: 짙은 파랑 하늘 + 노을빛 지평선. 전구와 불빛이 돋보인다
const SKY_TOP = new THREE.Color('#1d2b5a')
const SKY_HORIZON = new THREE.Color('#f2a98a')
const FOG = '#cfc5d9'

function Sky() {
  const ref = useRef<THREE.Mesh>(null)
  // 하늘 구는 카메라를 따라다닌다 (집 안 장면은 마을에서 멀리 떨어져 있어서)
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(180, 32, 16)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const h = THREE.MathUtils.clamp(pos.getY(i) / 120, 0, 1)
      c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(h, 0.6))
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])
  return (
    <mesh ref={ref} geometry={geo} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

function Landscape() {
  const geo = useMemo(() => {
    const r = rng(3)
    // 마을 바깥 눈 둔덕
    const mounds: THREE.BufferGeometry[] = []
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2
      const rad = 13 + r() * 30
      const s = 0.6 + r() * (rad > 20 ? 4 : 1)
      if (Math.abs(a - Math.PI / 2) < 0.45 && rad < 30) continue // 입구 앞 시야는 비운다
      const g = new THREE.SphereGeometry(1, 12, 6)
      g.scale(s, s * 0.3, s * (0.8 + r() * 0.4))
      g.translate(Math.cos(a) * rad, 0, Math.sin(a) * rad)
      mounds.push(g)
    }
    // 먼 산 (눈 덮인 봉우리)
    const rock: THREE.BufferGeometry[] = []
    const caps: THREE.BufferGeometry[] = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2
      const rad = 85 + r() * 25
      const h = 14 + r() * 22
      const w = 16 + r() * 14
      const m = new THREE.ConeGeometry(w, h, 7)
      m.translate(Math.cos(a) * rad, h / 2 - 1, Math.sin(a) * rad)
      rock.push(m)
      const c = new THREE.ConeGeometry(w * 0.42, h * 0.42, 7)
      c.translate(Math.cos(a) * rad, h - h * 0.21 - 0.9, Math.sin(a) * rad)
      caps.push(c)
    }
    // 바깥 숲 (멀리 띄엄띄엄)
    return {
      mounds: mergeGeometries(mounds)!,
      rock: mergeGeometries(rock)!,
      caps: mergeGeometries(caps)!,
    }
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={M.snow} receiveShadow>
        <circleGeometry args={[150, 96]} />
      </mesh>
      <mesh geometry={geo.mounds} material={M.snowShade} receiveShadow castShadow />
      <mesh geometry={geo.rock}>
        <meshStandardMaterial color="#8a9ab3" roughness={1} flatShading />
      </mesh>
      <mesh geometry={geo.caps} material={M.snow} />
    </group>
  )
}

function Ground() {
  const stones = useMemo(() => {
    const r = rng(5)
    const parts: THREE.BufferGeometry[] = []
    // 광장에서 각 장소로 가는 디딤돌
    for (const sp of [SPOT.post, SPOT.cocoa, SPOT.fire, SPOT.field, { a: -Math.PI / 2 }]) { // 마지막은 연대기 벽
      for (let k = 0; k < 8; k++) {
        const rr = PLAZA_R + 0.3 + k * 0.5
        const g = new THREE.CylinderGeometry(0.2 + r() * 0.05, 0.22, 0.06, 8)
        g.translate(Math.cos(sp.a) * rr + (k % 2 ? 0.12 : -0.12), 0.03, Math.sin(sp.a) * rr)
        parts.push(g.toNonIndexed())
      }
    }
    // 연못 둘레 돌
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2
      for (const rr of [ISLAND_R, POND_OUT]) {
        const s = 0.22 + r() * 0.12
        const g = new THREE.DodecahedronGeometry(s, 0)
        g.scale(1, 0.6, 1)
        g.translate(Math.cos(a) * rr, 0.06, Math.sin(a) * rr)
        parts.push(g)
      }
    }
    return mergeGeometries(parts)!
  }, [])
  return (
    <group>
      <mesh geometry={stones} material={M.stone} receiveShadow castShadow />
      {/* 광장 돌길 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={M.stoneDark} receiveShadow>
        <ringGeometry args={[POND_OUT + 0.25, 5.6, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} material={M.snowShade} receiveShadow>
        <ringGeometry args={[POND_OUT + 0.6, 5.2, 64]} />
      </mesh>
      {/* 얼어붙은 연못과 트리 섬 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={M.ice} receiveShadow>
        <ringGeometry args={[ISLAND_R, POND_OUT, 64]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={M.snow} receiveShadow castShadow>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R + 0.1, 0.12, 40]} />
      </mesh>
    </group>
  )
}

const FOREST = (() => {
  const r = rng(42)
  const list: { p: V3; h: number; seed: number }[] = []
  // 장소와 장소 사이 작은 숲
  ;[-0.22, 3.42].forEach((mid, c) => {
    for (let i = 0; i < 4; i++) {
      list.push({ p: polar(mid + (r() - 0.5) * 0.5, 9.8 + r() * 2.8), h: 1.9 + r() * 1.2, seed: c * 10 + i })
    }
  })
  // 울타리 안쪽 바깥 숲
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2
    const off = (b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    if (off(SPOT.church.a) < 0.32 || off(Math.PI / 2) < 0.22) continue // 입구 길도 비운다
    list.push({ p: polar(a, 13.6 + r() * 2.2), h: 1.8 + r() * 2.0, seed: 100 + i })
  }
  // 울타리 밖 숲 (충돌 없음)
  const outside: typeof list = []
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2
    if (Math.abs(a - Math.PI / 2) < 0.3) continue // 입구 길 앞은 비운다
    outside.push({ p: polar(a, 19 + r() * 22), h: 2.5 + r() * 3.5, seed: 300 + i })
  }
  // 🛷 눈썰매장 자리의 나무는 뺀다 (뽑는 순서는 그대로 둬야 다른 나무 자리가 안 바뀐다)
  const kept = list.filter((t) => !onSledRun(t.p[0], t.p[2]))
  addTreeColliders(kept)
  return [...kept, ...outside]
})()

function Forest() {
  return (
    <Batch>
      {FOREST.map((t) => (
        <PineTree key={t.seed} position={t.p} height={t.h} seed={t.seed} />
      ))}
    </Batch>
  )
}

function Plaza() {
  return (
    <group>
      <Fade x={0} z={0} r={2.2}>
        <Batch>
          <BigTree />
        </Batch>
      </Fade>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = i * 1.05 + 0.4
        return <Present key={i} position={polar(a, 1.35, 0.12)} m={i} size={0.28 + (i % 3) * 0.06} rotation={a} />
      })}
      <Bridge position={polar(Math.PI / 2, (ISLAND_R + POND_OUT) / 2)} rotation={Math.PI / 2} length={2.3} />
      <Bridge position={polar(-Math.PI / 2, (ISLAND_R + POND_OUT) / 2)} rotation={Math.PI / 2} length={2.3} />
      {LAMP_ANGLES.map((a, i) => (
        <Lamp key={a} position={polar(a, LAMP_R)} light={i % 2 === 0} />
      ))}
      <Snowman position={polar(SNOWMAN.a, SNOWMAN.r)} rotation={faceCenter(SNOWMAN.a) + Math.PI} scale={0.85} />
      <Bench position={polar(2.75, 4.7)} rotation={faceCenter(2.75) + Math.PI} />
      <Bench position={polar(4.1, 4.7)} rotation={faceCenter(4.1) + Math.PI} />
    </group>
  )
}

function FallingSnow() {
  const count = 1200
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const rr = Math.sqrt(Math.random()) * 26
      a[i * 3] = Math.cos(ang) * rr
      a[i * 3 + 1] = Math.random() * 18
      a[i * 3 + 2] = Math.sin(ang) * rr
    }
    return a
  }, [])
  useFrame(({ clock }, dt) => {
    const pos = ref.current?.geometry.attributes.position
    if (!pos) return
    const t = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const y = pos.getY(i) - dt * (0.6 + (i % 5) * 0.08)
      pos.setY(i, y < 0 ? 18 : y)
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.6 + i) * dt * 0.08)
    }
    pos.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.09} transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}

/** 로그인 전: 마을 전경을 천천히 한 바퀴 */
function OrbitRig() {
  const target = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(0, 1.2, 0), [])
  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime * 0.035 + Math.PI / 2
    target.set(Math.cos(t) * 30, 17, Math.sin(t) * 30)
    camera.position.lerp(target, Math.min(1, dt * 1.5))
    camera.lookAt(look)
  })
  return null
}

export type Resident = { id: number; name: string; look?: Look | null }
/** 🎀 보물찾기: hidden = 아직 열 수 있는 자리, duds = 내가 열어 본 꽝, glow = 구제 기간에 반짝일 자리, mine = 이미 찾음 */
export type Treasure = { hidden: string[]; duds: string[]; glow: string[]; mine: boolean; burst: Burst | null }

export function Village({
  me,
  inputEnabled,
  onPrompt,
  onOpen,
  onCarol,
  tree = null,
  elf = null,
  talking = false,
  overview = false,
  live = false,
  treasure = null,
  onTreasure,
}: {
  me: Resident | null
  inputEnabled: MutableRefObject<boolean>
  onPrompt: (text: string | null) => void
  onOpen: (panel: PanelAction) => void
  onCarol?: (level: number) => void
  tree?: TreeInfo | null // 메시지 트리에 걸린 카드 수와 오늘의 질문
  elf?: { alert: boolean; chatter: string[] } | null // 엘프 NPC (로그인했을 때만)
  talking?: boolean // 엘프와 대화 중 (카메라 클로즈업)
  overview?: boolean // 마을 전경 보기
  live?: boolean // true 면 LiveRoot 안에서 그려진다 (실시간 접속)
  treasure?: Treasure | null // 🎁 보물찾기: 남은 상자, 반짝임, 내가 이미 찾았는지
  onTreasure?: (box: string) => void // 상자 앞에서 E
}) {
  const treasureRef = useRef<Treasure | null>(treasure)
  treasureRef.current = treasure
  const dig = useRef(new Map<string, number>()) // 눈더미·얼음을 몇 번 팠는지 (Player 가 늘리고 GiftBoxes 가 그린다)
  const [online, setOnline] = useState<Set<number>>(() => new Set())
  const onOnline = useCallback((ids: Set<number>) => setOnline(ids), [])
  const myState = useRef<CookieState | null>(null)
  const here = me ? new Set([...online, me.id]).size : 0

  return (
    <div className="scene">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 17, 30], fov: 40, near: 0.3, far: 400 }}>
        <fog attach="fog" args={[FOG, 40, 160]} />
        <Sky />
        <hemisphereLight args={['#c4d2ff', '#9a8396', 0.75]} />
        <directionalLight
          position={[14, 24, 12]}
          intensity={1.35}
          color="#ffd2a6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-camera-near={1}
          shadow-camera-far={70}
        />

        <Landscape />
        <Ground />
        <Plaza />
        <Spots tree={tree} />
        <Festive />
        <Timeline />
        <Party />
        {elf && <Elf alert={elf.alert} chatter={elf.chatter} />}
        {me && <Snowballs />}
        <SledHill />
        {treasure && me && <DecoyMounds />}
        {treasure && me && <GiftBoxes hidden={treasure.hidden} duds={treasure.duds} glow={treasure.glow} dig={dig} me={myState} burst={treasure.burst} />}
        <Fade x={at(SPOT.church)[0]} z={at(SPOT.church)[2]} r={2.4}>
          <group position={at(SPOT.church)} rotation={[0, faceCenter(SPOT.church.a), 0]}>
            <Batch>
              <Church />
            </Batch>
          </group>
        </Fade>
        <Forest />
        {/* 앞쪽 대문 자리를 비우고 울타리를 두른다 */}
        <FenceRing radius={VILLAGE_R - 0.35} from={Math.PI / 2 + GATE_ANGLE} to={Math.PI * 2 + Math.PI / 2 - GATE_ANGLE} />

        {/* 실시간으로 접속한 사람들 */}
        {live && me && (
          <>
            <LivePeers meId={me.id} onOnline={onOnline} />
            <LivePublisher state={myState} look={me.look ?? null} />
            <LiveCarolCount meId={me.id} me={myState} />
            <LiveSnow />
          </>
        )}
        {!live && me && <CarolCount others={0} me={myState} />}

        {me ? (
          <Player name={me.name} seed={me.id} look={me.look} enabled={inputEnabled} onPrompt={onPrompt} onOpen={onOpen} onCarol={onCarol} talkingToElf={talking} overview={overview} share={myState} treasure={treasureRef} dig={dig} onTreasure={onTreasure} />
        ) : (
          <OrbitRig />
        )}

        <Sparkles count={260} scale={[34, 0.6, 34]} position={[0, 0.25, 0]} size={2.2} speed={0.15} opacity={0.9} color="#ffffff" />
        <FallingSnow />

        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} mipmapBlur radius={0.65} />
          <Vignette offset={0.25} darkness={0.5} />
        </EffectComposer>
      </Canvas>
      {live && me && <div className="online-count">🍪 지금 마을에 {here}명</div>}
      {me && <SnowHitOverlay />}
    </div>
  )
}
