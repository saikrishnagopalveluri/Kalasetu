import { useId } from 'react'

// Gond folk-painting pieces: dotted leaves, trees with birds, swirl clouds,
// a crescent moon over a starry sky or a ringed sun by day, layered hills. The look follows Gond
// paintings (flat colour, every shape filled with rows of dots or lines).
// All of it is decorative: aria-hidden, no pointer events, and kept to the
// edges of a scene so text always sits on plain sky.

const LEAF = 'M0 0C7-9 8-24 0-34C-8-24-7-9 0 0Z'
const CREAM = '#F4EFE6'
const SAFFRON = '#E0A526'
const CLAY = '#C4552D'
const RUST = '#A8432A'
const JADE = '#2E8A74'
const TEAL = '#3E7F86'
const BARK = '#B98A5E'

function Leaf({ x, y, r, fill, s = 1 }: { x: number; y: number; r: number; fill: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d={LEAF} fill={fill} />
      <path d="M0-3V-30" stroke={CREAM} strokeOpacity=".7" strokeWidth="1" />
      <g fill={CREAM} fillOpacity=".75">
        <circle cx="-3" cy="-9" r=".9" /><circle cx="-4" cy="-15" r=".9" /><circle cx="-3.4" cy="-21" r=".9" />
        <circle cx="3" cy="-9" r=".9" /><circle cx="4" cy="-15" r=".9" /><circle cx="3.4" cy="-21" r=".9" />
      </g>
    </g>
  )
}

const TREE_LEAVES: [number, number, number, string, number?][] = [
  [44, 132, -70, JADE], [56, 140, -40, SAFFRON, 0.85], [70, 150, -20, CLAY, 0.8],
  [158, 110, 65, CLAY], [146, 122, 35, JADE, 0.85], [130, 132, 15, SAFFRON, 0.8],
  [76, 70, -25, SAFFRON], [82, 90, -55, TEAL, 0.85], [90, 104, -10, JADE, 0.75],
  [130, 62, 25, JADE], [124, 82, 55, SAFFRON, 0.85], [114, 98, 10, CLAY, 0.75],
  [100, 58, 0, CLAY, 0.9], [62, 112, -95, TEAL, 0.75], [150, 88, 90, TEAL, 0.75],
  [66, 52, -40, CLAY, 0.8], [138, 44, 40, SAFFRON, 0.8], [36, 112, -100, SAFFRON, 0.7],
  [168, 92, 100, JADE, 0.7], [100, 36, 0, JADE, 0.75],
]

/** A Gond tree, optionally with a bird on its right branch. */
export function GondTree({ style, className, bird = true, flip = false }: {
  style?: React.CSSProperties; className?: string; bird?: boolean; flip?: boolean
}) {
  return (
    <svg viewBox="0 0 200 220" className={className} style={{ pointerEvents: 'none', ...style }} aria-hidden="true">
      <g transform={flip ? 'translate(200 0) scale(-1 1)' : undefined}>
        <g fill="none" stroke={BARK} strokeLinecap="round">
          <path d="M100 222C97 192 103 160 100 120" strokeWidth="8" />
          <path d="M100 172C80 158 60 152 44 132" strokeWidth="3" />
          <path d="M100 150C120 140 140 130 158 110" strokeWidth="3" />
          <path d="M100 126C92 106 84 90 76 70" strokeWidth="2.5" />
          <path d="M100 126C110 102 120 86 130 62" strokeWidth="2.5" />
          <path d="M100 120V40" strokeWidth="2.5" />
        </g>
        {/* bark: a column of dashes, the way Gond trunks are filled */}
        <path d="M100 216V128" stroke={CREAM} strokeOpacity=".55" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
        {TREE_LEAVES.map(([x, y, r, fill, s], i) => <Leaf key={i} x={x} y={y} r={r} fill={fill} s={s} />)}
        {bird && <GondBirdShape x={138} y={140} />}
      </g>
    </svg>
  )
}

