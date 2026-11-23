import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { cn } from '@/utils'

/**
 * One confirmation dialog for the whole admin portal.
 *
 *   if (await confirmDeletion({ what: 'event', name: e.title })) deleteEvent.mutate(e.id)
 *
 * <ConfirmDialogHost /> is mounted once (in the admin layout) and shows the dialog.
 * If the host is not mounted, the browser's own confirm box is used, so a delete is never silent.
 */

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  icon?: 'trash' | 'warning'
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

let show: ((p: Pending) => void) | null = null

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (!show) return Promise.resolve(window.confirm([opts.title, opts.description].filter(Boolean).join('\n\n')))
  return new Promise(resolve => show!({ ...opts, resolve }))
}

/** "Are you sure you want to delete this event?" with the standard permanent-removal warning. */
export function confirmDeletion(o: { what: string; name?: string; note?: string; verb?: string; confirmLabel?: string }): Promise<boolean> {
  const verb = o.verb ?? 'delete'
  const label = o.confirmLabel ?? `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${o.what.charAt(0).toUpperCase()}${o.what.slice(1)}`
  const target = o.name ? `"${o.name}"` : `This ${o.what}`
  return confirmDialog({
    title: `Are you sure you want to ${verb} this ${o.what}?`,
    description: `${target} will be permanently removed. This action cannot be undone.${o.note ? ` ${o.note}` : ''}`,
    confirmLabel: label,
    tone: 'danger',
    icon: 'trash',
  })
}

export function ConfirmDialogHost() {
  const [current, setCurrent] = useState<Pending | null>(null)

  useEffect(() => {
    show = (p: Pending) => setCurrent(prev => { prev?.resolve(false); return p })
    return () => { show = null }
  }, [])

  const close = (ok: boolean) => {
    current?.resolve(ok)
    setCurrent(null)
  }

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { current.resolve(false); setCurrent(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (!current) return null
  const danger = (current.tone ?? 'danger') === 'danger'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full', danger ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-700')}>
          {current.icon === 'trash' ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
        </div>
        <h2 id="confirm-title" className="text-center text-base font-bold text-gray-900">{current.title}</h2>
        {current.description && <p id="confirm-desc" className="mt-2 text-center text-sm text-gray-500">{current.description}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button type="button" autoFocus onClick={() => close(false)} className="btn-secondary sm:min-w-[110px]">
            {current.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={cn(
              'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-w-[110px]',
              danger ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' : 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500',
            )}
          >
            {current.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
