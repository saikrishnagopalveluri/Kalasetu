// A small set of hand-drawn-style line icons, replacing generic emoji across
// the app. One consistent visual language: 1.75px stroke, currentColor (so
// callers set color via CSS), 24x24 viewBox, rounded caps. Loosely drawn from
// traditional craft motifs (loom, diya, pot, quill) rather than generic tech
// iconography, to match the site's Kalamkari-inspired brand identity.

type IconProps = { size?: number; className?: string; style?: React.CSSProperties }

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

// Studio / photoshoot — camera with a small aperture dot
export function IconStudio({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10.5H4z" />
      <circle cx="12" cy="13" r="3.2" />
      <path d="M7 8.5v-1" />
    </svg>
  )
}

// Design — a paintbrush with a dab
export function IconDesign({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M15.5 3.5c1.4 0 2.8 1.4 2.8 2.8 0 1-.6 1.7-1.6 2.6L10 15.6l-3-3 6.7-6.7c.9-1 1.6-1.6 2.6-1.6z" />
      <path d="M9.5 14.2 6 20l-2.4-2 5.8-3.6" />
      <circle cx="17" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Content / writing — a quill
export function IconContent({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M19 5c-5.5 0-11 5.2-11 12.5H5.5C6 10 12 5 19 5z" />
      <path d="M9.5 15.5 4.5 20.5" />
      <path d="M13 8.5c-2 1.2-3.5 3-4.5 5" />
    </svg>
  )
}

// Promote — a megaphone
export function IconPromote({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 10v4h2.5L14 18V6L6.5 10z" />
      <path d="M16.5 9.5c1 .8 1 3.2 0 4" />
      <path d="M19 7.5c2 1.8 2 6 0 7.8" />
      <path d="M6.5 14.5 8 19h2" />
    </svg>
  )
}

// Ask AI / coach — a small lamp with rays (idea/guidance)
export function IconCoach({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M9 15.5h6" />
      <path d="M10 18.5h4" />
      <path d="M12 2.5c3 0 5.2 2.3 5.2 5.2 0 2.1-1.1 3.3-2.1 4.4-.7.8-1.1 1.4-1.1 2.4H10c0-1-.4-1.6-1.1-2.4-1-1.1-2.1-2.3-2.1-4.4 0-2.9 2.2-5.2 5.2-5.2z" />
    </svg>
  )
}

// Calculator — pricing helper
export function IconCalculator({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M7.5 7h9" />
      <path d="M7.5 11h1.5M11.25 11h1.5M15 11h1.5" />
      <path d="M7.5 14.5h1.5M11.25 14.5h1.5M15 14.5v4" />
      <path d="M7.5 18h1.5M11.25 18h1.5" />
    </svg>
  )
}

// Learn — an open book
export function IconLearn({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M12 6.5c-1.6-1.3-3.6-2-6-2v12.5c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2V4.5c-2.4 0-4.4.7-6 2z" />
      <path d="M12 6.5v12.5" />
    </svg>
  )
}

// Catalogue — a photo album / stacked cards
export function IconCatalogue({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <rect x="6.5" y="5.5" width="13" height="15" rx="1.2" />
      <path d="M4 8v11.5c0 .8.6 1.5 1.5 1.5H17" />
      <circle cx="10.5" cy="10.5" r="1.4" />
      <path d="M8.5 16.5l2-2.2 1.6 1.6 2.5-3 2.4 3.6H8.5z" />
    </svg>
  )
}

// Opportunities — a small pillared building (government schemes)
export function IconOpportunities({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 9.5 12 4l8 5.5" />
      <path d="M5 9.5v9.5M9 9.5v9.5M15 9.5v9.5M19 9.5v9.5" />
      <path d="M3.5 19h17" />
    </svg>
  )
}

// Blog — a scroll
export function IconBlog({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M6.5 4h9.5a2 2 0 0 1 2 2v13.5H8.5a2 2 0 0 1-2-2z" />
      <path d="M6.5 19.5A2 2 0 0 1 4.5 17.5V6a2 2 0 0 1 2-2" />
      <path d="M9.5 8.5h5.5M9.5 12h5.5M9.5 15.5h3.5" />
    </svg>
  )
}

// Pricing — a faceted gem
export function IconPricing({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M7 4h10l3.5 5L12 20 3.5 9z" />
      <path d="M3.5 9h17M7 4l1.8 5L12 20M17 4l-1.8 5L12 20M8.8 9h6.4" />
    </svg>
  )
}

// Products — a craft pot / vessel
export function IconProducts({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M8 4.5h8" />
      <path d="M9 4.5c-.6 3-1.6 4.4-3 6-1.6 1.8-2 3.6-2 5.2 0 3 3.6 5.3 8 5.3s8-2.3 8-5.3c0-1.6-.4-3.4-2-5.2-1.4-1.6-2.4-3-3-6" />
    </svg>
  )
}

// Home
export function IconHome({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5h12V10" />
      <path d="M10 19.5V14h4v5.5" />
    </svg>
  )
}

// A checkmark used in the getting-started checklist and completion states
export function IconCheck({ size = 18, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  )
}

// Create hub — a loom frame with a shuttle, standing in for "make something"
export function IconCreate({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16" />
      <path d="M12 4v16" />
    </svg>
  )
}

// Community — two figures side by side, a shared circle between them
export function IconCommunity({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <circle cx="8.5" cy="8" r="2.6" />
      <circle cx="16" cy="9.5" r="2.1" />
      <path d="M3.5 19.5c.6-3.4 2.7-5 5-5s4.4 1.6 5 5" />
      <path d="M14.3 14.8c1.7.2 3.2 1.5 3.7 4.2" />
    </svg>
  )
}

// UpSkill / Academy — an open book with a small rising flame (learning, a diya)
export function IconUpskill({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 6.5c2.3-1.2 5-1.2 7 0v11.5c-2-1.2-4.7-1.2-7 0z" />
      <path d="M11 6.5c2.3-1.2 5-1.2 7.5 0v11.5c-2.5-1.2-5.2-1.2-7.5 0z" />
      <path d="M12.2 5.2c.5-1.4 1.6-2 2.8-1.7-.5 1-.3 1.8.5 2.4-1.2.3-2.4 0-3.3-.7z" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Profile (nav) — a simple person mark, distinct from the fuller Products box icon
export function IconProfileNav({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" />
    </svg>
  )
}

// KalaSetu Saathi — two hands joining, the programme's own mark
export function IconSaathi({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M3 13.5 7 10l3 1.5 3-2 3 1 3-2.5" />
      <path d="M3 13.5v3.5c0 .8.7 1.5 1.5 1.5H8l2 2 2-2h3.5c.8 0 1.5-.7 1.5-1.5v-4" />
      <path d="M10 12v3" />
    </svg>
  )
}

// KalaWallet — a coin with a rupee mark
export function IconWallet({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <rect x="3.5" y="7" width="17" height="12" rx="2.5" />
      <path d="M3.5 10.5h17" />
      <path d="M9.5 13.2h4M9.5 13.2c0 1.6 1.4 2.4 3 2.4M9.5 15h3.4M12.5 15.6 15 18" />
      <path d="M17.5 4.5c-1.5-.8-3-1-5-.6" />
    </svg>
  )
}

// Recognition badge — a small rosette/medallion, culturally neutral, not a game token
export function IconBadge({ size = 24, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <circle cx="12" cy="9.5" r="5" />
      <path d="M9 13.8 7.5 20l4.5-2.3L16.5 20l-1.5-6.2" />
      <path d="M12 6.8v5.4M9.6 9.5h4.8" />
    </svg>
  )
}
