import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Clock, CheckCircle2, Ban, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { apiErrorMessage } from '../scholarshipApps'
import OfficersEditor, { type OfficerRow } from './OfficersEditor'
import { OrgApplicationsPanel } from './OrgJoin'

interface Owned {
  id: number; name: string; acronym: string; status: 'pending' | 'approved' | 'rejected'; admin_notes: string; is_active: boolean
  registration_category: string; registration_number: string
  description: string; contact_person: string; contact_email: string; contact_phone: string
  mission: string; membership_requirements: string; how_to_join: string; facebook_url: string
  accepting_members: boolean; application_mode: 'in_app' | 'external' | 'contact'; external_apply_url: string
  officers: { id: number; position: string; position_label: string; custom_title: string; name: string; is_me: boolean }[]
  my_position: string
}

const STATUS = {
  pending: { label: 'Pending Verification', cls: 'border-amber-200 bg-amber-50 text-amber-800', Icon: Clock, text: 'LYDO has not verified this organization yet. Only you and LYDO can see it. It appears in the public directory once LYDO approves it.' },
  approved: { label: 'Verified / YORP Registered', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2, text: 'This organization is listed in the public directory.' },
  rejected: { label: 'Not approved', cls: 'border-red-200 bg-red-50 text-red-700', Icon: Ban, text: 'LYDO did not approve this registration. Read the note below.' },
} as const

type Tab = 'details' | 'officers' | 'applications'

