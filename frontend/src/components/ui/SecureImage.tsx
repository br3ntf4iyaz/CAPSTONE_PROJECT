import { useEffect, useState } from 'react'
import apiClient from '@/api/client'

/** The API hands out private files as full URLs; axios needs the path after /api. */
function apiPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname.replace(/^\/api/, '')
  } catch {
    return url
  }
}

/** Download a private file with the user's login and return a temporary blob URL. */
export async function fetchPrivateFile(url: string): Promise<string> {
  const res = await apiClient.get(apiPath(url), { responseType: 'blob' })
  return URL.createObjectURL(res.data as Blob)
}

/** Open a private file (photo, PDF) in a new tab. */
export async function openPrivateFile(url: string): Promise<void> {
  const tab = window.open('', '_blank')
  try {
    const blobUrl = await fetchPrivateFile(url)
    if (tab) tab.location.href = blobUrl
  } catch {
    tab?.close()
    throw new Error('Could not open the file.')
  }
}

interface Props {
  src: string
  alt: string
  className?: string
}

/** <img> for files that need a login. Click to open full size in a new tab. */
export function SecureImage({ src, alt, className }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    let created: string | null = null
    setBlobUrl(null)
    setFailed(false)
    fetchPrivateFile(src)
      .then(u => { created = u; if (alive) setBlobUrl(u) })
      .catch(() => { if (alive) setFailed(true) })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [src])

  if (failed) {
    return <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-xl p-3">Could not load this image.</div>
  }
  if (!blobUrl) {
    return <div className="h-24 rounded-xl border border-ink-100 bg-ink-50 animate-pulse" aria-label="Loading image" />
  }
  return (
    <button type="button" onClick={() => window.open(blobUrl, '_blank')} className="block w-full cursor-zoom-in" title="Open full size">
      <img src={blobUrl} alt={alt} className={className} />
    </button>
  )
}
