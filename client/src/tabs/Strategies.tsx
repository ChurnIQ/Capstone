import GlassCard from '../components/GlassCard'

const CARDS = [
  { risk: 'High',   color: 'hsl(4,78%,57%)',   desc: 'Churn probability ≥ 70%. Immediate intervention required.' },
  { risk: 'Medium', color: 'hsl(38,90%,55%)',  desc: 'Churn probability 40–70%. Proactive engagement recommended.' },
  { risk: 'Low',    color: 'hsl(148,55%,45%)', desc: 'Churn probability < 40%. Maintain routine engagement.' },
]

const ACTIONS = {
  High:   ['Personal outreach call within 24 hours', 'Offer 20–30% discount on renewal', 'Assign dedicated account manager', 'Escalate to customer success within 48h'],
  Medium: ['Personalized re-engagement email', 'Highlight underutilised features', 'Push notification with exclusive offer', 'Send monthly usage summary report'],
  Low:    ['Monthly newsletter', 'Loyalty rewards program', 'Early access to new features'],
}

const MEDIUM_WEEKS = [
  {
    week: 'Week 1',
    title: 'Re-engagement Email',
    icon: '✉️',
    color: 'hsl(38,90%,55%)',
    steps: [
      'Send personalised subject line using customer name',
      'Highlight content they haven\'t explored yet',
      'Include one-click CTA to resume watching',
    ],
  },
  {
    week: 'Week 2',
    title: 'Feature Nudge',
    icon: '💡',
    color: 'hsl(270,60%,58%)',
    steps: [
      'In-app notification: "Try multi-screen mode"',
      'Short tutorial video (< 90 seconds)',
      'Feature unlock badge for engagement milestone',
    ],
  },
  {
    week: 'Week 3',
    title: 'Usage Report',
    icon: '📊',
    color: 'hsl(200,80%,50%)',
    steps: [
      'Send personalised monthly watch summary',
      'Show top genre and time-of-day pattern',
      'Curated playlist based on watch history',
    ],
  },
  {
    week: 'Week 4',
    title: 'Exclusive Offer',
    icon: '🎁',
    color: 'hsl(148,55%,45%)',
    steps: [
      'Offer 15% loyalty discount on next billing',
      'Limited-time upgrade to premium tier',
      'Trigger if weeks 1–3 show < 20% lift in usage',
    ],
  },
]

const TRIGGER_SIGNALS = [
  { label: 'Inactivity > 7 days', detail: 'No session in past week' },
  { label: 'Weekly watch < 60 min', detail: 'Engagement below threshold' },
  { label: 'Support calls ≥ 2', detail: 'Elevated complaint activity' },
  { label: 'No mail subscription', detail: 'Missing communication channel' },
]

const SUCCESS_METRICS = [
  { label: 'Open Rate', target: '> 28%' },
  { label: 'Feature Adoption', target: '> 35%' },
  { label: 'Retention Lift', target: '> 15%' },
  { label: 'Churn Reduction', target: '> 20%' },
]

export default function Strategies() {
  const medCol = 'hsl(38,90%,55%)'

  return (
    <div className="space-y-5">
      {/* Risk tier summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {CARDS.map((c, i) => (
          <GlassCard key={c.risk} delay={i * 0.07} hover className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg,${c.color},transparent)` }} />
            <div className="font-display text-lg font-bold mb-2" style={{ color: c.color }}>{c.risk} Risk</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.desc}</div>
          </GlassCard>
        ))}
      </div>

      {/* High + Low playbook */}
      <GlassCard delay={0.2}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>Retention Playbook — High &amp; Low Risk</div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {(['High', 'Low'] as const).map(risk => {
            const color = risk === 'High' ? 'hsl(4,78%,57%)' : 'hsl(148,55%,45%)'
            return (
              <div key={risk} className="rounded-xl p-4" style={{ background: `${color.slice(0, -1)},0.06)`, border: `1px solid ${color.slice(0, -1)},0.2)` }}>
                <div className="text-xs font-bold mb-3" style={{ color }}>{risk} Risk — {risk === 'High' ? 'Immediate' : 'Maintenance'} Actions</div>
                {ACTIONS[risk].map(a => (
                  <div key={a} className="flex items-start gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Medium Risk 4-week playbook */}
      <GlassCard delay={0.28}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Medium Risk — 4-Week Retention Playbook</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Structured engagement programme for customers at moderate churn risk (40–70%)</div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: `${medCol.slice(0,-1)},0.15)`, color: medCol, border: `1px solid ${medCol.slice(0,-1)},0.35)` }}>Medium Risk</span>
        </div>

        {/* Week cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {MEDIUM_WEEKS.map((w, i) => (
            <div key={w.week} className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: `${w.color.slice(0,-1)},0.07)`, border: `1px solid ${w.color.slice(0,-1)},0.22)` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{w.icon}</span>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{w.week}</div>
                  <div className="text-xs font-bold font-display" style={{ color: w.color }}>{w.title}</div>
                </div>
              </div>
              {w.steps.map((s, j) => (
                <div key={j} className="flex items-start gap-1.5">
                  <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: w.color }} />
                  <span className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Trigger signals + success metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ background: 'hsl(38,90%,55%,0.06)', border: '1px solid hsl(38,90%,55%,0.2)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Trigger Signals</div>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGER_SIGNALS.map(t => (
                <div key={t.label} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: medCol }} />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'hsl(148,55%,45%,0.06)', border: '1px solid hsl(148,55%,45%,0.2)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Success Metrics</div>
            <div className="grid grid-cols-2 gap-3">
              {SUCCESS_METRICS.map(m => (
                <div key={m.label} className="rounded-lg p-2 text-center" style={{ background: 'hsl(148,55%,45%,0.08)' }}>
                  <div className="font-display text-base font-bold" style={{ color: 'hsl(148,55%,45%)' }}>{m.target}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
