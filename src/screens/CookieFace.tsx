import { DOUGHS, type Look } from '../look'

// 🍪 쿠키 얼굴 그림 (SVG). 산타 랭킹처럼 사람이 많이 나오는 곳에서 3D 대신 쓴다.
// 반죽 색·눈·입·볼·목도리·머리 장식을 그 사람이 꾸민 대로 그린다.

const INK = '#2a1a12'

function Eyes({ kind }: { kind: Look['eyes'] }) {
  const dot = (x: number) => <circle key={x} cx={x} cy={55} r={4.2} fill={INK} />
  const arc = (x: number) => <path key={x} d={`M${x - 5} 57 Q${x} 49 ${x + 5} 57`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
  const shut = (x: number) => <path key={x} d={`M${x - 5} 54 Q${x} 59 ${x + 5} 54`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
  if (kind === 'happy') return <>{[39, 61].map(arc)}</>
  if (kind === 'sleepy') return <>{[39, 61].map(shut)}</>
  if (kind === 'wink') return <>{[dot(39), arc(61)]}</>
  if (kind === 'sparkle')
    return (
      <>
        {[39, 61].map((x) => (
          <g key={x}>
            <circle cx={x} cy={55} r={5.2} fill={INK} />
            <circle cx={x + 1.8} cy={53} r={1.8} fill="#fff" />
          </g>
        ))}
      </>
    )
  return <>{[39, 61].map(dot)}</>
}

function Mouth({ kind }: { kind: Look['mouth'] }) {
  if (kind === 'open') return <path d="M43 65 Q50 76 57 65 Z" fill="#8a2f26" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
  if (kind === 'cat') return <path d="M42 66 Q46 71 50 66 Q54 71 58 66" stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
  if (kind === 'o') return <ellipse cx={50} cy={68} rx={3.6} ry={4.2} fill="#8a2f26" stroke={INK} strokeWidth={2} />
  return <path d="M43 65 Q50 72 57 65" stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round" />
}

function Cheeks({ kind }: { kind: Look['cheek'] }) {
  if (kind === 'pink')
    return (
      <>
        <ellipse cx={29} cy={64} rx={6} ry={3.6} fill="#ff8fa3" opacity={0.7} />
        <ellipse cx={71} cy={64} rx={6} ry={3.6} fill="#ff8fa3" opacity={0.7} />
      </>
    )
  if (kind === 'freckle')
    return (
      <g fill="#6b3b1f" opacity={0.75}>
        {[
          [27, 62],
          [31, 65],
          [26, 66],
          [73, 62],
          [69, 65],
          [74, 66],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.3} />
        ))}
      </g>
    )
  return null
}

