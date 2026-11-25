import * as THREE from 'three'
import { Batch } from './Batch'
import { M } from './materials'
import { TextSign } from './TextSign'
import { TIMELINE, TIMELINE_TITLE } from '../timeline'
import { EXHIBIT, VILLAGE_R, addRotBox, exhibitAngle, faceCenter, polar } from './world'

// 📜 2026 AX 연대기 전시. 마을 뒤쪽 가운데에 달마다 한 장씩 패널이 호를 그리며 선다.
// 창을 띄우지 않고 그 자리에서 읽는다. 가까이 가면 카메라가 다가가 전시를 보는 시점이 된다 (Player.tsx).

const N = TIMELINE.length
const PANELS = TIMELINE.map((m, i) => {
  const a = exhibitAngle(i, N)
  const [x, , z] = polar(a, EXHIBIT.r)
  const rot = faceCenter(a)
  addRotBox(x, z, rot, EXHIBIT.w / 2 + 0.05, 0.18)
  return { m, x, z, rot }
})
const PATH_FROM = VILLAGE_R + 3 // 대문 밖 입구 길 끝
const PATH_TO = 5.5 // 광장 앞
const PANEL_Y = 1.55 // 패널 가운데 높이

const NAVY = new THREE.MeshStandardMaterial({ color: '#1f2350', roughness: 0.6 })
const LAMP_GLOW = new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffb04a', emissiveIntensity: 2.8, toneMapped: false })
const MONTH_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** 한 달 패널: 돌 받침 위 남색 액자(금테) + 위에 빨간 달 리본 + 밝은 카드 + 위에서 비추는 작은 등 */
function Panel({ m }: { m: (typeof TIMELINE)[number] }) {
  const { w, h } = EXHIBIT
  const mm = Number(m.month.slice(-2))
  const cardH = h - 0.5
  return (
    <group>
      <Batch>
        {/* 돌 받침 + 눈 */}
        <mesh position={[0, 0.15, 0]} material={M.stone} castShadow receiveShadow>
          <boxGeometry args={[w + 0.16, 0.3, 0.42]} />
        </mesh>
        <mesh position={[0, 0.32, 0]} material={M.snow} scale={[1, 0.3, 1]}>
          <boxGeometry args={[w + 0.2, 0.2, 0.46]} />
        </mesh>
        {/* 남색 액자 + 금테 */}
        <mesh position={[0, PANEL_Y, -0.02]} material={M.gold} castShadow>
          <boxGeometry args={[w + 0.14, h + 0.14, 0.08]} />
        </mesh>
        <mesh position={[0, PANEL_Y, 0]} material={NAVY} castShadow receiveShadow>
          <boxGeometry args={[w + 0.04, h + 0.04, 0.1]} />
        </mesh>
        {/* 위 눈 */}
        <mesh position={[0, PANEL_Y + h / 2 + 0.09, 0]} material={M.snow} scale={[1, 0.35, 1]}>
          <boxGeometry args={[w + 0.2, 0.18, 0.22]} />
        </mesh>
        {/* 위에서 비추는 작은 등 (팔 + 갓) */}
        <mesh position={[0, PANEL_Y + h / 2 + 0.2, 0.14]} rotation={[Math.PI / 2, 0, 0]} material={M.iron}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
        </mesh>
        <mesh position={[0, PANEL_Y + h / 2 + 0.18, 0.3]} material={M.iron}>
          <coneGeometry args={[0.1, 0.1, 10, 1, true]} />
        </mesh>
      </Batch>
      <mesh position={[0, PANEL_Y + h / 2 + 0.13, 0.3]} material={LAMP_GLOW}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      {/* 빨간 달 리본 */}
      <mesh position={[0, PANEL_Y + h / 2 - 0.14, 0.07]} material={M.ribbon}>
        <boxGeometry args={[w * 0.72, 0.3, 0.04]} />
      </mesh>
      <TextSign
        w={w * 0.7}
        h={0.28}
        position={[0, PANEL_Y + h / 2 - 0.14, 0.092]}
        glow
        lines={[{ text: `${MONTH_EN[mm - 1] ?? ''} · ${m.month}`, size: 0.13, color: '#ffffff', weight: 900, kr: true }]}
      />
      {/* 밝은 카드: 큰 한 줄 + 제목 + 내용 */}
      <TextSign
        w={w - 0.14}
        h={cardH}
        position={[0, PANEL_Y - 0.17, 0.056]}
        bg="#fbfbfe"
        radius={0.06}
        lines={[
          { text: m.fun, size: 0.14, color: '#2f2950', weight: 900, wrap: true, gap: 0.08, kr: true },
          { text: m.title, size: 0.09, color: '#c8372d', weight: 800, wrap: true, gap: 0.08, kr: true },
          ...m.lines.map((l) => ({ text: `· ${l}`, size: 0.085, color: '#4a4466', weight: 500, wrap: true, gap: 0.035, kr: true })),
        ]}
      />
    </group>
  )
}

export function Timeline() {
  // 가운데 패널 위에 걸리는 큰 제목 간판
  const mid = exhibitAngle((N - 1) / 2, N)
  const [hx, , hz] = polar(mid, EXHIBIT.r + 0.05)
  return (
    <group>
      {/* 입구 길 (대문 밖부터 광장 앞까지) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, (PATH_FROM + PATH_TO) / 2]} material={M.stoneDark} receiveShadow>
        <planeGeometry args={[1.8, PATH_FROM - PATH_TO]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, (PATH_FROM + PATH_TO) / 2]} material={M.stone} receiveShadow>
        <planeGeometry args={[1.4, PATH_FROM - PATH_TO]} />
      </mesh>
      {/* 전시 앞 바닥 (호 모양 돌길) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} material={M.stoneDark} receiveShadow>
        <ringGeometry args={[EXHIBIT.r - 2.2, EXHIBIT.r + 0.4, 48, 1, -mid - EXHIBIT.step * (N / 2 + 0.2), EXHIBIT.step * (N + 0.4)]} />
      </mesh>

      {PANELS.map((p) => (
        <group key={p.m.month} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
          <Panel m={p.m} />
        </group>
      ))}

      <group position={[hx, 0, hz]} rotation={[0, faceCenter(mid), 0]}>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 2.45, 1.95, -0.2]} material={M.woodDark} castShadow>
            <boxGeometry args={[0.12, 3.9, 0.12]} />
          </mesh>
        ))}
        <mesh position={[0, 3.45, -0.12]} material={M.gold} castShadow>
          <boxGeometry args={[5.0, 0.74, 0.08]} />
        </mesh>
        <mesh position={[0, 3.45, -0.1]} material={NAVY} castShadow>
          <boxGeometry args={[4.88, 0.62, 0.1]} />
        </mesh>
        <mesh position={[0, 3.86, -0.1]} material={M.snow} scale={[1, 0.35, 1]}>
          <boxGeometry args={[5.05, 0.18, 0.24]} />
        </mesh>
        <TextSign
          w={4.7}
          h={0.56}
          position={[0, 3.45, -0.04]}
          glow
          lines={[{ text: TIMELINE_TITLE, size: 0.19, color: '#ffd86b', weight: 900, kr: true }]}
        />
        {Array.from({ length: 17 }, (_, i) => (
          <mesh key={i} position={[-2.3 + i * (4.6 / 16), 3.78, -0.02]} material={M.bulbs[i % 4]}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
        ))}
        <pointLight position={[0, 2.8, 2.2]} color="#ffd9a0" intensity={9} distance={9} decay={2} />
      </group>
    </group>
  )
}
