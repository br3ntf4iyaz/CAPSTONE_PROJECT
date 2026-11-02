import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Search, Filter, User, Globe, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import apiClient from '@/api/client'
import { formatDateTime } from '@/utils'
import { cn } from '@/utils'
import { useAuditDays, useLedgerStatus } from '@/api/ledger'
import { IntegrityBadge } from '@/components/ui/IntegrityBadge'

interface AuditEntry {
  id: number
  user_email: string | null
  user_name: string | null
  action: string
  model_name: string
  object_id: number | null
  details: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

interface Paginated {
  count: number
  next: string | null
  previous: string | null
  results: AuditEntry[]
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_login:        { label: 'Login',           color: 'bg-blue-100 text-blue-700' },
  google_login:      { label: 'Google Login',    color: 'bg-indigo-100 text-indigo-700' },
  google_register:   { label: 'Google Register', color: 'bg-purple-100 text-purple-700' },
  password_reset:    { label: 'Password Reset',  color: 'bg-amber-100 text-amber-700' },
  user_deactivated:  { label: 'Deactivated',     color: 'bg-red-100 text-red-700' },
  user_activated:    { label: 'Activated',       color: 'bg-green-100 text-green-700' },
  role_changed:      { label: 'Role Changed',    color: 'bg-orange-100 text-orange-700' },
  verification_approved: { label: 'ID Approved', color: 'bg-emerald-100 text-emerald-700' },
  verification_rejected: { label: 'ID Rejected', color: 'bg-red-100 text-red-700' },
}

function actionMeta(action: string) {
  return ACTION_LABELS[action] ?? { label: action.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-600' }
}

const PAGE_SIZE = 50

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'user_login', label: 'Logins' },
  { value: 'google', label: 'Google auth' },
  { value: 'password_reset', label: 'Password resets' },
  { value: 'verification', label: 'Verifications' },
  { value: 'user_deactivated', label: 'Deactivations' },
  { value: 'role_changed', label: 'Role changes' },
]

const KIND_LABELS: Record<string, string> = {
  review_log: 'PPA review history',
  sk_requirement: 'SK compliance documents',
  id_decision: 'ID verification decisions',
  course_cert: 'Course certificates',
  recognition_cert: 'Recognition certificates',
  audit_day: 'Audit log days',
}

/** Shows whether past audit-log days still match what was recorded on the ledger. */
function LedgerIntegrityPanel() {
  const { data: days, isLoading } = useAuditDays()
  const { data: status } = useLedgerStatus()
  const [open, setOpen] = useState(false)

  const list = days?.days ?? []
  const bad = list.filter(d => d.status === 'changed' || d.status === 'tampered')
  const verified = list.filter(d => d.status === 'verified').length

  if (isLoading || !days) return null

  return (
    <div className={cn('rounded-xl border p-4 bg-white', bad.length ? 'border-red-300' : 'border-gray-200')}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} className={bad.length ? 'text-red-600' : 'text-emerald-600'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-900">
            {bad.length
              ? bad.length === 1
                ? '1 past day of the audit log no longer matches the ledger'
                : `${bad.length} past days of the audit log no longer match the ledger`
              : `Audit log integrity: ${verified} of the last ${list.length} days verified`}
          </p>
          <p className="text-xs text-ink-500 mt-0.5">
            Each finished day is fingerprinted and recorded on <strong>{days.network}</strong>. Editing, deleting,
            or back-dating an entry changes that day's fingerprint.
            {status && !status.local_chain_intact && ' The local ledger itself has been altered.'}
          </p>
          {status && (
            <p className="text-xs text-ink-400 mt-1">
              {Object.entries(status.by_kind).map(([k, v]) =>
                `${KIND_LABELS[k] ?? k}: ${v.anchored}`).join('  ·  ')}
            </p>
          )}
        </div>
        {list.length > 0 && (
          <button onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
            {open ? 'Hide days' : 'Show days'}
          </button>
        )}
      </div>

      {open && (
        <ul className="mt-3 divide-y divide-gray-100 text-sm max-h-64 overflow-y-auto">
          {list.map(d => (
            <li key={d.day} className="flex items-center gap-3 py-1.5">
              <span className="font-mono text-xs text-ink-700 w-24">{d.day}</span>
              <span className="text-xs text-ink-500 flex-1">{d.count} entr{d.count === 1 ? 'y' : 'ies'}</span>
              <IntegrityBadge result={d} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AdminAuditLogPage() {
  const [email, setEmail]   = useState('')
  const [action, setAction] = useState('')
  const [date, setDate]     = useState('')
  const [page, setPage]     = useState(1)

  // Apply filters with debounce via react-query key
  const params = new URLSearchParams()
  if (email)  params.set('email', email)
  if (action) params.set('action', action)
  if (date)   params.set('date', date)
  params.set('page', String(page))
  params.set('page_size', String(PAGE_SIZE))

  const { data, isLoading, isFetching } = useQuery<Paginated>({
    queryKey: ['audit-logs', email, action, date, page],
    queryFn: () =>
      apiClient.get(`/auth/admin/audit-logs/?${params.toString()}`).then(r => {
        const d = r.data
        if (Array.isArray(d)) return { count: d.length, next: null, previous: null, results: d }
        return d as Paginated
      }),
    placeholderData: prev => prev,
  })

  const entries   = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <History size={22} className="text-gray-500" />
            Audit Log
          </h1>
          <p className="page-subtitle">All admin-relevant actions recorded by the system</p>
        </div>
        {totalCount > 0 && (
          <span className="text-sm text-gray-500 font-medium">{totalCount.toLocaleString()} total entries</span>
        )}
      </div>

      <LedgerIntegrityPanel />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="email"
            placeholder="Filter by email..."
            value={email}
            onChange={e => { setEmail(e.target.value); resetPage() }}
            className="input pl-9 text-sm"
          />
        </div>

        <div className="relative sm:w-48">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={action}
            onChange={e => { setAction(e.target.value); resetPage() }}
            className="input pl-8 text-sm"
          >
            {ACTION_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); resetPage() }}
          className="input text-sm sm:w-44"
        />

        {(email || action || date) && (
          <button
            onClick={() => { setEmail(''); setAction(''); setDate(''); resetPage() }}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-2 flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">
            <History size={32} className="mx-auto mb-3 opacity-30 animate-pulse" />
            <p className="text-sm">Loading audit log…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <History size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600">No audit entries found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className={cn(isFetching && 'opacity-70 pointer-events-none transition-opacity')}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const meta = actionMeta(entry.action)
                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap text-xs text-gray-500 font-mono">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td>
                      {entry.user_email ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{entry.user_name ?? '—'}</p>
                            <p className="text-[11px] text-gray-500 truncate">{entry.user_email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">System / deleted user</span>
                      )}
                    </td>
                    <td>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold capitalize', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="max-w-xs">
                      {Object.keys(entry.details).length > 0 ? (
                        <div className="text-[11px] text-gray-500 font-mono truncate" title={JSON.stringify(entry.details)}>
                          {Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {entry.ip_address ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Globe size={12} />
                          <span className="font-mono">{entry.ip_address}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} ({totalCount.toLocaleString()} entries)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary btn-sm text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
