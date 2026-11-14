import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, CheckCircle2, Paperclip, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'

interface Props {
  kind: 'scholarship' | 'job'
  objectId: number
  title: string
  provider?: string
  requirements: string[]
  onClose: () => void
}

const ID_TYPES = [
  'National ID (PhilSys)', "Driver's License", 'Passport', 'UMID', "Voter's ID",
  'School ID', 'Postal ID', 'Barangay ID', 'Other government ID',
]

export function splitRequirements(raw?: string | string[] | null): string[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : raw.split(/\r?\n|;/)
  return list.map(r => r.replace(/^[\s\-*\d.)]+/, '').trim()).filter(Boolean)
}

export default function ApplyModal({ kind, objectId, title, provider, requirements, onClose }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const p = user?.profile
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    birthdate: p?.birthdate ?? '',
    contact_number: p?.phone ?? '',
    email: user?.email ?? '',
    address: [p?.barangay, p?.municipality, p?.province].filter(Boolean).join(', '),
    id_type: ID_TYPES[0],
    id_number: '',
    message: '',
  })
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)
  const [done, setDone] = useState(false)

  const { data: mine = [] } = useQuery<{ kind: string; object_id: number }[]>({
    queryKey: ['my-applications'],
    queryFn: () => apiClient.get('/applications/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })
  const already = mine.some(a => a.kind === kind && a.object_id === objectId)

  const allChecked = requirements.every(r => checked.has(r))
  const valid = useMemo(
    () =>
      !!(form.full_name.trim() && form.contact_number.trim() && form.email.trim() &&
        form.address.trim() && form.id_number.trim() && allChecked),
    [form, allChecked],
  )

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('object_id', String(objectId))
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      Array.from(checked).forEach(r => fd.append('confirmed_requirements', r))
      if (file) fd.append('document', file)
      return apiClient.post('/applications/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      setDone(true)
    },
    onError: (err: any) => {
      const d = err?.response?.data
      const msg = d?.non_field_errors?.[0] ?? d?.detail ?? (d && Object.values(d).flat()[0]) ?? 'Could not submit your application.'
      toast.error(String(msg))
    },
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggle = (r: string) =>
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(r)) n.delete(r)
      else n.add(r)
      return n
    })

  const n1 = requirements.length ? 1 : 0

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={e => { e.stopPropagation(); onClose() }}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
              Apply · {kind === 'job' ? 'Job' : 'Scholarship'}
            </p>
            <h2 className="font-bold text-gray-900 leading-tight break-words">{title}</h2>
            {provider && <p className="text-xs text-gray-500 mt-0.5">{provider}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 size={48} className="text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Application submitted</h3>
            <p className="text-sm text-gray-600">
              Your application for <b>{title}</b> was received. LYDO will review it and contact you.
            </p>
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        ) : already ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 size={40} className="text-primary-600 mx-auto" />
            <p className="text-sm text-gray-700">You already applied to this {kind === 'job' ? 'job' : 'scholarship'}.</p>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        ) : (
          <form className="p-5 space-y-5" onSubmit={e => { e.preventDefault(); if (valid) submit.mutate() }}>
            {requirements.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">1. Requirements: confirm you have each one</h3>
                <ul className="space-y-1.5">
                  {requirements.map(r => (
                    <li key={r}>
                      <label
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm cursor-pointer',
                          checked.has(r) ? 'border-primary-300 bg-primary-50' : 'border-gray-200',
                        )}
                      >
                        <input type="checkbox" className="mt-0.5" checked={checked.has(r)} onChange={() => toggle(r)} />
                        <span className="text-gray-700">{r}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">{n1 + 1}. Personal identity</h3>
              <input className="input" placeholder="Full name" value={form.full_name} onChange={set('full_name')} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="input" type="date" value={form.birthdate} onChange={set('birthdate')} aria-label="Birthdate" />
                <input className="input" placeholder="Contact number" inputMode="tel" value={form.contact_number} onChange={set('contact_number')} required />
              </div>
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
              <input className="input" placeholder="Complete address (barangay, city, province)" value={form.address} onChange={set('address')} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="input" value={form.id_type} onChange={set('id_type')}>
                  {ID_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input className="input" placeholder="ID number" value={form.id_number} onChange={set('id_number')} required />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {n1 + 2}. Supporting document <span className="font-normal text-gray-400">(optional, max 5 MB)</span>
              </h3>
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 cursor-pointer hover:border-primary-400">
                <Paperclip size={15} /> <span className="truncate">{file ? file.name : 'Attach PDF or image'}</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <textarea className="input resize-none" rows={3} placeholder="Message to the reviewer (optional)" value={form.message} onChange={set('message')} />
            </section>

            {!allChecked && <p className="text-xs text-amber-600">Confirm all requirements to enable Submit.</p>}
            <button
              type="submit"
              disabled={!valid || submit.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={15} /> {submit.isPending ? 'Submitting...' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
