import { useState } from 'react'
import { Facebook, ExternalLink, Trash2, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'

export interface SKActivity { id: number; title: string; description: string; facebook_post_url: string; activity_date: string | null }
export interface SKSocial {
  visible: boolean
  facebook_profile_url?: string
  facebook_page_url?: string
  messenger_url?: string
  public_email?: string
  public_contact_number?: string
  public_bio?: string
  activities: SKActivity[]
}

export interface SocialOfficial { key: string; id: number | null; name: string; position_display: string; social?: SKSocial }

const looksFacebook = (v: string) => /^(https?:\/\/)?((www|m|web|mbasic)\.)?facebook\.com\//i.test(v.trim()) || /^(https?:\/\/)?(m\.me|(www\.)?messenger\.com)\//i.test(v.trim()) || /^(https?:\/\/)?fb\.watch\//i.test(v.trim())
const asUrl = (v: string) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`)

function errText(e: any, fallback: string) {
  return String(e?.response?.data?.detail ?? fallback)
}

function LinkField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const ok = looksFacebook(value)
  return (
    <label className="block text-sm">
      <span className="font-semibold text-ink-800">{label}</span>
      <div className="mt-1 flex gap-2">
        <input className="input flex-1 min-w-0 text-sm" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={300} inputMode="url" />
        {value.trim() && (
          <a
            href={ok ? asUrl(value) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!ok}
            onClick={e => { if (!ok) e.preventDefault() }}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${ok ? 'border-primary-200 text-primary-700 hover:bg-primary-50' : 'border-red-200 text-red-600'}`}
            title={ok ? 'Open the link in a new tab to check it is the right person before saving' : 'This does not look like a Facebook link'}
          >
            <ExternalLink size={13} /> {ok ? 'Preview' : 'Not Facebook'}
          </a>
        )}
      </div>
    </label>
  )
}

