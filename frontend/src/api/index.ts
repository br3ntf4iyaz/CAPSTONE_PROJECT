import apiClient from './client'
import type {
  Course, Enrollment, Certificate,
  Internship, InternshipApplication, Event, Project, School, SchoolDetail,
  Program, Badge, UserBadge, LeaderboardEntry, Announcement,
  Notification, ComplianceRecord, PaginatedResponse
} from '@/types'

// ─── Courses ──────────────────────────────────────────────────────────────────
export const coursesApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<Course>>('/courses/', { params }),
  get: (id: number) => apiClient.get<Course>(`/courses/${id}/`),
  enroll: (courseId: number) =>
    apiClient.post<Enrollment>('/courses/enrollments/', { course: courseId }),
  myEnrollments: () =>
    apiClient.get<PaginatedResponse<Enrollment>>('/courses/enrollments/'),
  markLessonComplete: (enrollmentId: number, lessonId: number) =>
    apiClient.post(`/courses/enrollments/${enrollmentId}/mark_lesson_complete/`, { lesson_id: lessonId }),
  myCertificates: () =>
    apiClient.get<PaginatedResponse<Certificate>>('/courses/certificates/'),
}

// ─── Internships ──────────────────────────────────────────────────────────────
export const internshipsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<Internship>>('/internships/', { params }),
  get: (id: number) => apiClient.get<Internship>(`/internships/${id}/`),
  apply: (internshipId: number, coverLetter: string, resume?: File) => {
    const form = new FormData()
    form.append('internship', String(internshipId))
    form.append('cover_letter', coverLetter)
    if (resume) form.append('resume', resume)
    return apiClient.post<InternshipApplication>('/internships/applications/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  myApplications: () =>
    apiClient.get<PaginatedResponse<InternshipApplication>>('/internships/applications/'),
  // Admin
  create: (data: Partial<Internship>) => apiClient.post('/internships/', data),
  updateApplicationStatus: (appId: number, status: string, notes?: string) =>
    apiClient.patch(`/internships/applications/${appId}/update_status/`, { status, notes }),
}

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<Event>>('/events/', { params }),
  get: (id: number) => apiClient.get<Event>(`/events/${id}/`),
  register: (id: number) => apiClient.post(`/events/${id}/register/`),
  unregister: (id: number) => apiClient.post(`/events/${id}/unregister/`),
  create: (data: Partial<Event>) => apiClient.post('/events/', data),
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<Project>>('/projects/', { params }),
  get: (id: number) => apiClient.get<Project>(`/projects/${id}/`),
  create: (data: Partial<Project>) => apiClient.post('/projects/', data),
  join: (id: number) => apiClient.post(`/projects/${id}/join/`),
  leave: (id: number) => apiClient.post(`/projects/${id}/leave/`),
}

// ─── Schools ──────────────────────────────────────────────────────────────────
export const schoolsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<School>>('/schools/', { params }),
  get: (id: number) => apiClient.get<SchoolDetail>(`/schools/${id}/`),
  bookmark: (id: number) => apiClient.post(`/schools/${id}/bookmark/`),
  myBookmarks: () => apiClient.get('/schools/bookmarks/'),
  getComparison: () => apiClient.get('/schools/compare/'),
  addToComparison: (schoolId: number) =>
    apiClient.post('/schools/compare/', { school_id: schoolId }),
  clearComparison: () => apiClient.delete('/schools/compare/'),
  recommend: (programName: string, location?: string) =>
    apiClient.post<School[]>('/schools/recommend/', { program_name: programName, location }),
  listPrograms: () => apiClient.get<PaginatedResponse<Program>>('/schools/programs/'),
}

// ─── Recognition ─────────────────────────────────────────────────────────────
export const recognitionApi = {
  badges: () => apiClient.get<PaginatedResponse<Badge>>('/recognition/badges/'),
  myBadges: () => apiClient.get<PaginatedResponse<UserBadge>>('/recognition/user-badges/'),
  myCertificates: () => apiClient.get<PaginatedResponse<Certificate>>('/recognition/certificates/'),
  leaderboard: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<LeaderboardEntry>>('/recognition/leaderboard/', { params }),
  announcements: () =>
    apiClient.get<PaginatedResponse<Announcement>>('/recognition/announcements/'),
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => apiClient.get<PaginatedResponse<Notification>>('/notifications/'),
  markRead: (id: number) => apiClient.post(`/notifications/${id}/mark_read/`),
  markAllRead: () => apiClient.post('/notifications/mark_all_read/'),
}