function GondBirdShape({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-14 4L-30 12L-27 2L-31-6Z" fill={TEAL} />
      <path d="M-16 2C-12-10 6-12 14-4C17 0 14 6 6 9C-4 12-14 10-16 2Z" fill={SAFFRON} />
      <path d="M-8 0C-2-7 6-6 9 0C4 3-3 4-8 0Z" fill={CLAY} />
      <g fill={CREAM} fillOpacity=".85">
        <circle cx="-3" cy="-1" r=".8" /><circle cx="1" cy="-2.5" r=".8" /><circle cx="5" cy="-1.5" r=".8" />
        <circle cx="-8" cy="5" r=".8" /><circle cx="-3" cy="6" r=".8" /><circle cx="2" cy="6" r=".8" />
      </g>
      <circle cx="14" cy="-6" r="5" fill={SAFFRON} />
      <circle cx="15.5" cy="-7" r="1.2" fill="#132A45" />
      <path d="M18.5-6L24-4.5L18.5-3.5Z" fill={CLAY} />
      <path d="M0 10V14M4 10V14" stroke={BARK} strokeWidth="1" />
    </g>
  )
}

/** A flying bird in profile, for open sky. */
export function GondFlyingBird({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} style={{ pointerEvents: 'none', ...style }} aria-hidden="true">
      <path d="M8 18C16 10 30 10 40 16L54 12L48 19C40 26 18 26 8 18Z" fill={SAFFRON} />
      <path d="M22 16C26 4 34 0 40 2C36 8 32 14 26 17Z" fill={CLAY} />
      <g fill={CREAM} fillOpacity=".85"><circle cx="28" cy="9" r=".8" /><circle cx="32" cy="6" r=".8" /><circle cx="20" cy="20" r=".8" /><circle cx="26" cy="21" r=".8" /></g>
      <path d="M8 18L0 14L2 21Z" fill={TEAL} />
      <circle cx="46" cy="15" r="1" fill="#132A45" />
    </svg>
  )
}

/** A cream cloud with the spiral lines Gond painters draw inside clouds. */
export function GondCloud({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 120 56" className={className} style={{ pointerEvents: 'none', ...style }} aria-hidden="true">
      <path d="M8 50C0 50 0 36 10 34C8 22 22 16 30 22C34 8 54 4 62 16C70 6 90 8 92 22C104 18 116 28 110 40C118 42 116 50 110 50Z" fill="#F1E3C4" />
      <g fill="none" stroke={RUST} strokeOpacity=".5" strokeWidth="1.3" strokeLinecap="round">
        <path d="M58 36a5 5 0 1 1 5 5a10 10 0 1 1 -10 -10a15 15 0 0 1 15 15" />
        <path d="M28 40a4 4 0 1 1 4 4a8 8 0 1 1 -8 -8" />
        <path d="M90 40a4 4 0 1 0 -4 4a8 8 0 1 0 8 -8" />
      </g>
    </svg>
  )
}

const STARS: [number, number, number][] = [
  [18, 22, 1.1], [46, 50, 0.9], [74, 16, 1.3], [104, 40, 0.8], [128, 12, 1], [150, 56, 1.1],
  [176, 26, 0.9], [206, 48, 1.2], [232, 14, 0.8], [258, 38, 1], [36, 76, 0.8], [196, 80, 0.8],
]

/** Crescent moon and a scatter of dotted stars, for the top of a dark scene. */
export function GondNight({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 280 100" preserveAspectRatio="xMidYMin slice" className={className} style={{ pointerEvents: 'none', ...style }} aria-hidden="true">
      <defs>
        <mask id={`moon-${id}`}>
          <rect width="280" height="100" fill="#fff" />
          <circle cx="232" cy="28" r="9" fill="#000" />
        </mask>
      </defs>
      <circle cx="227" cy="32" r="10" fill="#F4E7C3" fillOpacity=".8" mask={`url(#moon-${id})`} />
      <g fill="#F4E7C3">
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fillOpacity=".5" className={i % 4 === 0 ? 'ks-twinkle' : undefined} style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
      </g>
      <g fill="#F4E7C3" fillOpacity=".6">
        <path d="M92 64l1.2 3.3 3.3 1.2-3.3 1.2L92 73l-1.2-3.3-3.3-1.2 3.3-1.2z" />
        <path d="M170 34l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" />
      </g>
    </svg>
  )
}

