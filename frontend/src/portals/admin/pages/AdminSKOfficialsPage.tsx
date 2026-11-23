import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Plus, Save, Trash2, User as UserIcon, Users, AlertTriangle, ImageOff } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { shrinkImage } from '@/utils/shrinkImage'

interface Official {
  key: string
  id: number | null
  name: string
  position: 'chairperson' | 'kagawad' | 'secretary' | 'treasurer'
  position_display: string
  photo_url: string | null
}

interface Barangay {
  id: number
  barangay_name: string
  sk_chairperson: string
  chairperson_photo_url: string | null
  officials: Official[]
}

const SEATS: { position: 'kagawad' | 'secretary' | 'treasurer'; label: string; count: number }[] = [
  { position: 'kagawad', label: 'SK Kagawad', count: 7 },
  { position: 'secretary', label: 'SK Secretary', count: 1 },
  { position: 'treasurer', label: 'SK Treasurer', count: 1 },
]

const PLACEHOLDER_RE = /^SK (Kagawad \d+|Secretary|Treasurer|Chairperson)$/i

function errText(e: any, fallback: string): string {
  const d = e?.response?.data
  if (!d || typeof d === 'string') return fallback
  if (d.detail) return String(d.detail)
  const first = Object.values(d).flat()[0]
  return first ? String(first) : fallback
}

