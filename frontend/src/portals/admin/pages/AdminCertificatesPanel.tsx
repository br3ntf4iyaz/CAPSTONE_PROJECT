import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrollText, Save, Search, ShieldCheck, ShieldX } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { formatDate } from '@/utils'
import { apiMessage } from '@/portals/youth/lms'

interface IssuedCert {
  id: number
  certificate_number: string
  course_title: string
  holder_name: string
  audience: string
  statement: string
  completed_on: string | null
  issued_at: string
}

interface Settings {
  organization_name: string
  platform_name: string
  signatory_1_name: string
  signatory_1_title: string
  signatory_2_name: string
  signatory_2_title: string
  footer_note: string
}

/** Certificate branding and signatories, the list of issued certificates, and a certificate number check. */
export default function AdminCertificatesPanel() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [number, setNumber] = useState('')
  const [verdict, setVerdict] = useState<null | { valid: boolean; text: string }>(null)

  const settingsQ = useQuery({
    queryKey: ['certificate-settings'],
    queryFn: () => apiClient.get('/courses/admin/certificate-settings/').then(r => r.data as Settings),
  })
  const [draft, setDraft] = useState<Settings | null>(null)
  const form = draft ?? settingsQ.data ?? null

  const save = useMutation({
    mutationFn: () => apiClient.put('/courses/admin/certificate-settings/', form).then(r => r.data as Settings),
    onSuccess: d => {
      toast.success('Certificate settings saved. They apply to certificates issued from now on.')
      setDraft(null)
      qc.setQueryData(['certificate-settings'], d)
    },
    onError: e => toast.error(apiMessage(e)),
  })

  const listQ = useQuery({
    queryKey: ['admin-issued-certificates', q],
    queryFn: () => apiClient.get('/courses/admin/certificates/', { params: { q: q || undefined } }).then(r => r.data as IssuedCert[]),
  })

  const verify = useMutation({
    mutationFn: () => apiClient.get('/courses/admin/certificates/verify/', { params: { number } }).then(r => r.data),
    onSuccess: d => setVerdict(d.valid
      ? { valid: true, text: `Valid. Issued to ${d.certificate.holder_name} for "${d.certificate.course_title}" (${d.account_email}).` }
      : { valid: false, text: d.detail ?? 'No certificate has this number.' }),
    onError: e => toast.error(apiMessage(e)),
  })

  const set = (k: keyof Settings, v: string) => setDraft(d => ({ ...(d ?? settingsQ.data!), [k]: v }))
  const certs = listQ.data ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Certificate branding and signatories</h3>
          <p className="text-xs text-gray-500">These appear on certificates issued from now on. A certificate that was already issued keeps the wording it was issued with.</p>
        </div>
        {form && (
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="label text-xs">Organization name</label><input className="input" value={form.organization_name} onChange={e => set('organization_name', e.target.value)} /></div>
            <div><label className="label text-xs">Platform line</label><input className="input" value={form.platform_name} onChange={e => set('platform_name', e.target.value)} /></div>
            <div><label className="label text-xs">Signatory 1: name</label><input className="input" value={form.signatory_1_name} onChange={e => set('signatory_1_name', e.target.value)} placeholder="Leave empty if there is none" /></div>
            <div><label className="label text-xs">Signatory 1: title</label><input className="input" value={form.signatory_1_title} onChange={e => set('signatory_1_title', e.target.value)} placeholder="e.g. LYDO Head" /></div>
            <div><label className="label text-xs">Signatory 2: name</label><input className="input" value={form.signatory_2_name} onChange={e => set('signatory_2_name', e.target.value)} /></div>
            <div><label className="label text-xs">Signatory 2: title</label><input className="input" value={form.signatory_2_title} onChange={e => set('signatory_2_title', e.target.value)} /></div>
            <div className="md:col-span-2"><label className="label text-xs">Footer note</label><input className="input" value={form.footer_note} onChange={e => set('footer_note', e.target.value)} /></div>
          </div>
        )}
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No signatory is set until you enter one here. Certificates are issued without a signature line until then. Only enter people who agreed to sign.
        </p>
        <button className="btn-primary btn-sm gap-1.5" disabled={!draft || save.isPending} onClick={() => save.mutate()}><Save size={14} /> {save.isPending ? 'Saving...' : 'Save settings'}</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-gray-900">Verify a certificate number</h3>
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (number.trim()) verify.mutate() }}>
          <input className="input flex-1 min-w-[220px] font-mono" placeholder="LYDO-2026-ABCD2345" value={number} onChange={e => { setNumber(e.target.value); setVerdict(null) }} />
          <button className="btn-secondary btn-sm gap-1.5" type="submit" disabled={verify.isPending}><ShieldCheck size={14} /> Verify</button>
        </form>
        {verdict && (
          <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${verdict.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} role="status">
            {verdict.valid ? <ShieldCheck size={16} className="mt-0.5" /> : <ShieldX size={16} className="mt-0.5" />} {verdict.text}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">Every certificate issued to learners. They are created automatically when a course is completed.</p>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-full" placeholder="Search name, course or number" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          {certs.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500"><ScrollText className="mx-auto mb-2 text-gray-300" /> No certificates found.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Recipient</th><th>Course</th><th>Audience</th><th>Completed</th><th>Certificate No.</th></tr>
              </thead>
              <tbody>
                {certs.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium text-sm">{c.holder_name}</td>
                    <td className="text-sm">{c.course_title}</td>
                    <td className="text-xs text-gray-500">{c.audience}</td>
                    <td className="text-xs text-gray-500">{formatDate(c.completed_on || c.issued_at)}</td>
                    <td className="font-mono text-xs text-gray-600">{c.certificate_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