/** 머리 위 장식 (얼굴 뒤에 그릴 것 / 앞에 그릴 것) */
function Hat({ look, front }: { look: Look; front: boolean }) {
  const c = look.hatColor
  const dough = DOUGHS[look.dough].color
  switch (look.hat) {
    case 'santa':
      return front ? (
        <>
          <path d="M22 30 Q50 18 78 30 L74 38 Q50 30 26 38 Z" fill="#fff" />
        </>
      ) : (
        <>
          <path d="M24 32 Q34 2 64 6 Q82 10 86 22 L78 30 Q52 20 24 32 Z" fill="#c62a24" />
          <circle cx={86} cy={22} r={6} fill="#fff" />
        </>
      )
    case 'beanie':
      return front ? (
        <rect x={19} y={28} width={62} height={10} rx={5} fill={c} stroke="rgba(0,0,0,.18)" strokeWidth={1.5} />
      ) : (
        <>
          <path d="M22 34 Q24 6 50 6 Q76 6 78 34 Z" fill={c} />
          <circle cx={50} cy={6} r={6.5} fill="#f4f1ea" />
        </>
      )
    case 'elf':
      return front ? (
        <rect x={20} y={28} width={60} height={9} rx={4.5} fill="#e0a21a" />
      ) : (
        <>
          <path d="M22 33 Q40 4 88 0 Q70 14 78 33 Z" fill={c} />
          <circle cx={88} cy={1} r={4.5} fill="#e0a21a" />
        </>
      )
    case 'antlers':
      return front ? null : (
        <g stroke="#7a4b26" strokeWidth={4.5} strokeLinecap="round" fill="none">
          <path d="M34 26 L26 6 M29 14 L18 12 M27 9 L32 2" />
          <path d="M66 26 L74 6 M71 14 L82 12 M73 9 L68 2" />
        </g>
      )
    case 'cat':
      return front ? null : (
        <>
          <path d="M22 34 L24 8 L44 24 Z" fill={dough} stroke="rgba(0,0,0,.15)" strokeWidth={1.5} />
          <path d="M78 34 L76 8 L56 24 Z" fill={dough} stroke="rgba(0,0,0,.15)" strokeWidth={1.5} />
          <path d="M27 27 L28 15 L37 23 Z" fill="#ff9fb2" />
          <path d="M73 27 L72 15 L63 23 Z" fill="#ff9fb2" />
        </>
      )
    case 'crown':
      return front ? null : <path d="M30 26 L30 8 L40 18 L50 4 L60 18 L70 8 L70 26 Z" fill="#f4c542" stroke="#c9962a" strokeWidth={2} strokeLinejoin="round" />
    case 'earmuffs':
      return front ? (
        <>
          <circle cx={17} cy={52} r={9} fill={c} />
          <circle cx={83} cy={52} r={9} fill={c} />
        </>
      ) : (
        <path d="M17 50 Q17 10 50 10 Q83 10 83 50" stroke={c} strokeWidth={5} fill="none" />
      )
    case 'headphones':
      return front ? (
        <>
          <rect x={10} y={42} width={12} height={20} rx={5} fill={c} />
          <rect x={78} y={42} width={12} height={20} rx={5} fill={c} />
        </>
      ) : (
        <path d="M16 48 Q16 8 50 8 Q84 8 84 48" stroke="#2a2230" strokeWidth={5} fill="none" />
      )
    case 'bolt':
      return front ? null : (
        <g fill="#f4c542" stroke="#c9962a" strokeWidth={1.5} strokeLinejoin="round">
          <path d="M28 28 L22 14 L28 15 L24 2 L36 18 L30 17 L34 28 Z" />
          <path d="M72 28 L78 14 L72 15 L76 2 L64 18 L70 17 L66 28 Z" />
        </g>
      )
    case 'astro':
      return front ? <circle cx={50} cy={56} r={44} fill="rgba(170,210,255,.22)" stroke="#e8f1ff" strokeWidth={4} /> : null
    default:
      return null
  }
}

function Extra({ look }: { look: Look }) {
  if (look.extra === 'glasses')
    return (
      <g stroke={INK} strokeWidth={2.4} fill="none">
        <circle cx={39} cy={55} r={8} />
        <circle cx={61} cy={55} r={8} />
        <path d="M47 55 L53 55" />
      </g>
    )
  if (look.extra === 'bow')
    return (
      <g fill="#e06a9a">
        <path d="M70 26 L60 20 L60 32 Z" />
        <path d="M70 26 L80 20 L80 32 Z" />
        <circle cx={70} cy={26} r={3} />
      </g>
    )
  if (look.extra === 'star') return <path d="M72 30 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#f4c542" />
  return null
}

/** 쿠키 얼굴 하나. size = 픽셀 */
export function CookieFace({ look, size = 48 }: { look: Look; size?: number }) {
  const dough = DOUGHS[look.dough].color
  return (
    <svg className="cookie-face" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <Hat look={look} front={false} />
      <path d="M22 90 Q50 104 78 90 L74 100 L26 100 Z" fill={look.scarf} />
      <circle cx={50} cy={56} r={33} fill={dough} stroke="rgba(0,0,0,.16)" strokeWidth={2} />
      <circle cx={50} cy={56} r={28.5} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth={2} strokeDasharray="5 4" />
      <path d="M24 84 Q50 98 76 84 L78 92 Q50 104 22 92 Z" fill={look.scarf} stroke="rgba(0,0,0,.15)" strokeWidth={1.5} />
      <Cheeks kind={look.cheek} />
      <Eyes kind={look.eyes} />
      <Mouth kind={look.mouth} />
      <Extra look={look} />
      <Hat look={look} front />
    </svg>
  )
}
