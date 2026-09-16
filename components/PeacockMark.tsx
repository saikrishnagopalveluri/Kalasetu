// The Hastkatha peacock mark, cropped from the actual brand logo artwork
// (navy peacock with feathers built from craft motifs: handloom, lotus,
// pottery, mirror-work) rather than a hand-drawn SVG approximation.
export default function PeacockMark({ size = 48, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/peacock-mark.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', ...style }}
    />
  )
}
