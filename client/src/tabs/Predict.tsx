import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import { apiFetch } from '../hooks/useApi'

interface PredResult {
  churn_prediction: 0 | 1
  churn_probability: number
  risk_category: 'High' | 'Medium' | 'Low'
  churn_reasons?: string[]
  recommended_strategies?: string[]
  recommended_strategy?: string
}
interface Props { showToast: (m: string, t?: 'success' | 'error') => void }

const FIELDS = [
  { name: 'customer_id',            label: 'Customer ID *',         type: 'text',   placeholder: 'e.g. C-1042' },
  { name: 'customer_name',          label: 'Customer Name',         type: 'text',   placeholder: 'e.g. Ananya Sharma' },
  { name: 'age',                    label: 'Age',                   type: 'number', placeholder: '25' },
  { name: 'no_of_days_subscribed',  label: 'Days Subscribed',       type: 'number', placeholder: '180' },
  { name: 'weekly_mins_watched',    label: 'Weekly Mins Watched',   type: 'number', placeholder: '120' },
  { name: 'minimum_daily_mins',     label: 'Min Daily Mins',        type: 'number', placeholder: '10' },
  { name: 'maximum_daily_mins',     label: 'Max Daily Mins',        type: 'number', placeholder: '90' },
  { name: 'weekly_max_night_mins',  label: 'Weekly Max Night Mins', type: 'number', placeholder: '45' },
  { name: 'videos_watched',         label: 'Videos Watched',        type: 'number', placeholder: '42' },
  { name: 'maximum_days_inactive',  label: 'Max Days Inactive',     type: 'number', placeholder: '7' },
  { name: 'customer_support_calls', label: 'Support Calls',         type: 'number', placeholder: '2' },
] as const

