import { useMemo } from 'react'
import { M, gableBody } from './materials'
import { ArchWindow, Door, Garland, Roof, Wreath } from './props'

// 마을 뒤편의 작은 교회. 높은 첨탑이 어느 방향에서 봐도 집들 위로 보이는 랜드마크.
export function Church() {
  const W = 3.0
  const H = 2.6
  const RISE = 1.5
  const D = 3.6
  const body = useMemo(() => gableBody(W, H, RISE, D), [])
  const tower = useMemo(() => gableBody(1.3, 1.6, 0.7, 1.3), [])
  const front = D / 2 + 0.001

  return (
    <group>
      <mesh geometry={body} material={M.cream} castShadow receiveShadow />
      <mesh position={[0, 0.07, 0]} material={M.stone} receiveShadow>
        <boxGeometry args={[W + 0.14, 0.14, D + 0.14]} />
      </mesh>
      <Roof w={W} h={H} rise={RISE} d={D} mat={M.roofGreen} over={0.25} />

      {/* 앞면 */}
      <Door position={[0, 0, front]} w={0.7} h={1.25} />
      <ArchWindow position={[-0.95, 0.75, front]} w={0.48} h={0.95} />
      <ArchWindow position={[0.95, 0.75, front]} w={0.48} h={0.95} />
      <ArchWindow position={[0, 1.5, front]} w={0.8} h={0.5} />
      <Wreath position={[0, H + 0.45, front + 0.05]} scale={1.5} />
      <Garland from={[-W / 2 - 0.1, H - 0.05, front + 0.08]} to={[W / 2 + 0.1, H - 0.05, front + 0.08]} sag={0.2} />
      {[1, -1].map((sx) =>
        [-1, 0.2].map((z) => (
          <ArchWindow
            key={`${sx}${z}`}
            position={[(W / 2 + 0.001) * sx, 0.8, z]}
            w={0.45}
            h={1.0}
            rotation={[0, (Math.PI / 2) * sx, 0]}
          />
        )),
      )}

      {/* 종탑 + 첨탑 */}
      <group position={[0, H + RISE * 0.25, D / 2 - 0.75]}>
        <mesh geometry={tower} material={M.kraftLight} castShadow />
        <ArchWindow position={[0, 0.6, 0.651]} w={0.5} h={0.8} frame={M.trimWood} />
        <ArchWindow position={[0, 0.6, -0.651]} w={0.5} h={0.8} rotation={[0, Math.PI, 0]} frame={M.trimWood} />
        <group position={[0, 1.6, 0]}>
          <mesh position={[0, 1.1, 0]} rotation={[0, Math.PI / 4, 0]} material={M.roofGreen} castShadow>
            <coneGeometry args={[1.05, 2.2, 4]} />
          </mesh>
          <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]} material={M.snow} castShadow>
            <cylinderGeometry args={[0.62, 1.12, 0.35, 4, 1, true]} />
          </mesh>
          <mesh position={[0, 2.45, 0]} material={M.gold}>
            <boxGeometry args={[0.07, 0.6, 0.07]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} material={M.gold}>
            <boxGeometry args={[0.34, 0.07, 0.07]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
