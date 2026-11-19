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

function Panel({ m }: { m: (typeof TIMELINE)[number] }) {
  const { w, h } = EXHIBIT
  return (
    <group>
      <Batch>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (w / 2 - 0.12), 0.2, -0.02]} material={M.woodDark} castShadow>
            <boxGeometry args={[0.1, 0.4, 0.1]} />
          </mesh>
        ))}
        <mesh position={[0, PANEL_Y, 0]} material={M.kraft} castShadow receiveShadow>
          <boxGeometry args={[w, h, 0.08]} />
        </mesh>
        <mesh position={[0, PANEL_Y + h / 2 + 0.05, 0]} material={M.snow} scale={[1, 0.35, 1]}>
          <boxGeometry args={[w + 0.06, 0.16, 0.2]} />
        </mesh>
      </Batch>
      <TextSign
        w={w - 0.12}
        h={h - 0.12}
        position={[0, PANEL_Y, 0.045]}
        bg="#fbf3e2"
        radius={0.05}
        lines={[
          { text: m.month, size: 0.1, color: '#a8302a', weight: 800, gap: 0.02, kr: true },
          { text: m.emoji, size: 0.3, gap: 0.02 },
          { text: m.fun, size: 0.135, color: '#2a2230', weight: 800, wrap: true, gap: 0.06, kr: true },
          { text: m.title, size: 0.088, color: '#a8302a', weight: 700, wrap: true, gap: 0.07, kr: true },
          ...m.lines.map((l) => ({ text: `· ${l}`, size: 0.085, color: '#3a2a20', weight: 500, wrap: true, gap: 0.03, kr: true })),
        ]}
      />
      <mesh position={[0, PANEL_Y + h / 2 - 0.02, 0.06]} material={M.bulbs[1]}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
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
        <mesh position={[0, 3.45, -0.1]} material={M.ribbon} castShadow>
          <boxGeometry args={[4.9, 0.62, 0.1]} />
        </mesh>
        <mesh position={[0, 3.8, -0.1]} material={M.snow} scale={[1, 0.35, 1]}>
          <boxGeometry args={[4.95, 0.18, 0.24]} />
        </mesh>
        <TextSign
          w={4.7}
          h={0.56}
          position={[0, 3.45, -0.04]}
          glow
          lines={[
            { text: `📜 ${TIMELINE_TITLE}`, size: 0.2, color: '#fff6dc', weight: 800, kr: true },
          ]}
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
