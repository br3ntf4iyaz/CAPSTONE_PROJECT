/** The colour of an organization's card and profile. LYDO or the leader picks it; without a pick it follows the kind of organization. */
export type Accent = 'blue' | 'emerald' | 'rose' | 'amber' | 'violet' | 'orange' | 'teal' | 'sky'

export const ACCENT_OPTIONS: { value: Accent; label: string }[] = [
  { value: 'blue', label: 'Blue' },
  { value: 'emerald', label: 'Green' },
  { value: 'rose', label: 'Red' },
  { value: 'amber', label: 'Yellow' },
  { value: 'violet', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'teal', label: 'Teal' },
  { value: 'sky', label: 'Sky blue' },
]

export interface AccentStyle { card: string; tile: string; name: string; button: string; outline: string; header: string; swatch: string }

// every class is written in full, so Tailwind keeps it
export const ACCENTS: Record<Accent, AccentStyle> = {
  blue: {
    card: 'border-blue-100 border-l-blue-500 bg-gradient-to-r from-blue-50/80 via-white to-white hover:border-blue-300 hover:shadow-blue-600/10',
    tile: 'from-blue-500 to-blue-700 shadow-blue-600/30',
    name: 'text-blue-900 group-hover:text-blue-700',
    button: 'bg-blue-700 shadow-blue-600/20 group-hover:bg-blue-800',
    outline: 'border-blue-200 text-blue-700 hover:border-blue-400',
    header: 'from-blue-600 to-blue-800',
    swatch: 'bg-blue-500',
  },
  emerald: {
    card: 'border-emerald-100 border-l-emerald-500 bg-gradient-to-r from-emerald-50/80 via-white to-white hover:border-emerald-300 hover:shadow-emerald-600/10',
    tile: 'from-emerald-500 to-emerald-700 shadow-emerald-600/30',
    name: 'text-emerald-900 group-hover:text-emerald-700',
    button: 'bg-emerald-700 shadow-emerald-600/20 group-hover:bg-emerald-800',
    outline: 'border-emerald-200 text-emerald-700 hover:border-emerald-400',
    header: 'from-emerald-600 to-emerald-800',
    swatch: 'bg-emerald-500',
  },
  rose: {
    card: 'border-rose-100 border-l-rose-500 bg-gradient-to-r from-rose-50/80 via-white to-white hover:border-rose-300 hover:shadow-rose-600/10',
    tile: 'from-rose-500 to-rose-700 shadow-rose-600/30',
    name: 'text-rose-900 group-hover:text-rose-700',
    button: 'bg-rose-700 shadow-rose-600/20 group-hover:bg-rose-800',
    outline: 'border-rose-200 text-rose-700 hover:border-rose-400',
    header: 'from-rose-600 to-rose-800',
    swatch: 'bg-rose-500',
  },
  amber: {
    card: 'border-amber-100 border-l-amber-500 bg-gradient-to-r from-amber-50/80 via-white to-white hover:border-amber-300 hover:shadow-amber-600/10',
    tile: 'from-amber-500 to-amber-700 shadow-amber-600/30',
    name: 'text-amber-900 group-hover:text-amber-700',
    button: 'bg-amber-700 shadow-amber-600/20 group-hover:bg-amber-800',
    outline: 'border-amber-200 text-amber-700 hover:border-amber-400',
    header: 'from-amber-600 to-amber-800',
    swatch: 'bg-amber-500',
  },
  violet: {
    card: 'border-violet-100 border-l-violet-500 bg-gradient-to-r from-violet-50/80 via-white to-white hover:border-violet-300 hover:shadow-violet-600/10',
    tile: 'from-violet-500 to-violet-700 shadow-violet-600/30',
    name: 'text-violet-900 group-hover:text-violet-700',
    button: 'bg-violet-700 shadow-violet-600/20 group-hover:bg-violet-800',
    outline: 'border-violet-200 text-violet-700 hover:border-violet-400',
    header: 'from-violet-600 to-violet-800',
    swatch: 'bg-violet-500',
  },
  orange: {
    card: 'border-orange-100 border-l-orange-500 bg-gradient-to-r from-orange-50/80 via-white to-white hover:border-orange-300 hover:shadow-orange-600/10',
    tile: 'from-orange-500 to-orange-700 shadow-orange-600/30',
    name: 'text-orange-900 group-hover:text-orange-700',
    button: 'bg-orange-700 shadow-orange-600/20 group-hover:bg-orange-800',
    outline: 'border-orange-200 text-orange-700 hover:border-orange-400',
    header: 'from-orange-600 to-orange-800',
    swatch: 'bg-orange-500',
  },
  teal: {
    card: 'border-teal-100 border-l-teal-500 bg-gradient-to-r from-teal-50/80 via-white to-white hover:border-teal-300 hover:shadow-teal-600/10',
    tile: 'from-teal-500 to-teal-700 shadow-teal-600/30',
    name: 'text-teal-900 group-hover:text-teal-700',
    button: 'bg-teal-700 shadow-teal-600/20 group-hover:bg-teal-800',
    outline: 'border-teal-200 text-teal-700 hover:border-teal-400',
    header: 'from-teal-600 to-teal-800',
    swatch: 'bg-teal-500',
  },
  sky: {
    card: 'border-sky-100 border-l-sky-500 bg-gradient-to-r from-sky-50/80 via-white to-white hover:border-sky-300 hover:shadow-sky-600/10',
    tile: 'from-sky-500 to-sky-700 shadow-sky-600/30',
    name: 'text-sky-900 group-hover:text-sky-700',
    button: 'bg-sky-700 shadow-sky-600/20 group-hover:bg-sky-800',
    outline: 'border-sky-200 text-sky-700 hover:border-sky-400',
    header: 'from-sky-600 to-sky-800',
    swatch: 'bg-sky-500',
  },
}

const BY_KIND: Record<string, Accent> = { school_based: 'blue', community_based: 'emerald', faith_based: 'violet' }

export function accentOf(org: { accent?: string; classification: string }): AccentStyle {
  const key = (org.accent && org.accent in ACCENTS ? org.accent : BY_KIND[org.classification] ?? 'blue') as Accent
  return ACCENTS[key]
}
