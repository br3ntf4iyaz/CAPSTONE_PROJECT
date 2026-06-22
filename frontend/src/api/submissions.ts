import apiClient from './client'

export interface Submission {
  id: number
  title: string
  category: string
  category_display: string
  submitter_type: 'sk' | 'youth_org'
  status: SubmissionStatus
  status_display: string
  submitted_at: string
  updated_at: string
  thumbnail_url: string | null
  expected_participants: number | null
  description: string
  objectives: string
  target_beneficiaries: string
  start_date: string | null
  end_date: string | null
  location: string
  barangay: string
  estimated_budget: string | null
  admin_notes: string
  revision_notes: string
  actual_participants: number | null
  outcomes_narrative: string
  completion_report_file: string | null
  file: string | null
  attachments: SubmissionAttachment[]
  review_logs: SubmissionReviewLog[]
  submitted_by_email?: string
  submitted_by_name?: string
  reviewed_by_email?: string
  reviewed_at?: string
  approved_at?: string
  completed_at?: string
  // Fields added in migration 0008 (only present on detail responses)
  submission_type?: 'policy' | 'ppa'
  policy_type?: string
  policy_date_passed?: string | null
  abyip_reference_code?: string
  expected_result?: string
  performance_indicator?: string
  period_of_implementation?: string
  actual_disbursement?: string | null
  male_participants?: number | null
  female_participants?: number | null
  lgbtq_participants?: number | null
  prefer_not_say_participants?: number | null
}

export type SubmissionStatus =
  | 'draft'
  | 'pending'
  | 'revision_requested'
  | 'approved'
  | 'in_progress'
  | 'completion_submitted'
  | 'completed'
  | 'rejected'

export interface SubmissionAttachment {
  id: number
  kind: 'main_proposal' | 'supporting' | 'progress_photo' | 'completion_photo'
  file_url: string
  label: string
  uploaded_at: string
}

export interface SubmissionReviewLog {
  id: number
  action: string
  action_display: string
  notes: string
  actor_name: string
  created_at: string
}

export const submissionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/programs/submissions/', { params }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.results ?? [])
    }) as Promise<Submission[]>,

  get: (id: number) =>
    apiClient.get(`/programs/submissions/${id}/`).then(r => r.data) as Promise<Submission>,

  create: (data: FormData) =>
    apiClient
      .post('/programs/submissions/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data) as Promise<Submission>,

  update: (id: number, data: FormData) =>
    apiClient
      .patch(`/programs/submissions/${id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data) as Promise<Submission>,

  submitForReview: (id: number) =>
    apiClient.post(`/programs/submissions/${id}/submit/`).then(r => r.data) as Promise<Submission>,

  markInProgress: (id: number) =>
    apiClient
      .post(`/programs/submissions/${id}/mark-in-progress/`)
      .then(r => r.data) as Promise<Submission>,

  submitCompletion: (id: number, data: FormData) =>
    apiClient
      .post(`/programs/submissions/${id}/submit-completion/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data) as Promise<Submission>,

  // Admin actions
  approve: (id: number, admin_notes: string) =>
    apiClient.post(`/programs/submissions/${id}/approve/`, { admin_notes }).then(r => r.data),

  reject: (id: number, admin_notes: string) =>
    apiClient.post(`/programs/submissions/${id}/reject/`, { admin_notes }).then(r => r.data),

  requestRevision: (id: number, revision_notes: string) =>
    apiClient
      .post(`/programs/submissions/${id}/request-revision/`, { revision_notes })
      .then(r => r.data),

  complete: (id: number, admin_notes: string) =>
    apiClient.post(`/programs/submissions/${id}/complete/`, { admin_notes }).then(r => r.data),

  // Attachments
  addAttachment: (submissionId: number, data: FormData) =>
    apiClient
      .post(`/programs/submissions/${submissionId}/attachments/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data),

  deleteAttachment: (submissionId: number, attachmentId: number) =>
    apiClient.delete(`/programs/submissions/${submissionId}/attachments/${attachmentId}/`),
}