/** For the leader who registered an organization: edit its public profile, manage its officers and review who applied. */
export default function ManageOrganization({ orgId, onClose }: { orgId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('details')
  const q = useQuery<Owned>({ queryKey: ['manage-org', orgId], queryFn: () => apiClient.get(`/youth-orgs/${orgId}/manage/`).then(r => r.data) })
  const [f, setF] = useState<Partial<Owned>>({})
  const [officers, setOfficers] = useState<OfficerRow[]>([])
  useEffect(() => {
    if (!q.data) return
    setF(q.data)
    setOfficers(q.data.officers.map(o => ({ position: o.position, custom_title: o.custom_title, name: o.name, is_me: o.is_me })))
  }, [q.data])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['manage-org', orgId] })
    qc.invalidateQueries({ queryKey: ['my-org-submissions'] })
    qc.invalidateQueries({ queryKey: ['youth-orgs-directory'] })
    qc.invalidateQueries({ queryKey: ['org-detail', orgId] })
  }
  const saveDetails = useMutation({
    mutationFn: () => apiClient.patch(`/youth-orgs/${orgId}/manage/`, {
      acronym: f.acronym, description: f.description, contact_person: f.contact_person, contact_email: f.contact_email, contact_phone: f.contact_phone,
      mission: f.mission, membership_requirements: f.membership_requirements, how_to_join: f.how_to_join, facebook_url: f.facebook_url,
      accepting_members: f.accepting_members, application_mode: f.application_mode, external_apply_url: f.external_apply_url,
    }),
    onSuccess: () => { toast.success('Saved'); refresh() },
    onError: (e: any) => toast.error(e?.response?.data?.external_apply_url?.[0] ?? e?.response?.data?.facebook_url?.[0] ?? apiErrorMessage(e, 'Could not save.')),
  })
  const saveOfficers = useMutation({
    mutationFn: () => apiClient.post(`/youth-orgs/${orgId}/set-officers/`, { officers }),
    onSuccess: () => { toast.success('Officers saved'); refresh() },
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Could not save the officers.')),
  })
  const set = <K extends keyof Owned>(k: K, v: Owned[K]) => setF(p => ({ ...p, [k]: v }))
  const org = q.data
  const st = org ? STATUS[org.status] : null
  const mode = f.application_mode ?? 'in_app'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Manage organization" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Manage Organization</p>
            <h2 className="truncate font-display text-lg font-extrabold text-ink-900">{org?.name ?? 'Loading…'}</h2>
            {org?.my_position && <p className="text-xs text-ink-500">Your position: {org.my_position}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100"><X size={16} /></button>
        </div>

        {org && st && (
          <div className="space-y-2 border-b border-ink-100 px-5 py-3">
            <p className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', st.cls)}><st.Icon size={13} /> {st.label}</p>
            <p className="text-xs text-ink-600">{st.text}</p>
            {org.admin_notes && <p className="rounded-lg bg-ink-50 p-2 text-xs text-ink-700"><strong>Note from LYDO:</strong> {org.admin_notes}</p>}
          </div>
        )}

        <div className="flex gap-1 border-b border-ink-100 px-3 pt-2" role="tablist">
          {([['details', 'Details'], ['officers', 'Officers'], ['applications', 'Member applications']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('rounded-t-lg px-3 py-2 text-sm font-semibold', tab === k ? 'bg-primary-50 text-primary-800' : 'text-ink-500 hover:text-ink-800')}>{l}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
          {q.isError && <p className="text-sm text-red-600">Could not open this organization.</p>}

          {org && tab === 'details' && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="text-xs font-medium text-ink-600">Acronym</span>
                  <input className="input mt-0.5 w-full" maxLength={30} value={f.acronym ?? ''} onChange={e => set('acronym', e.target.value)} /></label>
                <label className="block sm:col-span-2"><span className="text-xs font-medium text-ink-600">Key officer / contact person</span>
                  <input className="input mt-0.5 w-full" value={f.contact_person ?? ''} onChange={e => set('contact_person', e.target.value)} /></label>
              </div>
              <label className="block"><span className="text-xs font-medium text-ink-600">About</span>
                <textarea className="input mt-0.5 w-full resize-none" rows={2} value={f.description ?? ''} onChange={e => set('description', e.target.value)} /></label>
              <label className="block"><span className="text-xs font-medium text-ink-600">Mission and objectives</span>
                <textarea className="input mt-0.5 w-full resize-none" rows={2} maxLength={1500} value={f.mission ?? ''} onChange={e => set('mission', e.target.value)} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-xs font-medium text-ink-600">Official email</span>
                  <input className="input mt-0.5 w-full" type="email" value={f.contact_email ?? ''} onChange={e => set('contact_email', e.target.value)} /></label>
                <label className="block"><span className="text-xs font-medium text-ink-600">Contact number</span>
                  <input className="input mt-0.5 w-full" type="tel" value={f.contact_phone ?? ''} onChange={e => set('contact_phone', e.target.value)} /></label>
              </div>
              <label className="block"><span className="text-xs font-medium text-ink-600">Facebook page</span>
                <input className="input mt-0.5 w-full" value={f.facebook_url ?? ''} onChange={e => set('facebook_url', e.target.value)} placeholder="https://www.facebook.com/..." /></label>
              <div className="space-y-2 rounded-xl border border-primary-100 bg-primary-50/40 p-3">
                <p className="text-sm font-semibold text-ink-800">Membership</p>
                <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={!!f.accepting_members} onChange={e => set('accepting_members', e.target.checked)} /> Open for new members</label>
                <label className="block"><span className="text-xs font-medium text-ink-600">How people apply</span>
                  <select className="input mt-0.5 w-full" value={mode} onChange={e => set('application_mode', e.target.value as Owned['application_mode'])}>
                    <option value="in_app">In-App Application (reviewed by your officers in LYDOP)</option>
                    <option value="external">External link (Google Form, Facebook)</option>
                    <option value="contact">Contact only</option>
                  </select></label>
                {mode === 'external' && (
                  <label className="block"><span className="text-xs font-medium text-ink-600">Link where people apply</span>
                    <input className="input mt-0.5 w-full" value={f.external_apply_url ?? ''} onChange={e => set('external_apply_url', e.target.value)} placeholder="https://forms.gle/..." /></label>
                )}
                {mode === 'in_app' && (
                  <p className="flex gap-1.5 text-xs text-primary-900"><Info size={13} className="mt-0.5 shrink-0" /> Applicants are told clearly that <strong>your officers, not LYDO</strong>, review and approve their application. You approve or ask for a fix in the Member applications tab.</p>
                )}
                <label className="block"><span className="text-xs font-medium text-ink-600">Requirements to join</span>
                  <textarea className="input mt-0.5 w-full resize-none" rows={2} maxLength={1000} value={f.membership_requirements ?? ''} onChange={e => set('membership_requirements', e.target.value)} /></label>
                <label className="block"><span className="text-xs font-medium text-ink-600">How to join (steps)</span>
                  <textarea className="input mt-0.5 w-full resize-none" rows={2} maxLength={1000} value={f.how_to_join ?? ''} onChange={e => set('how_to_join', e.target.value)} /></label>
              </div>
              <p className="text-xs text-ink-500">The name, classification, barangay and YORP registration are set with LYDO and cannot be changed here.</p>
              <button type="button" onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending} className="btn-primary gap-1.5"><Save size={14} /> {saveDetails.isPending ? 'Saving…' : 'Save details'}</button>
            </div>
          )}

          {org && tab === 'officers' && (
            <div className="space-y-3">
              <OfficersEditor value={officers} onChange={setOfficers} />
              <button type="button" onClick={() => saveOfficers.mutate()} disabled={saveOfficers.isPending} className="btn-primary gap-1.5"><Save size={14} /> {saveOfficers.isPending ? 'Saving…' : 'Save officers'}</button>
            </div>
          )}

          {org && tab === 'applications' && (
            org.status === 'approved'
              ? <div className="-mx-4"><OrgApplicationsPanel orgId={org.id} /></div>
              : <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">Member applications start once LYDO verifies your organization and it appears in the directory.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
