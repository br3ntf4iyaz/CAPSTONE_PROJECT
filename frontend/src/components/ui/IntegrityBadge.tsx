import { ShieldCheck, ShieldAlert, Clock, ShieldOff } from 'lucide-react'
import type { IntegrityResult, IntegrityStatus } from '@/api/ledger'
import { cn } from '@/utils'

const META: Record<Exclude<IntegrityStatus, 'unanchored'>, {
  label: string; cls: string; Icon: typeof ShieldCheck; hint: string
}> = {
  verified: {
    label: 'Verified', cls: 'bg-emerald-50 text-emerald-700', Icon: ShieldCheck,
    hint: 'Matches the fingerprint recorded on the ledger.',
  },
  changed: {
    label: 'Changed since recorded', cls: 'bg-red-50 text-red-700', Icon: ShieldAlert,
    hint: 'This record no longer matches what was recorded on the ledger.',
  },
  tampered: {
    label: 'Ledger mismatch', cls: 'bg-red-50 text-red-700', Icon: ShieldAlert,
    hint: 'The ledger entry for this record is missing or has been altered.',
  },
  pending: {
    label: 'Recording…', cls: 'bg-gray-100 text-gray-600', Icon: Clock,
    hint: 'Waiting to be written to the ledger.',
  },
  failed: {
    label: 'Not recorded', cls: 'bg-amber-50 text-amber-700', Icon: ShieldOff,
    hint: 'Writing to the ledger failed. Run "python manage.py anchor_ledger" to retry.',
  },
}

/** Small chip showing whether a record still matches its ledger fingerprint. Renders nothing if never anchored. */
export function IntegrityBadge({ result, className, intactLabel }: {
  result?: IntegrityResult; className?: string
  /** Replaces "Verified" when the record is intact but "verified" could be misread (e.g. a rejected ID). */
  intactLabel?: string
}) {
  if (!result || result.status === 'unanchored') return null
  const m = result.status === 'verified' && intactLabel ? { ...META.verified, label: intactLabel } : META[result.status]
  const detail = [
    m.hint,
    result.network && `Network: ${result.network}`,
    result.block != null && `Block / entry: ${result.block}`,
    result.fingerprint && `Fingerprint: ${result.fingerprint.slice(0, 16)}…`,
  ].filter(Boolean).join('\n')

  const chip = (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', m.cls, className)}
      title={detail}
    >
      <m.Icon size={11} /> {m.label}
    </span>
  )
  return result.explorer_url ? (
    <a href={result.explorer_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">{chip}</a>
  ) : chip
}
