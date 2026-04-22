import { useEffect, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import GlassCard from '../components/GlassCard'
import { apiFetch } from '../hooks/useApi'
import type { Feature, TrendPoint, Segment } from '../types'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

interface Props { showToast: (m: string, t?: 'success' | 'error') => void }

export default function Analytics({ showToast }: Props) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [trend, setTrend]       = useState<TrendPoint[]>([])
  const [segs, setSegs]         = useState<Segment[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch<Feature[]>('/api/analytics/feature-importance'),
      apiFetch<TrendPoint[]>('/api/analytics/churn-trend'),
      apiFetch<Segment[]>('/api/analytics/risk-segments'),
    ]).then(([f, t, s]) => { setFeatures(f); setTrend(t); setSegs(s) })
      .catch(e => showToast(e.message, 'error'))
  }, [])

  const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'hsl(220,10%,65%)', font: { size: 11 } } } }, scales: { x: { grid: { color: 'hsl(220,15%,18%)' }, ticks: { color: 'hsl(220,10%,42%)', font: { size: 11 } } }, y: { grid: { color: 'hsl(220,15%,18%)' }, ticks: { color: 'hsl(220,10%,42%)', font: { size: 11 } } } } } as const

  const hd = segs.find(s => s.name.includes('High'))   ?? { value: 0 }
  const md = segs.find(s => s.name.includes('Medium')) ?? { value: 0 }
  const ld = segs.find(s => s.name.includes('Low'))    ?? { value: 0 }

  return (
    <div className="space-y-5">
      <GlassCard delay={0}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Feature Importance</div>
        <div style={{ height: 180 }}>
          <Bar
            data={{ labels: features.map(f => f.feature), datasets: [{ data: features.map(f => parseFloat((f.importance * 100).toFixed(1))), backgroundColor: features.map((_, i) => `hsl(${245 + i * 15},60%,${62 - i * 4}%)`), borderRadius: 4 }] }}
            options={{ ...opts, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x}%` } } } }}
          />
        </div>
      </GlassCard>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <GlassCard delay={0.1}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Churn Trend &mdash; 6 Months</div>
          <div style={{ height: 200 }}>
            <Line
              data={{ labels: trend.map(d => d.name), datasets: [
                { label: 'Churned',  data: trend.map(d => d.churn),    borderColor: 'hsl(4,78%,57%)',   backgroundColor: 'hsl(4,78%,57%,0.08)',   fill: true, tension: 0.4, pointBackgroundColor: 'hsl(4,78%,57%)',   pointRadius: 4 },
                { label: 'Retained', data: trend.map(d => d.retained), borderColor: 'hsl(245,70%,60%)', backgroundColor: 'hsl(245,70%,60%,0.08)', fill: true, tension: 0.4, pointBackgroundColor: 'hsl(245,70%,60%)', pointRadius: 4 },
              ]}}
              options={opts}
            />
          </div>
        </GlassCard>

        <GlassCard delay={0.15}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Risk Segments</div>
          {[
            { label: 'High Risk',   value: hd.value, color: 'hsl(4,78%,57%)' },
            { label: 'Medium Risk', value: md.value, color: 'hsl(38,90%,55%)' },
            { label: 'Low Risk',    value: ld.value, color: 'hsl(148,55%,45%)' },
          ].map(s => (
            <div key={s.label} className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.value}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'hsl(220,15%,18%)' }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: s.value + '%', background: s.color }} />
              </div>
            </div>
          ))}
          <div className="mt-4 p-3 rounded-xl" style={{ background: 'hsl(245,70%,60%,0.07)', border: '1px solid hsl(245,70%,60%,0.18)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--color-primary)' }}>Insight</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{hd.value}% of customers are high risk &mdash; prioritise immediate outreach.</div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
