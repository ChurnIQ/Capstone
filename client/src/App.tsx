import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Overview from './tabs/Overview'
import Predict from './tabs/Predict'
import Analytics from './tabs/Analytics'
import Models from './tabs/Models'
import Strategies from './tabs/Strategies'
import BigData from './tabs/BigData'
import { apiFetch } from './hooks/useApi'
import type { User, TabId } from './types'

const TAB_META: Record<TabId, { title: string; sub: string }> = {
  overview:   { title: 'Overview',            sub: 'System-wide churn metrics and recent predictions' },
  predict:    { title: 'Predict Churn',        sub: 'Run single or bulk predictions on customer records' },
  analytics:  { title: 'Analytics',           sub: 'Feature importance, risk segments & churn trends' },
  models:     { title: 'Model Evaluation',    sub: 'Compare classification & ensemble model performance' },
  strategies: { title: 'Retention Strategies',sub: 'Risk-based action playbook for customer retention' },
  bigdata:    { title: 'Big Data Processing', sub: 'Batch predictions, chunk processing & data pipeline' },
}

export default function App() {
  const [tab, setTab]     = useState<TabId>('overview')
  const [user, setUser]   = useState<User | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    apiFetch<User>('/api/me').then(setUser).catch(() => {})
  }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const meta = TAB_META[tab]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={tab} onChange={setTab} user={user} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar title={meta.title} sub={meta.sub} user={user} />

        <main className="flex-1 overflow-y-auto px-8 py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {tab === 'overview'   && <Overview   showToast={showToast} />}
              {tab === 'predict'    && <Predict    showToast={showToast} />}
              {tab === 'analytics'  && <Analytics  showToast={showToast} />}
              {tab === 'models'     && <Models     showToast={showToast} />}
              {tab === 'strategies' && <Strategies />}
              {tab === 'bigdata'    && <BigData />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0,  x: 0  }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-2xl ${
              toast.type === 'success'
                ? 'bg-emerald-500/90 text-white backdrop-blur-sm'
                : 'bg-red-500/90 text-white backdrop-blur-sm'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
