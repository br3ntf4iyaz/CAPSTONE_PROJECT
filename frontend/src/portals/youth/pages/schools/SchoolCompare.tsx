import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { X, GraduationCap, Check, Minus, ExternalLink } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { TYPE_LABELS } from './constants'

export const MAX_COMPARE = 3

/** The few fields needed to pick a school; full details are loaded when comparing. */
export interface CompareItem {
  id: number
  name: string
  slug: string
  school_type: string
}

interface DetailProgram {
  id: number
  program: { id: number; name: string; program_type: string }
  scholarship_available: boolean
  tuition_per_year?: string | null
}

interface SchoolDetail extends CompareItem {
  address?: string
  municipality?: string
  province?: string
  phone?: string
  email?: string
  website?: string
  programs?: DetailProgram[]
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`

function tuitionRange(programs: DetailProgram[] = []): string {
  const values = programs
    .map(p => (p.tuition_per_year != null ? Number(p.tuition_per_year) : NaN))
    .filter(n => Number.isFinite(n) && n > 0)
  if (values.length === 0) return 'Not listed'
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? `${peso(min)} / year` : `${peso(min)} – ${peso(max)} / year`
}

// ─── Bottom tray ─────────────────────────────────────────────────────────────

export function CompareTray({
  items, onRemove, onClear, onOpen,
}: {
  items: CompareItem[]
  onRemove: (id: number) => void
  onClear: () => void
  onOpen: () => void
}) {
  if (items.length === 0) return null
  const ready = items.length >= 2
  return (
    <div
      role="region"
      aria-label="Schools to compare"
      className="fixed inset-x-0 bottom-16 md:bottom-4 z-40 px-3 pointer-events-none"
    >
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-3 flex items-center gap-3 pointer-events-auto">
        <ul className="flex-1 min-w-0 flex flex-wrap gap-1.5">
          {items.map(s => (
            <li key={s.id} className="inline-flex items-center gap-1 max-w-full text-xs bg-primary/10 text-primary rounded-full pl-2.5 pr-1 py-1">
              <span className="truncate max-w-[9rem]">{s.name}</span>
              <button onClick={() => onRemove(s.id)} aria-label={`Remove ${s.name} from comparison`} className="p-0.5 rounded-full hover:bg-primary/20">
                <X size={12} />
              </button>
            </li>
          ))}
          {!ready && <li className="text-xs text-gray-400 self-center">Pick at least 2 schools</li>}
        </ul>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">Clear</button>
        <button onClick={onOpen} disabled={!ready} className="btn-primary btn-sm text-xs flex-shrink-0 disabled:opacity-50">
          Compare ({items.length})
        </button>
      </div>
    </div>
  )
}

// ─── Comparison sheet ────────────────────────────────────────────────────────

export function CompareSheet({ items, onClose }: { items: CompareItem[]; onClose: () => void }) {
  const results = useQueries({
    queries: items.map(s => ({
      queryKey: ['school-detail', s.id],
      queryFn: () => apiClient.get(`/schools/${s.id}/`).then(r => r.data as SchoolDetail),
    })),
  })
  const loading = results.some(r => r.isLoading)
  const failed = results.some(r => r.isError)
  const schools: SchoolDetail[] = results.map((r, i) => r.data ?? { ...items[i] })

  // Programs offered by every school come first; the rest are marked per school.
  const programRows = useMemo(() => {
    const byName = new Map<string, { name: string; type: string; offeredBy: Set<number> }>()
    schools.forEach(s =>
      (s.programs ?? []).forEach(p => {
        const key = p.program.name.trim().toLowerCase()
        const row = byName.get(key) ?? { name: p.program.name, type: p.program.program_type, offeredBy: new Set<number>() }
        row.offeredBy.add(s.id)
        byName.set(key, row)
      }),
    )
    const rows = [...byName.values()]
    const inAll = (r: { offeredBy: Set<number> }) => r.offeredBy.size === schools.length
    return {
      common: rows.filter(inAll).sort((a, b) => a.name.localeCompare(b.name)),
      others: rows.filter(r => !inAll(r)).sort((a, b) => a.name.localeCompare(b.name)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map(r => r.dataUpdatedAt).join(','), items.length])

  const rowsSpec: { label: string; cell: (s: SchoolDetail) => React.ReactNode }[] = [
    { label: 'Type', cell: s => TYPE_LABELS[s.school_type] ?? s.school_type },
    { label: 'Location', cell: s => [s.address, s.municipality, s.province].filter(Boolean).join(', ') || '—' },
    { label: 'Programs offered', cell: s => `${s.programs?.length ?? 0}` },
    { label: 'Tuition', cell: s => tuitionRange(s.programs) },
    {
      label: 'Scholarships',
      cell: s => {
        const n = (s.programs ?? []).filter(p => p.scholarship_available).length
        return n > 0
          ? <span className="text-emerald-700 font-medium">Yes, {n} program{n !== 1 ? 's' : ''}</span>
          : <span className="text-gray-400">None listed</span>
      },
    },
    {
      label: 'Contact',
      cell: s => (
        <div className="space-y-0.5 min-w-0">
          {s.phone && <p>{s.phone}</p>}
          {s.email && <p className="break-words">{s.email}</p>}
          {s.website && (
            <a href={s.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Website <ExternalLink size={11} />
            </a>
          )}
          {!s.phone && !s.email && !s.website && '—'}
        </div>
      ),
    },
  ]

  const colMin = 'min-w-[10.5rem]'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare schools"
        className="bg-white w-full sm:max-w-4xl sm:rounded-2xl max-h-[94vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Compare schools</h2>
          <button onClick={onClose} aria-label="Close comparison" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <p className="px-6 py-12 text-center text-sm text-gray-400">Loading comparison…</p>
          ) : (
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-white w-24 sm:w-32" />
                  {schools.map(s => (
                    <th key={s.id} className={cn('sticky top-0 z-10 bg-white text-left align-top px-3 py-3 border-b border-gray-100', colMin)}>
                      <div className="flex items-start gap-2">
                        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <GraduationCap size={15} className="text-primary" />
                        </span>
                        <span className="font-semibold text-gray-900 leading-snug">{s.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsSpec.map(row => (
                  <tr key={row.label}>
                    <th scope="row" className="sticky left-0 z-10 bg-gray-50 text-left align-top text-xs font-semibold text-gray-500 px-3 py-3 border-b border-gray-100">
                      {row.label}
                    </th>
                    {schools.map(s => (
                      <td key={s.id} className={cn('align-top px-3 py-3 border-b border-gray-100 text-gray-700', colMin)}>
                        {row.cell(s)}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr>
                  <th scope="row" colSpan={schools.length + 1} className="sticky left-0 text-left bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 px-3 py-2">
                    Courses and programs
                  </th>
                </tr>
                {programRows.common.length === 0 && programRows.others.length === 0 && (
                  <tr>
                    <td colSpan={schools.length + 1} className="px-3 py-4 text-gray-400 text-sm">No programs listed yet for these schools.</td>
                  </tr>
                )}
                {[...programRows.common.map(r => ({ ...r, all: true })), ...programRows.others.map(r => ({ ...r, all: false }))].map(r => (
                  <tr key={r.name}>
                    <th scope="row" className="sticky left-0 z-10 bg-white text-left align-top text-xs font-medium text-gray-700 px-3 py-2.5 border-b border-gray-100">
                      {r.name}
                      {r.all && <span className="block text-[10px] font-semibold text-emerald-600">At all schools</span>}
                    </th>
                    {schools.map(s => (
                      <td key={s.id} className={cn('px-3 py-2.5 border-b border-gray-100', colMin)}>
                        {r.offeredBy.has(s.id)
                          ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> Offered</span>
                          : <span className="inline-flex items-center gap-1 text-gray-300"><Minus size={14} /> Not offered</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {failed && !loading && (
            <p className="px-5 py-3 text-xs text-red-500">Some details could not be loaded, so this comparison may be incomplete.</p>
          )}
        </div>
      </div>
    </div>
  )
}