// ─── Compliance ───────────────────────────────────────────────────────────────
export const complianceApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<ComplianceRecord>>('/compliance/records/', { params }),
  summary: (params?: Record<string, unknown>) =>
    apiClient.get('/compliance/summary/', { params }),
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  users: (params?: Record<string, unknown>) =>
    apiClient.get('/auth/admin/users/', { params }),
  updateUser: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/auth/admin/users/${id}/`, data),
  deactivateUser: (id: number) =>
    apiClient.post(`/auth/admin/users/${id}/deactivate/`),
  activateUser: (id: number) =>
    apiClient.post(`/auth/admin/users/${id}/activate/`),
}

// ─── Support ──────────────────────────────────────────────────────────────────
export const supportApi = {
  faqs: () => apiClient.get('/support/faqs/'),
  createTicket: (data: Record<string, unknown>) =>
    apiClient.post('/support/tickets/', data),
  myTickets: () => apiClient.get('/support/tickets/'),
  submitFeedback: (data: Record<string, unknown>) =>
    apiClient.post('/support/feedback/', data),
}

// ─── Youth Organizations ──────────────────────────────────────────────────────
export const youthOrgsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/youth-orgs/', { params }),
  get: (id: number) => apiClient.get(`/youth-orgs/${id}/`),
  create: (data: Record<string, unknown>) => apiClient.post('/youth-orgs/', data),
  update: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/youth-orgs/${id}/`, data),
  markCompliant: (id: number) =>
    apiClient.post(`/youth-orgs/${id}/mark_compliant/`),
  accomplishments: (orgId: number) =>
    apiClient.get(`/youth-orgs/${orgId}/accomplishments/`),
  addAccomplishment: (orgId: number, data: Record<string, unknown>) =>
    apiClient.post(`/youth-orgs/${orgId}/accomplishments/`, data),
}

// ─── SK Requirements ──────────────────────────────────────────────────────────
export const skApi = {
  barangays: (params?: Record<string, unknown>) =>
    apiClient.get('/sk-requirements/barangays/', { params }),
  getBarangay: (id: number) => apiClient.get(`/sk-requirements/barangays/${id}/`),
  createBarangay: (data: Record<string, unknown>) =>
    apiClient.post('/sk-requirements/barangays/', data),
  requirements: (params?: Record<string, unknown>) =>
    apiClient.get('/sk-requirements/requirements/', { params }),
  updateRequirement: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/sk-requirements/requirements/${id}/`, data),
  markSubmitted: (id: number, file?: File) => {
    const form = new FormData()
    form.append('status', 'submitted')
    if (file) form.append('file', file)
    return apiClient.post(`/sk-requirements/requirements/${id}/mark_submitted/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  complianceSummary: () =>
    apiClient.get('/sk-requirements/barangays/compliance_summary/'),
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/jobs/', { params }),
  get: (id: number) => apiClient.get(`/jobs/${id}/`),
  create: (data: Record<string, unknown>) => apiClient.post('/jobs/', data),
  update: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/jobs/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/jobs/${id}/`),
}

// ─── Programs ─────────────────────────────────────────────────────────────────
export const programsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/programs/', { params }),
  get: (id: number) => apiClient.get(`/programs/${id}/`),
  create: (data: Record<string, unknown>) => apiClient.post('/programs/', data),
  update: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/programs/${id}/`, data),
  featuredCompleted: () =>
    apiClient.get('/programs/?status=completed&is_featured=true'),
  // Submissions
  mySubmissions: () => apiClient.get('/programs/submissions/'),
  allSubmissions: (params?: Record<string, unknown>) =>
    apiClient.get('/programs/submissions/', { params }),
  submit: (data: FormData) =>
    apiClient.post('/programs/submissions/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reviewSubmission: (id: number, status: string, notes?: string) =>
    apiClient.patch(`/programs/submissions/${id}/review/`, { status, admin_notes: notes }),
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────
export const chatbotApi = {
  send: (message: string, session_key?: string) =>
    apiClient.post('/chatbot/', { message, session_key }),
  history: (session_key: string) =>
    apiClient.get(`/chatbot/history/${session_key}/`),
}
