import { useState } from 'react'
import { Facebook, MessageCircle, Mail, Phone, X, ExternalLink, User as UserIcon, Settings2, Megaphone, ZoomIn } from 'lucide-react'
import ImageLightbox from '@/components/ui/ImageLightbox'
import { cn, formatDate } from '@/utils'
import type { SKSocial } from '@/components/ui/SKSocialEditor'

export interface ProfileOfficial {
  key: string
  name: string
  position: string
  position_display: string
  photo_url: string | null
  social?: SKSocial
}

const safeHref = (v?: string) => (v && /^https:\/\/(www\.facebook\.com|m\.me|www\.messenger\.com|fb\.watch)\//.test(v) ? v : undefined)

function ExternalButton({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
        primary ? 'bg-[#1877F2] text-white hover:bg-[#1465d0]' : 'border border-ink-200 text-ink-800 hover:bg-ink-50',
      )}
    >
      {children}
    </a>
  )
}

/** The expanded profile of ONE SK official: Facebook, a way to message them, public contact and public activities. */
export default function SKOfficialProfile({
  o, barangayName, canManage, onManage, onClose,
}: { o: ProfileOfficial; barangayName: string; canManage: boolean; onManage: () => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(false)
  const s = o.social
  const profile = safeHref(s?.facebook_profile_url)
  const page = safeHref(s?.facebook_page_url)
  const messenger = safeHref(s?.messenger_url)
  const contactTarget = messenger ?? profile ?? page
  const email = s?.public_email
  const phone = s?.public_contact_number
  const activities = (s?.activities ?? []).filter(a => safeHref(a.facebook_post_url))
  const hidden = canManage && s && !s.visible && (s.facebook_profile_url || s.facebook_page_url || s.messenger_url)

  return (
    <div className="fixed inset-0 z-[55] flex items-start sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Profile of ${o.name}`}>
      <div className="h-full sm:h-auto max-h-screen sm:max-h-[92vh] w-full max-w-lg overflow-y-auto bg-white sm:rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-5 pb-5 pt-4 text-white">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><X size={16} /></button>
          <div className="flex items-center gap-4 pt-4">
            {o.photo_url ? (
              <button type="button" onClick={() => setZoom(true)} aria-label={`View a larger picture of ${o.name}`} title="Click to enlarge"
                className="group relative h-20 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-2xl border-2 border-white/40 bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <img src={o.photo_url} alt={o.name} className="h-full w-full object-cover object-top transition-transform group-hover:scale-105" />
                <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"><ZoomIn size={12} /></span>
              </button>
            ) : (
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/40 bg-white/20 flex items-center justify-center"><UserIcon size={36} className="text-white/80" /></div>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-xl font-extrabold leading-tight break-words">{o.name}</h3>
              <p className="text-sm font-medium text-primary-100">{o.position_display}</p>
              <p className="text-xs text-primary-100/90">Barangay {barangayName.replace(/^Barangay\s+/i, '')}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {s?.public_bio && <p className="whitespace-pre-wrap break-words text-sm text-ink-700">{s.public_bio}</p>}

          <div className="space-y-2">
            {profile ? <ExternalButton href={profile} primary><Facebook size={16} /> Visit Facebook Profile</ExternalButton> : (
              <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-sm text-ink-600">Facebook profile not provided.</p>
            )}
            {page && <ExternalButton href={page}><ExternalLink size={15} /> Visit Official Facebook Page</ExternalButton>}
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-ink-500">Contact</h4>
            <div className="mt-2 space-y-2">
              {contactTarget ? (
                <ExternalButton href={contactTarget}><MessageCircle size={15} /> Message SK Official</ExternalButton>
              ) : (
                <p className="text-sm text-ink-500">No messaging link was provided by this official.</p>
              )}
              {contactTarget && !messenger && <p className="text-xs text-ink-500">No Messenger link was given, so this opens their Facebook {profile ? 'profile' : 'page'}.</p>}
              {email && <a href={`mailto:${email}`} className="flex items-center gap-2 break-all text-sm text-primary-700 hover:underline"><Mail size={15} className="shrink-0" /> {email}</a>}
              {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-primary-700 hover:underline"><Phone size={15} className="shrink-0" /> {phone}</a>}
            </div>
          </div>

          {activities.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500"><Megaphone size={13} /> Public Activities and Announcements</h4>
              <ul className="mt-2 space-y-2">
                {activities.map(a => (
                  <li key={a.id} className="rounded-xl border border-ink-100 p-3">
                    <p className="text-sm font-semibold text-ink-900 break-words">{a.title}</p>
                    {a.activity_date && <p className="text-xs text-ink-500">{formatDate(a.activity_date)}</p>}
                    {a.description && <p className="mt-1 text-sm text-ink-700 break-words">{a.description}</p>}
                    <a href={a.facebook_post_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#1877F2] hover:underline"><Facebook size={12} /> View the post on Facebook</a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink-500">These links were added by the SK or LYDO. LYDOP does not read or monitor Facebook.</p>
            </div>
          )}

          {hidden && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">These links are saved but hidden from the public. Turn on &quot;Show these links to the public&quot; to publish them.</p>}

          {canManage && (
            <button type="button" onClick={onManage} className="btn-secondary inline-flex w-full items-center justify-center gap-2"><Settings2 size={15} /> Edit social links</button>
          )}
        </div>
      </div>
      {zoom && o.photo_url && (
        <div onClick={e => e.stopPropagation()}>
        <ImageLightbox src={o.photo_url} alt={`${o.name}, ${o.position_display}`} caption={o.name} subcaption={`${o.position_display} · ${barangayName}`} onClose={() => setZoom(false)} />
      )}
    </div>
  )
}
