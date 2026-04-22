import type { User } from '../types'

interface Props { title: string; sub: string; user: User | null }

export default function Topbar({ title, sub, user }: Props) {
  return (
    <header
      className="relative flex items-center justify-between px-8 py-4 flex-shrink-0"
      style={{
        background: 'hsl(235 25% 7% / 0.85)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      {/* Gradient border bottom — stronger in centre, fades at edges */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsl(245 60% 55% / 0.35) 30%, hsl(270 55% 58% / 0.45) 50%, hsl(245 60% 55% / 0.35) 70%, transparent 100%)',
        }}
      />

      {/* Left — breadcrumb */}
      <div>
        <h1
          className="font-display font-bold leading-tight"
          style={{ fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
        >
          {title}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>

      {/* Right — status + user */}
      <div className="flex items-center gap-4">
        {/* Animated model active badge */}
        <span
          className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{
            background: 'hsl(148 55% 45% / 0.12)',
            color: 'hsl(148 60% 57%)',
            border: '1px solid hsl(148 55% 45% / 0.28)',
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: 'hsl(148 60% 55%)',
              boxShadow: '0 0 8px hsl(148 60% 55% / 0.6)',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }}
          />
          Model Active
        </span>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{
            background: 'var(--gradient-brand)',
            boxShadow: '0 2px 12px hsl(245 70% 55% / 0.3)',
          }}
        >
          {user?.name?.[0]?.toUpperCase() ?? 'U'}
        </div>

        {/* Name */}
        {user && (
          <span className="text-sm font-medium hidden md:block" style={{ color: 'var(--text-secondary)' }}>
            {user.name}
          </span>
        )}

        {/* Sign out */}
        <a
          href="/logout"
          className="text-xs font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Sign out
        </a>
      </div>
    </header>
  )
}
