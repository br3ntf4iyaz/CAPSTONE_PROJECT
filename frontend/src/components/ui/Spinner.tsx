import { cn } from '@/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-6 h-6 border-2 border-primary-700 border-t-transparent rounded-full animate-spin',
        className
      )}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="w-8 h-8" />
    </div>
  )
}
