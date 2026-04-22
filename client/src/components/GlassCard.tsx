import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

type Variant = 'default' | 'elevated' | 'primary'

interface Props {
  children: ReactNode
  className?: string
  style?: CSSProperties
  hover?: boolean
  delay?: number
  variant?: Variant
}

const variantClass: Record<Variant, string> = {
  default:  '',
  elevated: 'glass-elevated',
  primary:  'glass-primary',
}

const variantHoverShadow: Record<Variant, string> = {
  default:  '0 16px 48px hsl(245 60% 20% / 0.32), 0 0 0 1px hsl(245 40% 55% / 0.28)',
  elevated: '0 20px 60px hsl(245 65% 25% / 0.42), 0 0 0 1px hsl(245 50% 60% / 0.35)',
  primary:  '0 16px 48px hsl(245 65% 22% / 0.36), 0 0 0 1px hsl(245 60% 60% / 0.3)',
}

export default function GlassCard({
  children,
  className = '',
  style,
  hover = false,
  delay = 0,
  variant = 'default',
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1], delay }}
      whileHover={
        hover
          ? { y: -3, boxShadow: variantHoverShadow[variant], transition: { duration: 0.22 } }
          : undefined
      }
      className={`glass ${variantClass[variant]} ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  )
}
