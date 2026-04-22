import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import { apiFetch } from '../hooks/useApi'
import type { BatchStats } from '../types'

const ARCH = [
  { label: 'User Data',                layer: 'Input Layer',       color: 'hsl(245,70%,60%)' },
  { label: 'Hadoop / MongoDB',         layer: 'Storage Layer',     color: 'hsl(270,60%,55%)' },
  { label: 'Spark / Pandas (Chunked)', layer: 'Processing Layer',  color: 'hsl(38,90%,55%)' },
  { label: 'ML Model (Random Forest)', layer: 'Prediction Layer',  color: 'hsl(4,78%,57%)' },
  { label: 'Flask API',                layer: 'API Layer',         color: 'hsl(148,55%,45%)' },
  { label: 'Website Dashboard',        layer: 'Presentation Layer',color: 'hsl(245,70%,60%)' },
]

const PIPE = [
  { icon: 'IN', label: 'Data Ingestion' },
  { icon: 'P',  label: 'Processing' },
  { icon: 'AI', label: 'Prediction' },
  { icon: 'OUT',label: 'Output' },
]

export default function BigData() {
  const [stats, setStats]       = useState<BatchStats | null>(null)
  const [pipeStep]              = useState(1)
  const [procStats]             = useState<{ records: number; time: number; chunks: number; avg: number } | null>(null)
  const [datasetMode, setDatasetMode] = useState<'full'|'sample'>('full')

  useEffect(() => {
    apiFetch<BatchStats>('/api/batch-stats').then(setStats).catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        {/* Architecture */}
        <GlassCard delay={0}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>Big Data Architecture</div>
          <div className="flex flex-col items-center gap-0">
            {ARCH.map((node, i) => (
              <div key={node.label} className="flex flex-col items-center w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="w-56 py-2.5 px-4 rounded-xl text-center text-xs font-bold font-display"
                  style={{ background: `${node.color.slice(0,-1)},0.1)`, border: `1.5px solid ${node.color.slice(0,-1)},0.3)`, color: node.color }}
                >
                  {node.label}
                </motion.div>
                {i < ARCH.length - 1 && (
                  <div className="flex flex-col items-center my-0.5">
                    <div className="text-base" style={{ color: 'hsl(220,15%,30%)' }}>&darr;</div>
                    <div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>{ARCH[i + 1].layer}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Insights */}
          <GlassCard delay={0.05}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Aggregated Insights</div>
            <div className="grid grid-cols-3 gap-3 mb-0">
              {[
                { label: 'Avg Churn Rate', value: stats ? stats.avgChurnRate + '%' : '\u2014', sub: 'across all records' },
                { label: 'High-Risk Users', value: stats ? stats.highRiskCount.toLocaleString() : '\u2014', sub: 'flagged for action' },
                { label: 'Total Processed', value: stats ? stats.totalProcessed.toLocaleString() : '\u2014', sub: 'records in system' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: 'hsl(245,70%,60%,0.07)', border: '1px solid hsl(245,70%,60%,0.18)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                  <div className="font-display text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{item.value}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Dataset mode */}
          <GlassCard delay={0.1}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Dataset Sampling Mode</div>
            <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--surface-glass-border)', width: 'fit-content' }}>
              {(['full','sample'] as const).map(m => (
                <button key={m} onClick={() => setDatasetMode(m)}
                  className="px-4 py-2 text-xs font-semibold font-sans transition-all"
                  style={{ background: datasetMode === m ? 'var(--gradient-brand)' : 'transparent', color: datasetMode === m ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                  {m === 'full' ? 'Full Dataset' : 'Sample (10%)'}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {datasetMode === 'full' ? 'Using full dataset \u2014 all records included.' : 'Sample mode \u2014 processing 10% representative subset.'}
            </p>
          </GlassCard>
        </div>
      </div>

      {/* Pipeline */}
      <GlassCard delay={0.15}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Data Pipeline</div>
        <div className="flex items-center justify-center flex-wrap gap-0 mb-4">
          {PIPE.map((step, i) => (
            <div key={step.label} className="flex items-center">
              <motion.div
                animate={{ borderColor: i < pipeStep ? 'hsl(245,70%,60%)' : 'hsl(220,15%,25%)', background: i < pipeStep ? 'hsl(245,70%,60%,0.15)' : 'hsl(220,15%,14%)' }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl text-center min-w-[100px]"
                style={{ border: '1.5px solid', cursor: 'default' }}
              >
                <span className="text-sm font-bold font-display" style={{ color: i < pipeStep ? 'var(--color-primary)' : 'var(--text-muted)' }}>{step.icon}</span>
                <span className="text-[10px] font-bold" style={{ color: i < pipeStep ? 'var(--color-primary)' : 'var(--text-muted)' }}>{step.label}</span>
              </motion.div>
              {i < PIPE.length - 1 && <span className="px-2 text-lg" style={{ color: 'hsl(220,15%,30%)' }}>&rarr;</span>}
            </div>
          ))}
        </div>
        {procStats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3 mt-2">
            {[
              { label: 'Records', value: procStats.records.toLocaleString() },
              { label: 'Time (s)',  value: String(procStats.time) },
              { label: 'Chunks',  value: String(procStats.chunks) },
              { label: 'Avg ms/record', value: String(procStats.avg) },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'hsl(245,70%,60%,0.07)', border: '1px solid hsl(245,70%,60%,0.18)' }}>
                <div className="font-display text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{s.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}
        {procStats && <div className="mt-3 text-center text-sm font-semibold font-display" style={{ color: 'var(--color-primary)' }}>Processed {procStats.records.toLocaleString()} records in {procStats.time} seconds</div>}
      </GlassCard>

    </div>
  )
}
