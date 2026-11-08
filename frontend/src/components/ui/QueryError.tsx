import { WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/utils'

interface Props {
  /** Called when the user taps "Try again" (usually the query's refetch). */
  onRetry?: () => void
  title?: string
  description?: string
  className?: string
}

/** Shown when a data request fails, so users don't mistake it for "no results". */
export function QueryError({
  onRetry,
  title = "Couldn't load this right now",
  description = 'Please check your connection and try again.',
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center py-16 text-center', className)}
    >
      <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mb-4">
        <WifiOff size={28} className="text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  )
}
