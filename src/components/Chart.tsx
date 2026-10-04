export function Chart({ points, unit }: { points: { x: string; y: number }[]; unit: string }) {
  if (points.length < 2) return <p className="mute">Log at least two entries to see a trend.</p>
  const W = 320, H = 100, ys = points.map(p => p.y)
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1
  const L = 44 // left gutter so axis labels never sit on the line
  const pts = points.map((p, i) => `${L + (i / (points.length - 1)) * (W - L - 4)},${H - ((p.y - min) / span) * (H - 20) - 10}`).join(' ')
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Trend in ${unit}`}>
      <polyline className="line" points={pts} />
      <text className="axis" x="0" y="10">{max}{unit}</text>
      <text className="axis" x="0" y={H}>{min}{unit}</text>
    </svg>
  )
}