/** Lets LYDO staff, or the verified SK of the barangay, manage ONE official's Facebook links, public contact and activities. */
export default function SKSocialEditor({
  barangayId, official, onClose, onSaved,
}: { barangayId: number; official: SocialOfficial; onClose: () => void; onSaved: (social: SKSocial) => void }) {
  const s = official.social
  const [profile, setProfile] = useState(s?.facebook_profile_url ?? '')
  const [page, setPage] = useState(s?.facebook_page_url ?? '')
  const [messenger, setMessenger] = useState(s?.messenger_url ?? '')
  const [email, setEmail] = useState(s?.public_email ?? '')
  const [phone, setPhone] = useState(s?.public_contact_number ?? '')
  const [bio, setBio] = useState(s?.public_bio ?? '')
  const [visible, setVisible] = useState(s?.visible ?? false)
  const [acts, setActs] = useState<SKActivity[]>(s?.activities ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!s && (s.facebook_profile_url !== undefined))
  const [title, setTitle] = useState('')
  const [post, setPost] = useState('')
  const [date, setDate] = useState('')
  const [desc, setDesc] = useState('')
  const base = `/sk-requirements/barangays/${barangayId}`
  const seat = official.id !== null ? { member: official.id } : {}

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiClient.post(`${base}/official-social/`, {
        ...seat, facebook_profile_url: profile, facebook_page_url: page, messenger_url: messenger,
        public_email: email, public_contact_number: phone, public_bio: bio, social_links_visibility: visible,
      })
      toast.success(visible ? 'Saved. The links are now public.' : 'Saved. The links are hidden from the public.')
      setSaved(true)
      onSaved(res.data.social)
    } catch (e) {
      toast.error(errText(e, 'Could not save the links.'))
    } finally {
      setSaving(false)
    }
  }

  const addActivity = async () => {
    try {
      const res = await apiClient.post(`${base}/official-activities/`, { ...seat, title, facebook_post_url: post, activity_date: date || null, description: desc })
      setActs(res.data.social.activities)
      onSaved(res.data.social)
      setTitle(''); setPost(''); setDate(''); setDesc('')
      toast.success('Activity added')
    } catch (e) {
      toast.error(errText(e, 'Could not add the activity.'))
    }
  }

  const removeActivity = async (id: number) => {
    try {
      const res = await apiClient.delete(`${base}/official-activities/`, { data: { ...seat, id } })
      setActs(res.data.social.activities)
      onSaved(res.data.social)
    } catch (e) {
      toast.error(errText(e, 'Could not remove the activity.'))
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Social links of ${official.name}`}>
      <div className="h-full sm:h-auto max-h-screen sm:max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white sm:rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900"><Facebook size={16} className="text-primary-600" /> Social links</p>
            <p className="truncate text-xs text-ink-500">{official.name} · {official.position_display}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink-100"><X size={16} /></button>
        </div>

        <div className="space-y-3 p-4">
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-900">
            Add only links the official gave or approved. LYDOP does not read Facebook and does not fabricate links. If the official changes, these links are cleared.
          </p>
          <LinkField label="Facebook profile" value={profile} onChange={setProfile} placeholder="https://www.facebook.com/username" />
          <LinkField label="Official Facebook page" value={page} onChange={setPage} placeholder="https://www.facebook.com/pages/..." />
          <LinkField label="Messenger link (optional)" value={messenger} onChange={setMessenger} placeholder="https://m.me/username" />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm"><span className="font-semibold text-ink-800">Public email (optional)</span>
              <input className="input mt-1 text-sm" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} /></label>
            <label className="block text-sm"><span className="font-semibold text-ink-800">Public contact number (optional)</span>
              <input className="input mt-1 text-sm" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} inputMode="tel" /></label>
          </div>
          <label className="block text-sm"><span className="font-semibold text-ink-800">Short introduction (optional)</span>
            <textarea className="input mt-1 resize-none text-sm" rows={3} maxLength={500} value={bio} onChange={e => setBio(e.target.value)} placeholder="A short public introduction written by the official." /></label>
          <p className="text-[11px] text-ink-500">Do not put private phone numbers or home addresses here. Everything above is shown to the public when visible.</p>

          <label className="flex items-start gap-2 rounded-lg border border-ink-100 p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={visible} onChange={e => setVisible(e.target.checked)} />
            <span><strong>Show these links to the public.</strong> The official agreed to publish them. When unticked, nothing here is shown.</span>
          </label>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>

          <div className="border-t border-ink-100 pt-3">
            <h4 className="text-sm font-bold text-ink-900">Public Activities and Announcements</h4>
            <p className="text-xs text-ink-500">Paste links to PUBLIC Facebook posts. They are added by hand: the system does not read Facebook.</p>
            {!saved && <p className="mt-2 text-xs text-amber-700">Save the links above first, then add activities.</p>}
            <ul className="mt-2 space-y-2">
              {acts.map(a => (
                <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-ink-100 p-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{a.title}</p>
                    <p className="text-xs text-ink-500 break-all">{a.activity_date ?? 'No date'} · {a.facebook_post_url}</p>
                  </div>
                  <button type="button" onClick={() => removeActivity(a.id)} aria-label={`Remove ${a.title}`} className="rounded-full p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {saved && (
              <div className="mt-2 space-y-2 rounded-lg bg-ink-50 p-3">
                <input className="input text-sm" placeholder="Title (for example: Basketball League)" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} />
                <LinkField label="Link of the public Facebook post" value={post} onChange={setPost} placeholder="https://www.facebook.com/page/posts/..." />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="input text-sm" type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date of the activity" />
                  <input className="input text-sm" placeholder="Short description (optional)" value={desc} onChange={e => setDesc(e.target.value)} maxLength={500} />
                </div>
                <button type="button" onClick={addActivity} disabled={title.trim().length < 3 || !post.trim()} className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50"><Plus size={14} /> Add activity</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