/** One seat: name, picture and actions. `official` is null for an empty seat. */
function SeatCard({
  barangayId, position, label, official, onChanged,
}: {
  barangayId: number
  position: 'chairperson' | 'kagawad' | 'secretary' | 'treasurer'
  label: string
  official: Official | null
  onChanged: () => void
}) {
  const isChair = position === 'chairperson'
  const [name, setName] = useState(official?.name ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setName(official?.name ?? '') }, [official?.name, official?.id])

  const base = isChair ? `/sk-requirements/barangays/${barangayId}/` : official?.id ? `/sk-requirements/members/${official.id}/` : ''

  const saveName = useMutation({
    mutationFn: () => {
      if (isChair) return apiClient.patch(base, { sk_chairperson: name })
      if (official?.id) return apiClient.patch(base, { name })
      return apiClient.post('/sk-requirements/members/', { barangay: barangayId, position, name })
    },
    onSuccess: () => { toast.success(official ? 'Saved' : 'Official added'); onChanged() },
    onError: e => toast.error(errText(e, 'Could not save')),
  })

  const uploadPhoto = useMutation({
    mutationFn: async (picked: File) => {
      const file = await shrinkImage(picked, 900, 0.88)
      const fd = new FormData()
      if (isChair) {
        fd.append('photo', file)
        return apiClient.post(`${base}chairperson-photo/`, fd, { headers: { 'Content-Type': undefined } })
      }
      if (!official?.id) {
        // create the official first so there is something to attach the picture to
        const created = await apiClient.post('/sk-requirements/members/', { barangay: barangayId, position, name: name || label })
        fd.append('photo', file)
        return apiClient.patch(`/sk-requirements/members/${created.data.id}/`, fd, { headers: { 'Content-Type': undefined } })
      }
      fd.append('photo', file)
      return apiClient.patch(base, fd, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: () => { toast.success('Picture updated'); onChanged() },
    onError: e => toast.error(errText(e, 'Could not upload the picture (use a JPG or PNG under 5 MB)')),
  })

  const removePhoto = useMutation({
    mutationFn: () => {
      if (isChair) {
        const fd = new FormData()
        fd.append('remove', 'true')
        return apiClient.post(`${base}chairperson-photo/`, fd, { headers: { 'Content-Type': undefined } })
      }
      return apiClient.post(`${base}remove-photo/`)
    },
    onSuccess: () => { toast.success('Picture removed'); onChanged() },
    onError: e => toast.error(errText(e, 'Could not remove the picture')),
  })

  const remove = useMutation({
    mutationFn: () => apiClient.delete(base),
    onSuccess: () => { toast.success('Official removed'); onChanged() },
    onError: e => toast.error(errText(e, 'Could not remove')),
  })

  const placeholder = !!official && PLACEHOLDER_RE.test(official.name.trim())
  const dirty = name.trim() !== (official?.name ?? '').trim() && name.trim().length > 1
  const busy = saveName.isPending || uploadPhoto.isPending || removePhoto.isPending || remove.isPending

  return (
    <div className={cn('rounded-2xl border bg-white p-3 flex flex-col gap-2.5', isChair ? 'border-primary-200 ring-1 ring-primary-100' : 'border-gray-100', !official && !isChair && 'border-dashed bg-gray-50')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
        {placeholder && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5">
            <AlertTriangle size={10} /> placeholder
          </span>
        )}
      </div>

      <div className="relative aspect-square w-full max-w-[9rem] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        {official?.photo_url
          ? <img src={official.photo_url} alt={official.name} className="h-full w-full object-cover object-top" />
          : <UserIcon size={46} strokeWidth={1.5} className="text-primary-300" />}
        {uploadPhoto.isPending && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-semibold text-gray-600">Uploading...</div>}
      </div>

      <input
        className="input text-sm"
        value={name}
        maxLength={200}
        placeholder={official || isChair ? 'Full name' : `Full name of the ${label}`}
        onChange={e => setName(e.target.value)}
        aria-label={`${label} name`}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => saveName.mutate()}
          disabled={busy || (official ? !dirty : name.trim().length < 2)}
          className="btn-primary btn-sm inline-flex items-center gap-1 disabled:opacity-40"
        >
          {official || isChair ? <><Save size={12} /> Save name</> : <><Plus size={12} /> Add</>}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary btn-sm inline-flex items-center gap-1" title="Upload a picture">
          <Camera size={12} /> {official?.photo_url ? 'Change' : 'Picture'}
        </button>
        {official?.photo_url && (
          <button type="button" onClick={() => removePhoto.mutate()} disabled={busy} className="btn-secondary btn-sm inline-flex items-center gap-1" title="Remove the picture">
            <ImageOff size={12} />
          </button>
        )}
        {official && !isChair && (
          <button
            type="button"
            onClick={() => { if (window.confirm(`Remove ${official.name} (${label}) from this council?`)) remove.mutate() }}
            disabled={busy}
            className="ml-auto text-red-600 hover:bg-red-50 rounded-lg p-1.5"
            aria-label="Remove official"
            title="Remove official"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) uploadPhoto.mutate(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function AdminSKOfficialsPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: barangays = [], isLoading } = useQuery<Barangay[]>({
    queryKey: ['admin-sk-officials'],
    queryFn: () => apiClient.get('/sk-requirements/barangays/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })

  useEffect(() => {
    if (selectedId === null && barangays.length > 0) setSelectedId(barangays[0].id)
  }, [barangays, selectedId])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-sk-officials'] })
    qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] }) // the public directory updates right away
  }

  const selected = barangays.find(b => b.id === selectedId) ?? null
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase()
    return barangays.filter(b => !t || b.barangay_name.toLowerCase().includes(t) || (b.sk_chairperson ?? '').toLowerCase().includes(t))
  }, [barangays, search])

  const byPosition = (p: string) => (selected?.officials ?? []).filter(o => o.position === p)
  const seatsFilled = selected ? selected.officials.length : 0
  const placeholders = selected ? selected.officials.filter(o => PLACEHOLDER_RE.test(o.name.trim())).length : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white"><Users size={20} /></span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">SK Officials</h1>
          <p className="text-xs text-gray-500">Names and pictures of each barangay's SK council. Changes appear in the public SK Directory right away.</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-5">
        {/* Barangay list */}
        <div className="rounded-2xl border border-gray-100 bg-white p-3 space-y-2 lg:max-h-[75vh] lg:overflow-y-auto">
          <input className="input text-sm" placeholder="Search barangay or chairperson" value={search} onChange={e => setSearch(e.target.value)} />
          <ul className="space-y-1">
            {shown.map(b => {
              const filled = b.officials.length
              const ph = b.officials.filter(o => PLACEHOLDER_RE.test(o.name.trim())).length
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={cn('w-full text-left rounded-xl px-3 py-2 text-sm transition-colors', b.id === selectedId ? 'bg-primary-600 text-white' : 'hover:bg-gray-50 text-gray-700')}
                  >
                    <span className="font-semibold">{b.barangay_name}</span>
                    <span className={cn('block text-xs', b.id === selectedId ? 'text-primary-100' : 'text-gray-500')}>
                      {filled}/10 seats{ph > 0 ? ` · ${ph} placeholder` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
            {!isLoading && shown.length === 0 && <li className="text-sm text-gray-500 px-2 py-3">No barangay found.</li>}
          </ul>
        </div>

        {/* Council editor */}
        {selected && (
          <div className="space-y-5 min-w-0">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{selected.barangay_name}</h2>
                <p className="text-xs text-gray-500">{seatsFilled}/10 seats filled</p>
              </div>
              {placeholders > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {placeholders} seat{placeholders > 1 ? 's' : ''} still use placeholder names. Enter the verified names.
                </p>
              )}
            </div>

            <div className="max-w-xs">
              <SeatCard
                key={`chair-${selected.id}-${selected.sk_chairperson}-${selected.chairperson_photo_url ?? ''}`}
                barangayId={selected.id}
                position="chairperson"
                label="SK Chairperson"
                official={{ key: 'chair', id: null, name: selected.sk_chairperson, position: 'chairperson', position_display: 'SK Chairperson', photo_url: selected.chairperson_photo_url }}
                onChanged={refresh}
              />
            </div>

            {SEATS.map(seat => {
              const have = byPosition(seat.position)
              const slots = Array.from({ length: seat.count }, (_, i) => have[i] ?? null)
              return (
                <div key={seat.position}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    {seat.label}{seat.count > 1 ? 's' : ''} ({have.length}/{seat.count})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                    {slots.map((o, i) => (
                      <SeatCard
                        key={o ? `${o.id}-${o.name}-${o.photo_url ?? ''}` : `empty-${seat.position}-${i}-${selected.id}`}
                        barangayId={selected.id}
                        position={seat.position}
                        label={seat.count > 1 ? `${seat.label} ${i + 1}` : seat.label}
                        official={o}
                        onChanged={refresh}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
