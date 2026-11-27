export function BarChart({ title, rows, className = () => '' }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      {rows.length === 0 && <p className="muted">No data.</p>}
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <span className="bar-label">{r.label}</span>
          <div className="bar-track">
            <div className={`bar ${className(r.key)}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="bar-value">{r.value}</span>
        </div>
      ))}
    </section>
  )
}

// Hand-written SVG line chart; series: [{name, color, points:[{date,count}]}]
export function LineChart({ title, series }) {
  const W = 600
  const H = 160
  const pad = 24
  const len = Math.max(2, ...series.map((s) => s.points.length))
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.count)))
  const x = (i) => pad + (i / (len - 1)) * (W - pad * 2)
  const y = (v) => H - pad - (v / max) * (H - pad * 2)
  const dates = series[0]?.points || []
  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" role="img" aria-label={title}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e1e5eb" />
        <text x={4} y={pad} fontSize="10" fill="#6b7686">{max}</text>
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.points.map((p, i) => `${x(i)},${y(p.count)}`).join(' ')} />
            {s.points.map((p, i) => (
              <circle key={p.date} cx={x(i)} cy={y(p.count)} r="3" fill={s.color}><title>{`${s.name} ${p.date}: ${p.count}`}</title></circle>
            ))}
          </g>
        ))}
        {dates.map((p, i) => (i % 2 === 0 ? <text key={p.date} x={x(i)} y={H - 6} fontSize="9" fill="#6b7686" textAnchor="middle">{p.date.slice(5)}</text> : null))}
      </svg>
      <div className="legend">
        {series.map((s) => <span key={s.name}><i style={{ background: s.color }} /> {s.name}</span>)}
      </div>
    </section>
  )
}

export function ProgressBar({ percent, state }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)))
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill sla-${state}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
