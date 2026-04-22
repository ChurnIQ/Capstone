import { useEffect, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, PointElement, LineElement } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import GlassCard from '../components/GlassCard'
import { apiFetch } from '../hooks/useApi'
import type { Stats, TrendPoint, Segment, Prediction, Pagination } from '../types'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, PointElement, LineElement)

function esc(s: unknown) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

interface Props { showToast: (m: string, t?: 'success' | 'error') => void }

export default function Overview({ showToast }: Props) {
  const [stats, setStats]   = useState<Stats | null>(null)
  const [trend, setTrend]   = useState<TrendPoint[]>([])
  const [segs, setSegs]     = useState<Segment[]>([])
  const [preds, setPreds]   = useState<Prediction[]>([])
  const [page, setPage]     = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter]   = useState('')
  const [churnFilter, setChurnFilter] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<Stats>('/api/stats'),
      apiFetch<TrendPoint[]>('/api/analytics/churn-trend'),
      apiFetch<Segment[]>('/api/analytics/risk-segments'),
    ]).then(([s, t, sg]) => { setStats(s); setTrend(t); setSegs(sg) })
      .catch(e => showToast(e.message, 'error'))
  }, [])

  useEffect(() => { loadPredictions(page) }, [page, riskFilter, churnFilter])

  async function loadPredictions(p: number) {
    const params = new URLSearchParams({ page: String(p), limit: '10' })
    if (search)      params.set('search', search)
    if (riskFilter)  params.set('risk', riskFilter)
    if (churnFilter) params.set('churn', churnFilter)
    try {
      const data = await apiFetch<{ predictions: Prediction[]; pagination: Pagination }>('/api/predictions?' + params)
      setPreds(data.predictions)
      setPagination(data.pagination)
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  const barData = {
    labels: trend.map(d => d.name),
    datasets: [
      { label: 'Churned',  data: trend.map(d => d.churn),    backgroundColor: 'hsl(4,78%,57%,0.8)',   borderRadius: 4 },
      { label: 'Retained', data: trend.map(d => d.retained), backgroundColor: 'hsl(245,70%,60%,0.8)', borderRadius: 4 },
    ],
  }
  const donutData = {
    labels: segs.map(s => s.name),
    datasets: [{ data: segs.map(s => s.value), backgroundColor: segs.map(s => s.color), borderWidth: 0, hoverOffset: 6 }],
  }
  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'hsl(220,10%,65%)', font: { size: 11 } } } }, scales: { x: { grid: { color: 'hsl(220,15%,18%)' }, ticks: { color: 'hsl(220,10%,42%)', font: { size: 11 } } }, y: { grid: { color: 'hsl(220,15%,18%)' }, ticks: { color: 'hsl(220,10%,42%)', font: { size: 11 } } } } } as const

  const statItems = stats ? [
    { label: 'Total Customers', value: stats.totalCustomers.toLocaleString(), sub: `${stats.totalPredictions} predictions run`, accent: 'hsl(245,70%,60%)' },
    { label: 'Churn Rate', value: stats.churnRate + '%', sub: stats.churnDelta !== null ? `${stats.churnDelta > 0 ? '▲' : '▼'} ${Math.abs(stats.churnDelta)}% vs last month` : 'No prior data', accent: 'hsl(4,78%,57%)' },
    { label: 'High Risk', value: stats.highRiskCount.toLocaleString(), sub: 'flagged for intervention', accent: 'hsl(38,90%,55%)' },
    { label: 'Model Accuracy', value: stats.modelAccuracy + '%', sub: stats.modelName, accent: 'hsl(148,55%,45%)' },
  ] : []

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statItems.map((s, i) => (
          <GlassCard key={s.label} delay={i * 0.05} hover className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg,${s.accent},transparent)` }} />
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            <div className="font-display text-3xl font-bold mb-1" style={{ color: s.accent }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
          </GlassCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <GlassCard delay={0.2}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Monthly Churn vs Retained</div>
          <div style={{ height: 200 }}><Bar data={barData} options={chartOpts} /></div>
        </GlassCard>
        <GlassCard delay={0.25}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Risk Distribution</div>
          <div style={{ height: 200 }}>
            <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: 'hsl(220,10%,65%)', font: { size: 11 }, padding: 14 } } } }} />
          </div>
        </GlassCard>
      </div>

      {/* Predictions table */}
      <GlassCard delay={0.3}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Recent Predictions</div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="luxury-input" style={{ flex: 1, minWidth: 160 }} placeholder="Search customer ID or name…" value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadPredictions(1)} />
          <select className="luxury-input" style={{ width: 140 }} value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1) }}>
            <option value="">All Risk Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>
          <select className="luxury-input" style={{ width: 140 }} value={churnFilter} onChange={e => { setChurnFilter(e.target.value); setPage(1) }}>
            <option value="">All Predictions</option>
            <option value="1">Will Churn</option>
            <option value="0">Will Retain</option>
          </select>
          <button className="btn-ghost" onClick={() => loadPredictions(1)}>Filter</button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>{['Customer ID','Name','Risk','Churn Prob.','Prediction','Strategy','Date'].map(h => (
              <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider pb-3 px-3" style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {preds.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No predictions yet.</td></tr>
            ) : preds.map(p => {
              const pct = (p.churn_probability * 100).toFixed(1)
              const col = p.risk_category === 'High' ? 'hsl(4,78%,57%)' : p.risk_category === 'Medium' ? 'hsl(38,90%,55%)' : 'hsl(148,55%,45%)'
              const date = new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              return (
                <tr key={p._id} className="border-t" style={{ borderColor: 'var(--surface-glass-border)' }}>
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{esc(p.customer_id)}</td>
                  <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{esc(p.customer_name)}</td>
                  <td className="px-3 py-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full risk-${p.risk_category.toLowerCase()}`}>{p.risk_category}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: col, minWidth: 42 }}>{pct}%</span>
                      <div className="prob-bar-bg flex-1"><div className="prob-bar" style={{ width: pct + '%', background: col }} /></div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm font-bold" style={{ color: p.churn_prediction ? 'hsl(4,78%,57%)' : 'hsl(148,55%,45%)' }}>
                    {p.churn_prediction ? 'Will Churn' : 'Will Retain'}
                  </td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)', maxWidth: 180 }}>{esc(p.recommended_strategy)}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-end gap-1.5 mt-4">
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&#x2039; Prev</button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(i => i === 1 || i === pagination.totalPages || Math.abs(i - page) <= 1)
              .map(i => (
                <button key={i} onClick={() => setPage(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: i === page ? 'var(--gradient-brand)' : 'var(--surface-card)', color: i === page ? '#fff' : 'var(--text-muted)', border: '1px solid var(--surface-glass-border)' }}>
                  {i}
                </button>
              ))}
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next &#x203a;</button>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
