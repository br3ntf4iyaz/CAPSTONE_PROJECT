import { AlertTriangle, CheckCircle2, Clock, Eye, FileCheck2, Globe2, Pencil, RotateCcw, Search } from 'lucide-react'
import { cn } from '@/utils'

export type ComplianceStatus =
  | 'not_submitted' | 'draft' | 'submitted' | 'under_verification' | 'returned' | 'verified' | 'published' | 'overdue'

export const STATUS_META: Record<ComplianceStatus, { label: string; cls: string; dot: string; icon: typeof Clock }> = {
  not_submitted: { label: 'Not Yet Submitted', cls: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400', icon: Clock },
  draft: { label: 'Draft', cls: 'bg-yellow-50 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400', icon: Pencil },
  submitted: { label: 'Submitted', cls: 'bg-sky-50 text-sky-800 border-sky-200', dot: 'bg-sky-500', icon: FileCheck2 },
  under_verification: { label: 'Under Verification', cls: 'bg-violet-50 text-violet-800 border-violet-200', dot: 'bg-violet-500', icon: Search },
  returned: { label: 'Returned for Correction', cls: 'bg-orange-50 text-orange-900 border-orange-200', dot: 'bg-orange-500', icon: RotateCcw },
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
  published: { label: 'Published', cls: 'bg-primary-600 text-white border-primary-700', dot: 'bg-primary-600', icon: Globe2 },
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500', icon: AlertTriangle },
}

/** One consistent status chip for the whole SK Compliance Monitoring System. */
export function StatusChip({ status, label, className }: { status: ComplianceStatus; label?: string; className?: string }) {
  const m = STATUS_META[status] ?? STATUS_META.not_submitted
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', m.cls, className)}>
      <m.icon size={12} /> {label ?? m.label}
    </span>
  )
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-600" aria-label="Status colours">
      {(Object.keys(STATUS_META) as ComplianceStatus[]).map(k => (
        <span key={k} className="inline-flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', STATUS_META[k].dot)} /> {STATUS_META[k].label}</span>
      ))}
    </div>
  )
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export function ViewIcon() { return <Eye size={13} /> }
