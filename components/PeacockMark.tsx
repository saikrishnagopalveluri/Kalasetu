// The Hastkatha peacock mark, from the actual brand logo artwork (navy
// peacock with feathers built from craft motifs: handloom, lotus, pottery,
// mirror-work). The artwork is wider than it is tall, so `size` sets the
// height and the width follows its real proportions. Never put it in a
// square or circular frame that clips it: the crest and tail get cut off.
export const PEACOCK_ASPECT = 512 / 360

export default function PeacockMark({ size = 48, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/peacock-mark.png"
      alt=""
      width={Math.round(size * PEACOCK_ASPECT)}
      height={size}
      className={className}
      style={{ objectFit: 'contain', ...style }}
    />
  )
}