export default function Predict({ showToast }: Props) {
  const [form, setForm]           = useState<Record<string, string>>({})
  const [gender, setGender]       = useState('')
  const [multiScreen, setMultiScreen] = useState('')
  const [mailSub, setMailSub]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<PredResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStats, setUploadStats] = useState<{ saved: number; total: number } | null>(null)

  async function handlePredict() {
    if (!form.customer_id) { showToast('Customer ID is required', 'error'); return }
    setLoading(true)
    try {
      const data = { ...form, gender, multi_screen: multiScreen, mail_subscribed: mailSub }
      const res = await apiFetch<PredResult>('/api/predict', { method: 'POST', body: JSON.stringify(data) })
      setResult(res)
      showToast('Prediction complete — ' + res.risk_category + ' risk')
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    finally { setLoading(false) }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    setUploading(true)
    const fd = new FormData()
    fd.append('dataset', e.target.files[0])
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUploadStats({ saved: data.saved, total: data.total })
      showToast(`${data.saved} of ${data.total} predictions saved`)
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    finally { setUploading(false); e.target.value = '' }
  }

  const col = result
    ? result.risk_category === 'High' ? 'hsl(4,78%,57%)' : result.risk_category === 'Medium' ? 'hsl(38,90%,55%)' : 'hsl(148,55%,45%)'
    : ''

  const strategies = result
    ? (Array.isArray(result.recommended_strategies) && result.recommended_strategies.length
        ? result.recommended_strategies
        : result.recommended_strategy ? [result.recommended_strategy] : [])
    : []

  const reasons = result?.churn_reasons ?? []

  return (
    <div className="space-y-5">
      {/* Predict form */}
      <GlassCard delay={0}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Customer Churn Prediction</div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {FIELDS.map(f => (
            <div key={f.name}>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} className="luxury-input"
                value={form[f.name] ?? ''} onChange={e => setForm(prev => ({ ...prev, [f.name]: e.target.value }))} />
            </div>
          ))}
          {[
            { label: 'Gender',         state: gender,      set: setGender,      opts: ['', 'Male', 'Female', 'Other'] },
            { label: 'Multi-Screen',   state: multiScreen, set: setMultiScreen, opts: ['', 'Yes', 'No'] },
            { label: 'Mail Subscribed',state: mailSub,     set: setMailSub,     opts: ['', 'Yes', 'No'] },
          ].map(({ label, state, set, opts }) => (
            <div key={label}>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <select className="luxury-input" value={state} onChange={e => set(e.target.value)}>
                {opts.map(o => <option key={o} value={o}>{o || 'Select\u2026'}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" disabled={loading} onClick={handlePredict}>
            {loading ? <><span className="spinner" />Predicting&hellip;</> : 'Run Prediction'}
          </button>
          <button className="btn-ghost" onClick={() => { setForm({}); setGender(''); setMultiScreen(''); setMailSub(''); setResult(null) }}>Clear</button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl p-5"
              style={{ background: `${col}0f`, border: `1px solid ${col}33` }}
            >
              {/* Header row */}
              <div className="flex justify-between items-start flex-wrap gap-4 mb-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Churn Probability</div>
                  <div className="font-display text-5xl font-bold" style={{ color: col }}>{(result.churn_probability * 100).toFixed(1)}%</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Predicted by Random Forest</div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full risk-${result.risk_category.toLowerCase()}`}>{result.risk_category} Risk</span>
                  <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Prediction</div>
                    <div className="font-display text-xl font-bold" style={{ color: col }}>{result.churn_prediction ? 'Will Churn' : 'Will Retain'}</div>
                  </div>
                </div>
              </div>

              {/* Reasons + Strategies side by side */}
              <div className="grid grid-cols-2 gap-4">
                {reasons.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'hsl(4,78%,57%,0.07)', border: '1px solid hsl(4,78%,57%,0.2)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Churn Signals</div>
                    {reasons.map(r => (
                      <div key={r} className="flex items-start gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: col }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {strategies.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'hsl(245,70%,60%,0.07)', border: '1px solid hsl(245,70%,60%,0.18)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Recommended Strategies</div>
                    {strategies.map(s => (
                      <div key={s} className="flex items-start gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* fallback if both empty */}
                {reasons.length === 0 && strategies.length === 0 && (
                  <div className="col-span-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No signals detected.</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Batch upload + info 2-col */}
      <div className="grid grid-cols-2 gap-5">
        <GlassCard delay={0.1}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Bulk Predict via CSV</div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Upload a structured CSV to run predictions on thousands of customers using chunk-based processing (1,000 rows per chunk).</p>
          <div className="rounded-xl p-5 text-center mb-4" style={{ border: '1.5px dashed hsl(245,30%,35%)', background: 'hsl(245,20%,12%)' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Drop CSV or click to upload</div>
            <input type="file" id="csv-upload" accept=".csv" className="hidden" onChange={handleUpload} />
            <button className="btn-primary" disabled={uploading} onClick={() => document.getElementById('csv-upload')?.click()}>
              {uploading ? <><span className="spinner" />Processing&hellip;</> : 'Upload & Predict'}
            </button>
          </div>
          {uploadStats && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center text-sm font-semibold font-display"
              style={{ color: 'var(--color-success, hsl(148,55%,45%))' }}>
              {uploadStats.saved} of {uploadStats.total} predictions saved
            </motion.div>
          )}
        </GlassCard>

        <GlassCard delay={0.15}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Required CSV Columns</div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Ensure your CSV file contains the following columns. Missing values will use model defaults.</p>
          <div className="flex flex-wrap gap-2">
            {['customer_id','customer_name','age','no_of_days_subscribed','weekly_mins_watched','minimum_daily_mins','maximum_daily_mins','weekly_max_night_mins','videos_watched','maximum_days_inactive','customer_support_calls','multi_screen','mail_subscribed'].map(col => (
              <code key={col} className="text-[10px] px-2 py-1 rounded-md font-mono"
                style={{ background: 'hsl(220,15%,18%)', color: 'var(--color-primary)', border: '1px solid hsl(245,30%,25%)' }}>
                {col}
              </code>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
