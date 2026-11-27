import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'

export type ScholarshipAppStatus =
  | 'submitted' | 'under_review' | 'for_compliance' | 'approved' | 'rejected' | 'withdrawn'

export interface ScholarshipDocument {
  id: number
  doc_type: string
  label: string
  original_name: string
  url: string
  uploaded_at: string
}

export interface ScholarshipApplication {
  id: number
  reference_number: string
  scholarship: number
  scholarship_title: string
  personal: Record<string, string>
  education: Record<string, string>
  family: Record<string, string>
  status: ScholarshipAppStatus
  status_display: string
  admin_remarks: string
  applicant_message: string
  documents: ScholarshipDocument[]
  applicant_type?: string
  applicant_email: string
  submitted_at: string
  updated_at: string
  reviewed_at: string | null
}

export const SCHOLARSHIP_STATUS: Record<ScholarshipAppStatus, { label: string; cls: string; hint: string }> = {
  submitted:      { label: 'Submitted',      cls: 'bg-ink-100 text-ink-700',         hint: 'Your application has been successfully received.' },
  under_review:   { label: 'Under Review',   cls: 'bg-amber-100 text-amber-800',     hint: 'Your application is currently being evaluated.' },
  for_compliance: { label: 'For Compliance', cls: 'bg-orange-100 text-orange-800',   hint: 'Additional information or documents are needed. See the remarks below.' },
  approved:       { label: 'Approved',       cls: 'bg-emerald-100 text-emerald-800', hint: 'Congratulations! Your application was approved.' },
  rejected:       { label: 'Rejected',       cls: 'bg-red-100 text-red-700',         hint: 'Your application was not approved this time.' },
  withdrawn:      { label: 'Withdrawn',      cls: 'bg-ink-100 text-ink-500',         hint: 'You withdrew this application.' },
}

export function useMyScholarshipApplications() {
  return useQuery<ScholarshipApplication[]>({
    queryKey: ['my-scholarship-applications'],
    queryFn: () => apiClient.get('/applications/scholarship/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })
}

/** The error text of a failed API call (field errors are flattened into one readable sentence). */
export function apiErrorMessage(e: any, fallback = 'Something went wrong. Please try again.'): string {
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
