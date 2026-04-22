import { useEffect, useState } from 'react'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Radar } from 'react-chartjs-2'
import GlassCard from '../components/GlassCard'
import { apiFetch } from '../hooks/useApi'
import type { Model } from '../types'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface Props { showToast: (m: string, t?: 'success' | 'error') => void }

export default function Models({ showToast }: Props) {
  const [models, setModels] = useState<Model[]>([])
  useEffect(() => { apiFetch<Model[]>('/api/models/comparison').then(setModels).catch(e => showToast(e.message, 'error')) }, [])

  const colors = ['hsl(245,70%,65%)','hsl(270,60%,60%)','hsl(4,78%,60%)','hsl(38,90%,58%)','hsl(148,55%,50%)','hsl(200,70%,55%)']

  return (
    <div className="space-y-5">
      <GlassCard delay={0}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Model Performance Comparison</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>{['Model','Accuracy','Precision','Recall','F1-Score'].map(h => (
              <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider pb-3 px-3" style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {models.map(m => (
              <tr key={m.model} className="border-t" style={{ borderColor: 'var(--surface-glass-border)', background: m.selected ? 'hsl(245,70%,60%,0.06)' : 'transparent' }}>
                <td className="px-3 py-3 text-sm font-semibold" style={{ color: m.selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                  {m.model}
                  {m.selected && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'hsl(148,55%,45%,0.15)', color: 'var(--color-success)' }}>BEST</span>}
                </td>
                {(['accuracy','precision','recall','f1'] as const).map(k => (
                  <td key={k} className="px-3 py-3">
                    <div className="text-sm font-bold mb-1" style={{ color: m.selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}>{m[k]}%</div>
                    <div className="h-0.5 rounded-full" style={{ background: 'hsl(220,15%,20%)' }}>
                      <div className="h-full rounded-full" style={{ width: m[k] + '%', background: m.selected ? 'var(--gradient-brand)' : 'hsl(220,15%,30%)' }} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard delay={0.1}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Radar &mdash; Model Comparison</div>
        <div style={{ maxWidth: 480, margin: '0 auto', height: 280 }}>
          <Radar
            data={{ labels: ['Accuracy','Precision','Recall','F1-Score'], datasets: models.map((m, i) => ({ label: m.model, data: [m.accuracy,m.precision,m.recall,m.f1], borderColor: colors[i], backgroundColor: colors[i].replace(')', ',0.1)').replace('hsl(', 'hsla('), borderWidth: 2, pointBackgroundColor: colors[i] })) }}
            options={{ responsive: true, maintainAspectRatio: false, scales: { r: { min: 70, max: 100, grid: { color: 'hsl(220,15%,18%)' }, pointLabels: { color: 'hsl(220,10%,65%)', font: { size: 11 } }, ticks: { color: 'hsl(220,10%,42%)', font: { size: 9 }, backdropColor: 'transparent' } } }, plugins: { legend: { position: 'bottom', labels: { color: 'hsl(220,10%,65%)', font: { size: 11 }, padding: 12 } } } }}
          />
        </div>
      </GlassCard>
    </div>
  )
}
