// A sparse, low-opacity feather accent for a hero/banner corner — echoing
// the brand board's asymmetric peacock-feather flourish. Deliberately
// restrained (low opacity, one corner) rather than a repeating pattern:
// the brand guide itself says not to use busy backgrounds.
export default function FeatherFlourish({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 260 220"
      className={className}
      style={{ opacity: 0.16, ...style }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M10 210 C 70 190, 130 150, 180 90 C 150 130, 100 165, 40 190 Z" fill="#0F5B4E" />
      <circle cx="130" cy="130" r="7" fill="#F4EFE6" />

      <path d="M30 215 C 95 180, 155 125, 195 55 C 160 105, 105 155, 45 195 Z" fill="#D4A017" />
      <circle cx="150" cy="105" r="6.3" fill="#F4EFE6" />

      <path d="M55 218 C 120 170, 175 105, 210 25 C 180 85, 120 145, 65 198 Z" fill="#C4552D" />
      <circle cx="170" cy="80" r="5.6" fill="#F4EFE6" />
    </svg>
  )
}