/** Two layered hills with a dotted ridge, the ground of a scene. */
export function GondHills({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 400 70" preserveAspectRatio="none" className={className} style={{ pointerEvents: 'none', ...style }} aria-hidden="true">
      <path d="M0 30C50 12 90 14 140 30S240 20 300 12 380 16 400 26V70H0Z" fill="#2F6B4F" />
      <path d="M0 46C60 26 110 26 160 40S270 58 320 38 380 30 400 36V70H0Z" fill="#1F5A57" />
      <path d="M0 46C60 26 110 26 160 40S270 58 320 38 380 30 400 36" fill="none" stroke="#F4E7C3" strokeOpacity=".55" strokeWidth="1.6" strokeDasharray="0 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M0 30C50 12 90 14 140 30S240 20 300 12 380 16 400 26" fill="none" stroke="#F4E7C3" strokeOpacity=".3" strokeWidth="1.2" strokeDasharray="0 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export type SkyTime = 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * Which sky to paint for a local hour (0-23). Night runs from 8pm to 5am so
 * the moon only shows after dark; the greeting text keeps its own buckets.
 */
export function skyTimeFor(hour: number): SkyTime {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

const SUN_COLOURS: Record<Exclude<SkyTime, 'night'>, { core: string; rays: string; ring: string; y: number; r: number }> = {
  morning: { core: '#FCEFD2', rays: SAFFRON, ring: RUST, y: 34, r: 1 },
  afternoon: { core: SAFFRON, rays: CLAY, ring: '#FCEFD2', y: 26, r: 0.9 },
  evening: { core: '#FCEFD2', rays: SAFFRON, ring: '#FCEFD2', y: 58, r: 1.2 },
}

/** A Gond sun: a solid disc inside dotted rings and a crown of petal rays. */
export function GondSun({ time, style, className }: {
  time: Exclude<SkyTime, 'night'>; style?: React.CSSProperties; className?: string
}) {
  const c = SUN_COLOURS[time]
  return (
    <svg viewBox="0 0 280 100" preserveAspectRatio="xMidYMin slice" className={className} style={{ pointerEvents: 'none', ...style }} aria-hidden="true">
      <g transform={`translate(226 ${c.y}) scale(${c.r})`}>
        <g fill={c.rays}>
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M-2.6-17L0-25L2.6-17Z" transform={`rotate(${i * 22.5})`} />
          ))}
        </g>
        <circle r="15" fill="none" stroke={c.ring} strokeOpacity=".7" strokeWidth="1.4" strokeDasharray="0 3.4" strokeLinecap="round" />
        <circle r="11.5" fill={c.core} />
        <circle r="7.5" fill="none" stroke={c.rays} strokeOpacity=".8" strokeWidth="1" />
        <circle r="3.5" fill={c.rays} fillOpacity=".85" />
        <circle r="29" fill="none" stroke={c.ring} strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="0 5" strokeLinecap="round" />
      </g>
      {time !== 'afternoon' && (
        <g className="ks-sun-birds" fill="none" stroke={time === 'morning' ? RUST : '#FCEFD2'} strokeOpacity=".65" strokeWidth="1.3" strokeLinecap="round">
          <path d="M150 30q4-4 8 0q4-4 8 0" />
          <path d="M172 18q3.5-3.5 7 0q3.5-3.5 7 0" />
        </g>
      )}
    </svg>
  )
}

/**
 * A full-width painted scene: a sky (sun by day, moon and stars by night),
 * clouds, a tree on each side and hills along the bottom, with the page's
 * content in the middle. `compact` is the shorter dashboard version; `sky`
 * picks the time of day (night by default).
 */
export function GondScene({ id, children, compact = false, sky = 'night', className = '' }: {
  id?: string; children: React.ReactNode; compact?: boolean; sky?: SkyTime; className?: string
}) {
  return (
    <section id={id} data-sky={sky} className={`ks-scene ks-bleed ks-sky-${sky} ${compact ? 'ks-scene-compact' : ''} ${className}`}>
      {sky === 'night'
        ? <GondNight className="ks-scene-night" />
        : <GondSun time={sky} className="ks-scene-night ks-scene-sun" />}
      <GondCloud className="ks-scene-cloud ks-scene-cloud-l" />
      <GondCloud className="ks-scene-cloud ks-scene-cloud-r" />
      {!compact && <GondFlyingBird className="ks-scene-flyer" />}
      <GondTree className="ks-scene-tree ks-scene-tree-l" flip bird={false} />
      <GondTree className="ks-scene-tree ks-scene-tree-r" />
      <GondHills className="ks-scene-hills" />
      <div className="ks-scene-content">{children}</div>
    </section>
  )
}
