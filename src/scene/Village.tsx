import { Snapshot } from './Snapshot'
import { Pets } from './Pets'
import { Chimney, GlowPools, SledLights } from './Warmth'
import { Users } from '@phosphor-icons/react'
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
import { SPACE_FOG, SpaceBackdrop } from './Space'
import { Arena, RollField } from './Zones'
import { Decor, onCrystal } from './Decor'
import { XpBoard } from './Boards'
import { M, rng } from './materials'
import { Player, type PanelAction } from './Player'
import { Bench, BigTree, Bridge, Lamp, PineTree, Present, Snowman } from './props'
import { CarolCount, Spots, type TreeInfo } from './Spots'
import { Festive } from './Festive'
import { Elf } from './Elf'
import { Timeline } from './Timeline'
import { Party } from './Party'
import { DecoyMounds, GiftBoxes, type Burst } from './GiftBoxes'
import {
  ARENA, ISLAND_R, LAMP_ANGLES, LAMP_R, PLAZA_R, POND_OUT, ROLL, SNOWMAN, SPOT,
  addTreeColliders, at, faceCenter, inGate, onDecor, onPath, onSledRun, polar, type V3,
} from './world'

// 눈 덮인 산타마을. 집 없이 다같이 모이는 광장과 놀이 장소로 이루어져 있다 (world.ts 배치 참고)
//   광장(트리 섬 + 얼음 연못 + 다리 + 게시판) → 디딤돌 길 → 우체국·교회·핫초코 포차·눈밭·벤치·모닥불 → 숲 → 등불 기둥 → 바깥 링(놀이 구역·썰매 산·로켓) → 떠 있는 섬 가장자리

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
  // 등불 기둥 안쪽 숲
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2
    const off = (b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    if (off(SPOT.church.a) < 0.32 || off(Math.PI / 2) < 0.22) continue // 입구 길도 비운다
    list.push({ p: polar(a, 13.6 + r() * 2.2), h: 1.8 + r() * 2.0, seed: 100 + i })
  }
  // 🪐 등불 기둥 밖 링의 숲 (놀이 구역·문 앞 길·썰매 길은 비운다)
  const outside: typeof list = []
  for (let i = 0; i < 110 && outside.length < 70; i++) {
    const a = r() * Math.PI * 2
    const p = polar(a, 18.8 + r() * 13)
    const h = 2.2 + r() * 3.2
    const [x, , z] = p
    if (Math.abs(x) < 4.5 && z > 0) continue // 입구 길·순위판
    if (inGate(a, 0.25) && Math.hypot(x, z) < 24) continue // 길목
    if (onPath(x, z) || onDecor(x, z) || onCrystal(x, z)) continue // 돌길·로켓·망원경·수정
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1.6) continue
    if (Math.hypot(x - ROLL.x, z - ROLL.z) < ROLL.r + 1.6) continue
    if (onSledRun(x, z)) continue
    if (outside.some((o) => Math.hypot(o.p[0] - x, o.p[2] - z) < 2)) continue
    outside.push({ p, h, seed: 300 + i })
  }
  // 문 바로 안쪽 나무는 뺀다 (뽑는 순서는 그대로 둬야 숨은 선물이 걸린 나무 자리가 안 바뀐다)
  const kept = list.filter((t) => !(inGate(Math.atan2(t.p[2], t.p[0]), 0.03) && Math.hypot(t.p[0], t.p[2]) > 12.5))
  addTreeColliders([...kept, ...outside])
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
      const rr = Math.sqrt(Math.random()) * 38
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

/** 🌙 그림자를 만드는 빛: 내 쿠키를 따라다녀서 넓은 섬 어디서든 그림자가 또렷하다 */
function Sun({ me }: { me: MutableRefObject<CookieState | null> }) {
  const light = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const s = me.current
    const x = s?.x ?? 0
    const z = s?.z ?? 0
    l.position.set(x + 14, 24, z + 12)
    l.target.position.set(x, 0, z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      intensity={0.95}
      color="#c9d4ff"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
      shadow-camera-near={1}
      shadow-camera-far={70}
    />
  )
}

/** 로그인 전: 마을 전경을 천천히 한 바퀴 */
function OrbitRig() {
  const target = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(0, 1.2, 0), [])
  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime * 0.035 + Math.PI / 2
    target.set(Math.cos(t) * 66, 24, Math.sin(t) * 66)
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
        <fog attach="fog" args={[SPACE_FOG, 90, 320]} />
        <SpaceBackdrop />
        <hemisphereLight args={['#93a0ea', '#362c62', 0.55]} />
        <Sun me={myState} />
        <directionalLight
          position={[14, 24, 12]}
          intensity={0.3}
          color="#8a9cff"
        />

        <Ground />
        <GlowPools />
        <SledLights />
        <Plaza />
        <Spots tree={tree} />
        <Festive />
        <Timeline />
        <Party />
        {elf && <Elf alert={elf.alert} chatter={elf.chatter} />}
        {me && <Snowballs />}
        <SledHill boards={!!me} />
        {treasure && me && <DecoyMounds />}
        {treasure && me && <GiftBoxes hidden={treasure.hidden} duds={treasure.duds} glow={treasure.glow} dig={dig} me={myState} burst={treasure.burst} />}
        <Fade x={at(SPOT.church)[0]} z={at(SPOT.church)[2]} r={2.4}>
          <group position={at(SPOT.church)} rotation={[0, faceCenter(SPOT.church.a), 0]}>
            <Batch>
              <Church />
            </Batch>
            <Chimney position={[-0.9, 3.0, -0.8]} h={1.0} />
          </group>
        </Fade>
        <Forest />
        {/* 옛 울타리 자리의 등불 기둥 · 놀이 구역 돌길 · 로켓 · 망원경 · 수정 */}
        <Decor />
        <Arena />
        <RollField boards={!!me} me={myState} />
        {me && <XpBoard position={[4.6, 0, 19.6]} rotation={-0.25} />}

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

        <Sparkles count={420} scale={[64, 0.6, 64]} position={[0, 0.25, 0]} size={2.2} speed={0.15} opacity={0.9} color="#ffffff" />
        <Pets me={myState} />
        <Snapshot />
        <FallingSnow />

        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} mipmapBlur radius={0.65} />
          <Vignette offset={0.25} darkness={0.5} />
        </EffectComposer>
      </Canvas>
      {live && me && (
        <div className="online-count" title="지금 마을에 있는 사람">
          <Users size={16} weight="fill" /> 지금 마을에 <b>{here}명</b>
        </div>
      )}
      {me && <SnowHitOverlay />}
    </div>
  )
}
