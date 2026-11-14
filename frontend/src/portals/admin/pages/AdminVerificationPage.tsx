import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Eye, X, CheckCircle2, XCircle,
  Brain, AlertCircle, Download, CheckSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatDateTime, cn } from '@/utils'
import { IntegrityBadge } from '@/components/ui/IntegrityBadge'
import { useIDDecisionIntegrity } from '@/api/ledger'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VerificationRecord {
  id: number
  id_type: string
  id_type_display: string
  status: 'pending' | 'reviewing' | 'approved' | 'rejected'
  status_display: string
  is_verified: boolean
  ai_verdict: string
  ai_confidence: number | null
  ai_notes: string
  admin_notes: string
  submitted_at: string
  updated_at: string
  user_name: string
  user_email: string
  id_image_url: string | null
  id_back_image_url?: string | null
  selfie_image_url?: string | null
  ai_face_match?: boolean | null
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   'badge-yellow',
  reviewing: 'bg-blue-100 text-blue-700',
  approved:  'badge-green',
  rejected:  'badge-red',
}

const VERDICT_COLORS: Record<string, string> = {
  approved: 'text-emerald-600',
  rejected: 'text-red-600',
}

// ── Review Modal ───────────────────────────────────────────────────────────────

function ReviewModal({ record, onClose, onAction }: {
  record: VerificationRecord
  onClose: () => void
  onAction: () => void
}) {
  const [notes, setNotes] = useState(record.admin_notes ?? '')
  const [pendingAction, setPendingAction] = useState<'approved' | 'rejected' | null>(null)

  const mutation = useMutation({
    mutationFn: (newStatus: 'approved' | 'rejected') =>
      apiClient.patch(`/verification/admin/${record.id}/`, {
        status: newStatus,
        admin_notes: notes,
      }).then(r => r.data),
    onSuccess: (_, newStatus) => {
      toast.success(newStatus === 'approved' ? 'Verification approved.' : 'Verification rejected.')
      onAction()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Action failed')
    },
  })

  const canAct = record.status === 'pending' || record.status === 'reviewing' || record.status === 'rejected'
  const confidencePct = record.ai_confidence != null ? Math.round(record.ai_confidence * 100) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-5 my-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-800">ID Verification Review</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              {record.user_name} · {record.user_email}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Status + ID type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('badge text-xs', STATUS_COLORS[record.status] ?? 'badge-gray')}>
            {record.status_display}
          </span>
          <span className="badge badge-gray text-xs">{record.id_type_display}</span>
          <span className="text-xs text-ink-400">Submitted {formatDateTime(record.submitted_at)}</span>
        </div>

        {/* ID image */}
        {record.id_image_url ? (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase mb-2">Uploaded ID</p>
            <a href={record.id_image_url} target="_blank" rel="noopener noreferrer">
              <img
                src={record.id_image_url}
                alt="Uploaded ID"
                className="w-full max-h-64 object-contain rounded-xl border border-ink-100 bg-ink-50 hover:opacity-90 transition-opacity cursor-zoom-in"
              />
            </a>
            <p className="text-xs text-ink-400 mt-1">Click image to open full size in new tab</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertCircle size={15} className="flex-shrink-0" />
            No ID image uploaded.
          </div>
        )}

        {(record.id_back_image_url || record.selfie_image_url) && (
          <div className="grid grid-cols-2 gap-3">
            {record.id_back_image_url && (
              <a href={record.id_back_image_url} target="_blank" rel="noopener noreferrer">
                <p className="text-xs font-semibold text-ink-500 uppercase mb-1">ID back</p>
                <img src={record.id_back_image_url} alt="ID back" className="w-full max-h-40 object-contain rounded-xl border border-ink-100 bg-ink-50" />
              </a>
            )}
            {record.selfie_image_url && (
              <a href={record.selfie_image_url} target="_blank" rel="noopener noreferrer">
                <p className="text-xs font-semibold text-ink-500 uppercase mb-1">
                  Selfie{record.ai_face_match === true ? ' · face matches' : record.ai_face_match === false ? ' · NO match' : ''}
                </p>
                <img src={record.selfie_image_url} alt="Selfie" className="w-full max-h-40 object-contain rounded-xl border border-ink-100 bg-ink-50" />
              </a>
            )}
          </div>
        )}

        {/* AI analysis */}
        {(record.ai_verdict || record.ai_notes) && (
          <div className="rounded-xl border border-ink-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-ink-500 uppercase flex items-center gap-1.5">
              <Brain size={12} /> Face check (on device)
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {record.ai_verdict && (
                <span className={cn('text-sm font-semibold capitalize', VERDICT_COLORS[record.ai_verdict] ?? 'text-ink-600')}>
                  Verdict: {record.ai_verdict}
                </span>
              )}
              {confidencePct != null && (
                <span className="text-xs text-ink-500">
                  Confidence: <span className={cn('font-semibold', confidencePct >= 75 ? 'text-emerald-600' : confidencePct >= 50 ? 'text-amber-600' : 'text-red-600')}>{confidencePct}%</span>
                </span>
              )}
            </div>
            {record.ai_notes && (
              <p className="text-sm text-ink-700 leading-relaxed">{record.ai_notes}</p>
            )}
          </div>
        )}

        {/* Previous admin notes */}
        {record.admin_notes && record.status === 'approved' && (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm text-emerald-700">
            <span className="font-semibold">Admin notes:</span> {record.admin_notes}
          </div>
        )}
        {record.admin_notes && record.status === 'rejected' && (
          <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
            <span className="font-semibold">Rejection reason:</span> {record.admin_notes}
          </div>
        )}

        {/* Action area */}
        {canAct && (
          <div>
            <label className="label">
              {pendingAction === 'rejected' ? 'Reason for rejection *' : 'Admin notes (optional)'}
            </label>
            <textarea
              className="input min-h-[80px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                pendingAction === 'rejected'
                  ? 'Explain why this ID was rejected so the user can re-submit correctly…'
                  : 'Any notes about this verification…'
              }
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary btn-sm">Close</button>
          {canAct && (
            <>
              <button
                onClick={() => { setPendingAction('rejected'); mutation.mutate('rejected') }}
                disabled={mutation.isPending}
                className="btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1"
              >
                <XCircle size={13} />
                {mutation.isPending && pendingAction === 'rejected' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                onClick={() => { setPendingAction('approved'); mutation.mutate('approved') }}
                disabled={mutation.isPending}
                className="btn-primary btn-sm flex items-center gap-1"
              >
                <CheckCircle2 size={13} />
                {mutation.isPending && pendingAction === 'approved' ? 'Approving…' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'pending' | 'reviewing' | 'approved' | 'rejected'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'reviewing', label: 'Under review' },
  { key: 'approved',  label: 'Approved' },
  { key: 'rejected',  label: 'Rejected' },
]

export default function AdminVerificationPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('all')
  const [selected, setSelected] = useState<VerificationRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkPendingAction, setBulkPendingAction] = useState<'approved' | 'rejected' | null>(null)

  const params = tab !== 'all' ? { status: tab } : undefined
  const { data: integrity } = useIDDecisionIntegrity()

  const { data: records = [], isLoading } = useQuery<VerificationRecord[]>({
    queryKey: ['admin-verifications', tab],
    queryFn: () =>
      apiClient.get('/verification/admin/', { params }).then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? [])
      }),
  })

  const { data: allRecords = [] } = useQuery<VerificationRecord[]>({
    queryKey: ['admin-verifications', 'all'],
    queryFn: () =>
      apiClient.get('/verification/admin/').then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? [])
      }),
  })

  const pendingCount   = allRecords.filter(r => r.status === 'pending').length
  const reviewingCount = allRecords.filter(r => r.status === 'reviewing').length

  const tabBadge: Partial<Record<TabKey, number>> = {
    pending:   pendingCount,
    reviewing: reviewingCount,
  }

  // ── Bulk action ────────────────────────────────────────────────────────────

  const bulkMutation = useMutation({
    mutationFn: ({ newStatus, notes }: { newStatus: 'approved' | 'rejected'; notes: string }) =>
      apiClient.post('/verification/admin/bulk/', {
        ids: Array.from(selectedIds),
        status: newStatus,
        admin_notes: notes,
      }).then(r => r.data),
    onSuccess: (data: any, { newStatus }) => {
      toast.success(`${data.updated} verification(s) ${newStatus}.`)
      setSelectedIds(new Set())
      setBulkNotes('')
      setBulkPendingAction(null)
      qc.invalidateQueries({ queryKey: ['admin-verifications'] })
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Bulk action failed')
    },
  })

  // ── Select helpers ─────────────────────────────────────────────────────────

  const actionableRecords = records.filter(r =>
    r.status === 'pending' || r.status === 'reviewing' || r.status === 'rejected'
  )
  const allActionableSelected =
    actionableRecords.length > 0 && actionableRecords.every(r => selectedIds.has(r.id))

  const toggleAll = () => {
    if (allActionableSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        actionableRecords.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        actionableRecords.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── CSV export ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const headers = ['ID', 'User', 'Email', 'ID Type', 'Status', 'Face check', 'Confidence', 'Submitted']
    const rows = records.map(r => [
      r.id, r.user_name, r.user_email, r.id_type_display, r.status_display,
      r.ai_verdict || '—',
      r.ai_confidence != null ? `${Math.round(r.ai_confidence * 100)}%` : '—',
      formatDate(r.submitted_at),
    ])
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `verifications-${tab}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <PageSpinner />

  const selCount = selectedIds.size

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">ID Verification</h1>
          <p className="page-subtitle">Review identity documents submitted by youth users</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary btn-sm flex items-center gap-1.5">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => {
          const badge = tabBadge[t.key]
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedIds(new Set()) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                tab === t.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-paper-100 text-ink-600 hover:bg-paper-200',
              )}
            >
              {t.label}
              {badge != null && badge > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                  tab === t.key ? 'bg-white/30 text-white' : 'bg-red-500 text-white',
                )}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <CheckSquare size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-primary-800">{selCount} selected</span>
          </div>
          <input
            className="input text-sm flex-1 min-w-0"
            placeholder="Admin notes for bulk action (optional)…"
            value={bulkNotes}
            onChange={e => setBulkNotes(e.target.value)}
          />
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { setBulkPendingAction('rejected'); bulkMutation.mutate({ newStatus: 'rejected', notes: bulkNotes }) }}
              disabled={bulkMutation.isPending}
              className="btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1"
            >
              <XCircle size={13} />
              {bulkMutation.isPending && bulkPendingAction === 'rejected' ? 'Rejecting…' : 'Reject All'}
            </button>
            <button
              onClick={() => { setBulkPendingAction('approved'); bulkMutation.mutate({ newStatus: 'approved', notes: bulkNotes }) }}
              disabled={bulkMutation.isPending}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              {bulkMutation.isPending && bulkPendingAction === 'approved' ? 'Approving…' : 'Approve All'}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-secondary btn-sm">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        {records.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No verifications found"
            description={tab === 'all' ? 'No ID verification submissions yet.' : `No ${tab} verifications.`}
            className="py-12"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allActionableSelected}
                    onChange={toggleAll}
                    className="cursor-pointer"
                    title="Select all actionable"
                    disabled={actionableRecords.length === 0}
                  />
                </th>
                <th>User</th>
                <th>Email</th>
                <th>ID Type</th>
                <th>Status</th>
                <th>Face check</th>
                <th>Confidence</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const isActionable = rec.status === 'pending' || rec.status === 'reviewing' || rec.status === 'rejected'
                return (
                  <tr key={rec.id} className={selectedIds.has(rec.id) ? 'bg-primary-50/50' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rec.id)}
                        onChange={() => toggleOne(rec.id)}
                        disabled={!isActionable}
                        className="cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="font-medium">{rec.user_name}</td>
                    <td className="text-sm text-ink-500">{rec.user_email}</td>
                    <td className="text-sm">{rec.id_type_display}</td>
                    <td>
                      <span className={cn('badge text-xs', STATUS_COLORS[rec.status] ?? 'badge-gray')}>
                        {rec.status_display}
                      </span>
                      <IntegrityBadge result={integrity?.results[String(rec.id)]} className="ml-1.5" intactLabel={rec.status === 'rejected' ? 'Record intact' : undefined} />
                    </td>
                    <td>
                      {rec.ai_verdict ? (
                        <span className={cn('text-xs font-semibold capitalize', VERDICT_COLORS[rec.ai_verdict] ?? 'text-ink-500')}>
                          {rec.ai_verdict}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="text-sm text-ink-500">
                      {rec.ai_confidence != null
                        ? `${Math.round(rec.ai_confidence * 100)}%`
                        : '—'}
                    </td>
                    <td className="text-sm text-ink-500">{formatDate(rec.submitted_at)}</td>
                    <td>
                      <button
                        onClick={() => setSelected(rec)}
                        className="btn-secondary btn-sm text-xs flex items-center gap-1"
                      >
                        <Eye size={12} /> Review
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ReviewModal
          record={selected}
          onClose={() => setSelected(null)}
          onAction={() => {
            qc.invalidateQueries({ queryKey: ['admin-verifications'] })
            qc.invalidateQueries({ queryKey: ['ledger'] })
          }}
        />
      )}
    </div>
  )
}
