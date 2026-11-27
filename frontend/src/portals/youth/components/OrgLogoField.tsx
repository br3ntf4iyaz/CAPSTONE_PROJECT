import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import ImageCropper from '@/components/ui/ImageCropper'
import PhotoViewer from '@/components/ui/PhotoViewer'

/** The logo of an organization: choose a picture, frame it (drag, zoom, nudge), then it is saved. Click the logo to see it large. */
export default function OrgLogoField({ orgId, name, logoUrl, onChanged }: { orgId: number; name: string; logoUrl: string | null | undefined; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [crop, setCrop] = useState<File | null>(null)
  const [viewing, setViewing] = useState(false)

  const save = useMutation({
    mutationFn: (file: File | null) => {
      if (!file) return apiClient.delete(`/youth-orgs/${orgId}/logo/`)
      const fd = new FormData()
      fd.append('logo', file)
      return apiClient.post(`/youth-orgs/${orgId}/logo/`, fd, { headers: { 'Content-Type': undefined as unknown as string } })
    },
    onSuccess: (_r, file) => { toast.success(file ? 'Logo updated' : 'Logo removed'); setCrop(null); onChanged() },
    onError: (e: any) => toast.error(e?.response?.data?.logo?.[0] ?? e?.response?.data?.detail ?? 'Could not save the logo. Use a JPG or PNG under 5 MB.'),
  })

  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        <button type="button" onClick={() => setViewing(true)} title="View logo" aria-label="View the logo"
          className="h-16 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm transition hover:ring-2 hover:ring-primary-300">
          <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
        </button>
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-ink-50 text-ink-400"><Users size={24} /></span>
      )}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-ink-600">Logo of the organization</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={save.isPending} className="btn-secondary btn-sm gap-1.5 disabled:opacity-50">
            <Camera size={13} /> {save.isPending ? 'Saving…' : logoUrl ? 'Change logo' : 'Add a logo'}
          </button>
          {logoUrl && (
            <button type="button" disabled={save.isPending} onClick={() => { if (window.confirm('Remove the logo?')) save.mutate(null) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={12} /> Remove</button>
          )}
        </div>
        <p className="text-[11px] text-ink-500">JPG or PNG, up to 5 MB. You can frame it before it is saved.</p>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) setCrop(f); e.target.value = '' }} />
      {crop && <ImageCropper file={crop} title="Adjust the logo" aspect={1} outputSize={512} onCancel={() => setCrop(null)} onConfirm={f => save.mutate(f)} />}
      {viewing && logoUrl && <PhotoViewer src={logoUrl} alt={`${name} logo`} onClose={() => setViewing(false)} onChange={() => { setViewing(false); fileRef.current?.click() }} />}
    </div>
  )
}
