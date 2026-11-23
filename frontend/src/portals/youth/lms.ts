import apiClient from '@/api/client'

export type Audience = 'general_youth' | 'youth_org_leaders' | 'sk_officials'

export const AUDIENCES: { value: Audience; label: string; short: string; hint: string }[] = [
  { value: 'general_youth', label: 'General Youth', short: 'General Youth', hint: 'For all young people' },
  { value: 'youth_org_leaders', label: 'Youth Organization Leaders', short: 'Org Leaders', hint: 'For officers and leaders of youth organizations' },
  { value: 'sk_officials', label: 'SK Officials', short: 'SK Officials', hint: 'For Sangguniang Kabataan officials' },
]

export const AUDIENCE_STYLE: Record<Audience, string> = {
  general_youth: 'bg-sky-50 text-sky-800 border-sky-200',
  youth_org_leaders: 'bg-violet-50 text-violet-800 border-violet-200',
  sk_officials: 'bg-amber-50 text-amber-900 border-amber-200',
}

export const CATEGORY_LABELS: Record<string, string> = {
  leadership: 'Leadership',
  governance: 'Governance',
  life_skills: 'Life Skills',
  tech: 'Technology',
  finance: 'Finance',
  communication: 'Communication',
}

export interface CourseMini {
  id: number
  title: string
  slug: string
  description?: string
  category: string
  audience: Audience
  audience_display: string
  learning_outcomes?: string[]
  passing_score?: number
  thumbnail_url: string | null
  duration_hours: number
  instructor_name: string | null
  enrollment_count: number
  total_lessons?: number
  module_count?: number
  price: string | number | null
}

export type LearningStatus = 'not_started' | 'in_progress' | 'completed'

export interface Enrollment {
  id: number
  course: CourseMini
  certificate_name: string
  enrolled_at: string
  completed_at: string | null
  progress_percent: number
  status: 'enrolled' | 'in_progress' | 'completed'
  total_lessons: number
  completed_lessons: number
  certificate_id: number | null
  learning_status: LearningStatus
  current_lesson_id: number | null
  current_lesson_title: string | null
}

export const LEARNING_STATUS: Record<LearningStatus, { label: string; cls: string }> = {
  not_started: { label: 'Not Started', cls: 'bg-ink-100 text-ink-600' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-800' },
}

export interface StateLesson {
  id: number
  title: string
  order: number
  status: 'completed' | 'current' | 'locked'
  duration_minutes: number | null
  has_video: boolean
  video_watched: boolean
  video_percent: number
  question_count: number
  score: number | null
  max_score: number | null
}

export interface StateModule {
  id: number
  title: string
  order: number
  lessons: StateLesson[]
}

export interface CourseState {
  enrollment_id: number
  course_id: number
  course_title: string
  audience: Audience
  audience_display: string
  certificate_name: string
  status: 'enrolled' | 'in_progress' | 'completed'
  progress_percent: number
  total_lessons: number
  completed_lessons: number
  current_lesson_id: number | null
  certificate_id: number | null
  modules: StateModule[]
}

export const toArray = <T,>(d: any): T[] => (Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [])

/** A readable error from the API (field errors are joined into one sentence). */
export function apiMessage(e: any, fallback = 'Something went wrong. Please try again.'): string {
  const d = e?.response?.data
  if (!d) return fallback
  if (typeof d === 'string') return d
  if (d.detail) return String(d.detail)
  const parts: string[] = []
  const walk = (v: any) => {
    if (typeof v === 'string') parts.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(d)
  return parts.join(' ') || fallback
}

/** Download a file the API protects with the login (the PDF certificate). */
export async function downloadWithLogin(path: string, filename: string): Promise<void> {
  const res = await apiClient.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
