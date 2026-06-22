import { format, formatDistanceToNow } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '\u2014'
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '\u2014'
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // Generic
    active: 'badge-green',
    inactive: 'badge-gray',
    // Course/enrollment
    enrolled: 'badge-blue',
    in_progress: 'badge-yellow',
    completed: 'badge-green',
    // Internship
    submitted: 'badge-blue',
    under_review: 'badge-yellow',
    shortlisted: 'badge-purple',
    interview_scheduled: 'badge-purple',
    accepted: 'badge-green',
    rejected: 'badge-red',
    // Projects
    proposed: 'badge-blue',
    approved: 'badge-green',
    archived: 'badge-gray',
    // Youth Programs (model values)
    ongoing: 'badge-green',
    upcoming: 'badge-blue',
    cancelled: 'badge-red',
    // Generic pending state
    pending: 'badge-yellow',
    // Availability
    available: 'badge-green',
    limited: 'badge-yellow',
    unavailable: 'badge-red',
    // Events
    open: 'badge-green',
    closed: 'badge-red',
    draft: 'badge-gray',
  }
  return map[status] ?? 'badge-gray'
}

export function getEventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    webinar: 'Webinar',
    town_hall: 'Town Hall',
    workshop: 'Workshop',
    consultation: 'Consultation',
    training: 'Training',
    other: 'Other',
  }
  return map[type] ?? type
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    youth: 'Youth Leader (SK)',
    lgu_admin: 'LGU Admin',
    super_admin: 'Super Admin',
  }
  return map[role] ?? role
}

export function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    // YouthProgram model categories
    social_inclusion: 'Social Inclusion',
    health: 'Health',
    active_citizenship: 'Active Citizenship',
    peace_building: 'Peace Building',
    education: 'Education',
    environment: 'Environment',
    governance: 'Governance',
    agriculture: 'Agriculture',
    global_mobility: 'Global Mobility',
    economic: 'Economic',
    // Legacy / other
    leadership: 'Leadership',
    life_skills: 'Life Skills',
    tech: 'Technology',
    finance: 'Finance',
    communication: 'Communication',
  }
  return map[cat] ?? cat.replace(/_/g, ' ')
}

/**
 * Coerce ANY API response shape into an array.
 *
 * Backend uses DRF's PageNumberPagination so list endpoints return
 *   { count, next, previous, results: [...] }
 * but a few custom @action endpoints return a bare array, and some
 * endpoints occasionally return error envelopes like `{detail: "..."}`
 * on edge cases.
 *
 * Components that did `r.data.results ?? r.data` would silently end up
 * with the wrapper object when `results` was missing/undefined and then
 * crash on `.filter` / `.map` (root cause of multiple production crashes \u2014
 * "events.map is not a function", "events.filter is not a function").
 *
 * `toArray` always returns an array, never throws, never produces
 * a non-array even if the input is `null`, an error envelope, or `undefined`.
 *
 * Usage:
 *   queryFn: () => apiClient.get('/events/').then(r => toArray<Event>(r.data))
 */
export function toArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[]
  if (d && typeof d === 'object' && Array.isArray((d as any).results)) {
    return (d as any).results as T[]
  }
  return []
}
