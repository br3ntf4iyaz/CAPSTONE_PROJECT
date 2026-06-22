import { cn } from '@/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  trend?: string
  trendUp?: boolean
  onClick?: () => void
}

export function StatCard({ label, value, icon: Icon, iconBg = 'bg-primary-100', iconColor = 'text-primary-700', trend, trendUp, onClick }: Props) {
  return (
    <div
      className={cn('stat-card', onClick && 'cursor-pointer hover:shadow-md hover:border-primary-200 transition-all')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div className={cn('stat-icon', iconBg)}>
        <Icon size={22} className={iconColor} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {trend && (
          <p className={cn('text-xs mt-0.5', trendUp ? 'text-green-600' : 'text-red-500')}>
            {trendUp ? '↑' : '↓'} {trend}
          </p>
        )}
      </div>
    </div>
  )
}
