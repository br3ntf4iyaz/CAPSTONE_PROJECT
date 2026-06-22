import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCog, Download, Filter, X, CheckCircle, XCircle, ShieldCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'
import { useAuthStore } from '@/store/authStore'

interface AdminUser {
  id: number
  email: string
  full_name: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
  is_verified: boolean
  date_joined: string
  profile?: {
    barangay?: string
  }
}

const ROLES = ['youth', 'lgu_admin', 'super_admin']
const ROLE_LABELS: Record<string, string> = {
  youth: 'Youth',
  lgu_admin: 'LGU Admin',
  super_admin: 'Super Admin',
}
const ROLE_BADGE: Record<string, string> = {
  youth: 'badge-blue',
  lgu_admin: 'badge-green',
  super_admin: 'badge-red',
}

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const auth = useAuthStore()
  const isSuperAdmin = auth.user?.role === 'super_admin'

  const [filters, setFilters] = useState({ role: '', barangay: '', is_active: '', is_verified: '' })
  const [search, setSearch] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportColumns, setExportColumns] = useState({
    name: true, email: true, role: true, barangay: true, active: true, date_joined: true,
  })

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users-full'],
    queryFn: () => apiClient.get('/auth/admin/users/').then(r => toArray<AdminUser>(r.data)),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiClient.patch(`/auth/admin/users/${id}/`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-full'] })
      toast.success('User status updated')
    },
    onError: () => toast.error('Failed to update user'),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiClient.patch(`/auth/admin/users/${id}/`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-full'] })
      toast.success('Role updated')
    },
    onError: () => toast.error('Failed to update role'),
  })

  const filtered = users.filter(u => {
    if (filters.role && u.role !== filters.role) return false
    if (filters.barangay && !u.profile?.barangay?.toLowerCase().includes(filters.barangay.toLowerCase())) return false
    if (filters.is_active === 'true' && !u.is_active) return false
    if (filters.is_active === 'false' && u.is_active) return false
    if (filters.is_verified === 'true' && !u.is_verified) return false
    if (filters.is_verified === 'false' && u.is_verified) return false
    if (search && !u.full_name?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const exportCSV = () => {
    const colDefs: { key: keyof typeof exportColumns; header: string; value: (u: AdminUser) => string | number }[] = [
      { key: 'name', header: 'Name', value: u => u.full_name },
      { key: 'email', header: 'Email', value: u => u.email },
      { key: 'role', header: 'Role', value: u => u.role },
      { key: 'barangay', header: 'Barangay', value: u => u.profile?.barangay ?? '' },
      { key: 'active', header: 'Active', value: u => u.is_active ? 'Yes' : 'No' },
      { key: 'date_joined', header: 'Date Joined', value: u => formatDate(u.date_joined) },
    ]
    const activeCols = colDefs.filter(c => exportColumns[c.key])
    const headers = ['ID', ...activeCols.map(c => c.header)]
    const rows = filtered.map(u => [u.id, ...activeCols.map(c => c.value(u))])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click()
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  const clearFilters = () => setFilters({ role: '', barangay: '', is_active: '', is_verified: '' })
  const hasFilters = Object.values(filters).some(Boolean) || !!search

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{filtered.length} of {users.length} users</p>
        </div>
        <button onClick={() => setShowExportModal(true)} className="btn-secondary btn-sm">
          <Download size={14} /> Export Users
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasFilters && (
            <button onClick={() => { clearFilters(); setSearch('') }} className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X size={13} /> Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <input
            className="input"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))} className="input">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <input
            className="input"
            placeholder="Barangay…"
            value={filters.barangay}
            onChange={e => setFilters(f => ({ ...f, barangay: e.target.value }))}
          />
          <select value={filters.is_active} onChange={e => setFilters(f => ({ ...f, is_active: e.target.value }))} className="input">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select value={filters.is_verified} onChange={e => setFilters(f => ({ ...f, is_verified: e.target.value }))} className="input">
            <option value="">All Verification</option>
            <option value="true">Verified</option>
            <option value="false">Not Verified</option>
          </select>
        </div>
      </div>

      {/* Export columns modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Choose Export Columns</h2>
              <button onClick={() => setShowExportModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Exporting <strong>{filtered.length}</strong> user{filtered.length !== 1 ? 's' : ''} matching current filters. ID is always included.
            </p>
            <div className="space-y-2">
              {(
                [
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'role', label: 'Role' },
                  { key: 'barangay', label: 'Barangay' },
                  { key: 'active', label: 'Active Status' },
                  { key: 'date_joined', label: 'Date Joined' },
                ] as { key: keyof typeof exportColumns; label: string }[]
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportColumns[key]}
                    onChange={e => setExportColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={exportCSV} className="btn-primary flex-1 justify-center">
                <Download size={14} /> Download CSV
              </button>
              <button onClick={() => setShowExportModal(false)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon={UserCog} title="No users found" description="Try adjusting your search or filters." className="py-12" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Barangay</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td className="font-medium">{u.full_name}</td>
                  <td className="text-gray-500 text-xs">{u.email}</td>
                  <td>
                    {isSuperAdmin ? (
                      <select
                        value={u.role}
                        onChange={e => changeRole.mutate({ id: u.id, role: e.target.value })}
                        className={cn('text-xs rounded px-1.5 py-0.5 border-0 font-medium cursor-pointer', ROLE_BADGE[u.role] ?? 'badge-gray')}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    ) : (
                      <span className={ROLE_BADGE[u.role] ?? 'badge-gray'}>{ROLE_LABELS[u.role] ?? u.role}</span>
                    )}
                  </td>
                  <td className="text-gray-500 text-xs">{u.profile?.barangay ?? '\u2014'}</td>
                  <td className="text-xs text-gray-500">{formatDate(u.date_joined)}</td>
                  <td>
                    <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {u.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={11} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <ShieldAlert size={11} /> Not Verified
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                      disabled={toggleActive.isPending}
                      className={cn(
                        'btn-sm text-xs flex items-center gap-1',
                        u.is_active ? 'btn-danger' : 'btn-primary'
                      )}
                    >
                      {u.is_active ? <><XCircle size={13} /> Deactivate</> : <><CheckCircle size={13} /> Activate</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
