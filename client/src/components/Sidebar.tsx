import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TabId, User } from '../types'

const MAIN_NAV: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: '📊' },
  { id: 'predict',   label: 'Predict',   icon: '⚡' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
]

const INTEL_NAV: { id: TabId; label: string; icon: string }[] = [
  { id: 'models',     label: 'Models',     icon: '🧠' },
  { id: 'strategies', label: 'Strategies', icon: '🎯' },
  { id: 'bigdata',    label: 'Big Data',   icon: '🗄️' },
]

interface Props { active: TabId; onChange: (t: TabId) => void; user: User | null }

function NavItem({
  id, label, icon, active, onChange, collapsed,
}: { id: TabId; label: string; icon: string; active: boolean; onChange: (t: TabId) => void; collapsed: boolean }) {
  return (
    <motion.button
      key={id}
      onClick={() => onChange(id)}
      whileHover={{ x: collapsed ? 0 : 3 }}
      whileTap={{ scale: 0.97 }}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-left relative overflow-hidden transition-all"
      style={{
        background: active
          ? 'var(--gradient-brand)'
          : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        boxShadow: active ? '0 4px 20px hsl(245 65% 55% / 0.28)' : 'none',
        borderLeft: active ? '3px solid hsl(270 60% 72%)' : '3px solid transparent',
      }}
    >
      {!active && (
        <span
          className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200"
          style={{ background: 'hsl(245 60% 55% / 0.07)' }}
          aria-hidden
        />
      )}
      <span className="text-base w-5 text-center flex-shrink-0 leading-none">{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            className="text-sm font-medium whitespace-nowrap font-sans overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

export default function Sidebar({ active, onChange, user }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.nav
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col flex-shrink-0"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--surface-glass-border)',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        className="flex items-center gap-3 px-4 py-5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--surface-glass-border)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold select-none"
          style={{ background: 'var(--gradient-brand)', boxShadow: '0 4px 18px hsl(245 70% 55% / 0.35)' }}
        >
          ◈
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="font-display font-bold text-sm leading-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                ChurnIQ
              </div>
              <div className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                Analytics Platform
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav sections */}
      <div className="flex-1 px-2 py-4 overflow-y-auto">
        {/* MAIN section */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 mb-2"
            >
              <span
                className="text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ color: 'var(--text-muted)' }}
              >
                Main
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {MAIN_NAV.map(item => (
          <NavItem key={item.id} {...item} active={active === item.id} onChange={onChange} collapsed={collapsed} />
        ))}

        <div className="my-3 mx-3" style={{ height: '1px', background: 'var(--surface-glass-border)' }} />

        {/* INTELLIGENCE section */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 mb-2"
            >
              <span
                className="text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ color: 'var(--text-muted)' }}
              >
                Intelligence
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {INTEL_NAV.map(item => (
          <NavItem key={item.id} {...item} active={active === item.id} onChange={onChange} collapsed={collapsed} />
        ))}
      </div>

      {/* Bottom: user + toggle */}
      <div className="px-2 pb-4 flex-shrink-0" style={{ borderTop: '1px solid var(--surface-glass-border)' }}>
        {/* User info */}
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 px-3 py-3"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'var(--gradient-brand)' }}
              >
                {user.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-secondary)', maxWidth: 130 }}>
                  {user.name}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)', maxWidth: 130 }}>
                  {user.email}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all mt-1"
          style={{
            background: 'hsl(235 22% 13% / 0.6)',
            color: 'var(--text-muted)',
            border: '1px solid var(--surface-glass-border)',
          }}
        >
          <motion.span
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'inline-block', lineHeight: 1 }}
          >
            ›
          </motion.span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap text-[11px]"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.nav>
  )
}
