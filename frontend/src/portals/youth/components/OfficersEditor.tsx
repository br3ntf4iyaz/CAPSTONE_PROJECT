import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/utils'

export const POSITIONS: { value: string; label: string; isPublic: boolean }[] = [
  { value: 'president', label: 'President', isPublic: true },
  { value: 'vice_president', label: 'Vice President', isPublic: true },
  { value: 'vp_internal', label: 'VP for Internal Affairs', isPublic: true },
  { value: 'vp_external', label: 'VP for External Affairs', isPublic: true },
  { value: 'secretary', label: 'Secretary', isPublic: true },
  { value: 'treasurer', label: 'Treasurer', isPublic: false },
  { value: 'auditor', label: 'Auditor', isPublic: false },
  { value: 'pro', label: 'Public Relations Officer (PRO)', isPublic: true },
  { value: 'sergeant', label: 'Sergeant-at-Arms / Peace Officer', isPublic: false },
  { value: 'other', label: 'Other (Custom Title)', isPublic: false },
]

export interface OfficerRow { position: string; custom_title: string; name: string; is_me?: boolean }

export const isPublicPosition = (p: string) => POSITIONS.find(x => x.value === p)?.isPublic ?? false

/** The executive board. President, vice presidents, secretary and PRO are shown to the public; the others only to the leader and LYDO. */
export default function OfficersEditor({ value, onChange }: { value: OfficerRow[]; onChange: (v: OfficerRow[]) => void }) {
  const set = (i: number, patch: Partial<OfficerRow>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-500">
        Shown to everyone: President, Vice Presidents, Secretary and PRO. Kept private to you and LYDO (for YORP compliance): Treasurer, Auditor, Sergeant-at-Arms and custom titles.
      </p>
      {value.length === 0 && <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-500">No officers yet.</p>}
      {value.map((r, i) => {
        const pub = isPublicPosition(r.position)
        return (
          <div key={i} className="rounded-xl border border-ink-100 p-2.5 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="input" value={r.position} aria-label="Position" onChange={e => set(i, { position: e.target.value })}>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input className="input" value={r.name} maxLength={200} placeholder="Full name" aria-label="Name of the officer" onChange={e => set(i, { name: e.target.value })} />
            </div>
            {r.position === 'other' && (
              <input className="input" value={r.custom_title} maxLength={60} placeholder="Title, e.g. Business Manager" aria-label="Custom title" onChange={e => set(i, { custom_title: e.target.value })} />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', pub ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-ink-200 bg-ink-50 text-ink-600')}>
                {pub ? <><Eye size={11} /> Shown on the public profile</> : <><EyeOff size={11} /> Private: only you and LYDO</>}
              </span>
              <div className="flex items-center gap-3">
                {r.is_me && <span className="text-[11px] font-semibold text-primary-700">This is you</span>}
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          </div>
        )
      })}
      <button type="button" onClick={() => onChange([...value, { position: 'secretary', custom_title: '', name: '' }])} className="btn-secondary btn-sm gap-1.5"><Plus size={13} /> Add an officer</button>
    </div>
  )
}
