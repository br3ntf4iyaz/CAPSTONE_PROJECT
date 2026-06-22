// ─── Auth & Users ─────────────────────────────────────────────────────────────
export type Role = 'youth' | 'lgu_admin' | 'super_admin'
export type YouthType = 'general_youth' | 'sk' | 'youth_org_leader'

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: Role
  youth_type: YouthType
  is_email_verified: boolean
  avatar_url: string | null
  onboarding_complete: boolean
  date_joined: string
  profile: Profile
  skills: string[]
  interests: string[]
}

export interface Profile {
  id: number
  bio: string
  phone: string
  barangay: string
  municipality: string
  province: string
  birthdate: string | null
  gender: string
  sk_position: string
  term_start: string | null
  term_end: string | null
  organization: string
  job_title: string
  years_of_experience: number | null
  linkedin_url: string
  website_url: string
  lgu_name: string
  lgu_position: string
  completeness_percent: number
  updated_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface AuthResponse {
  user: User
  access: string
  refresh: string
}

// ─── Courses ──────────────────────────────────────────────────────────────────
export type CourseCategory = 'leadership' | 'governance' | 'life_skills' | 'tech' | 'finance' | 'communication'

export interface Course {
  id: number
  title: string
  slug: string
  description: string
  category: CourseCategory
  thumbnail_url: string | null
  duration_hours: number
  is_published: boolean
  is_featured: boolean
  enrollment_count: number
  instructor: string | null
}

export interface Enrollment {
  id: number
  course: Course
  status: 'enrolled' | 'in_progress' | 'completed'
  progress_percent: number
  enrolled_at: string
  completed_at: string | null
}

export interface Certificate {
  id: number
  title: string
  issued_by: string
  issued_at: string
  certificate_number: string
  file: string | null
}

// ─── Internships ──────────────────────────────────────────────────────────────
export interface Internship {
  id: number
  title: string
  organization: string
  location: string
  mode: 'onsite' | 'remote' | 'hybrid'
  status: 'draft' | 'open' | 'closed'
  deadline: string | null
  start_date: string | null
  end_date: string | null
  slots: number
  is_featured: boolean
  description: string
  requirements: string
}

export interface InternshipApplication {
  id: number
  internship: number
  status: 'submitted' | 'under_review' | 'shortlisted' | 'interview_scheduled' | 'accepted' | 'rejected' | 'completed'
  submitted_at: string
  interview_date: string | null
}

// ─── Events ───────────────────────────────────────────────────────────────────
export interface Event {
  id: number
  title: string
  description: string
  event_type: 'webinar' | 'town_hall' | 'workshop' | 'consultation' | 'training' | 'other'
  location: string
  meeting_link: string
  start_datetime: string
  end_datetime: string
  capacity: number | null
  is_published: boolean
  registration_count: number
  is_registered?: boolean
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export interface Project {
  id: number
  title: string
  description: string
  category: string
  status: 'proposed' | 'under_review' | 'approved' | 'active' | 'completed' | 'archived'
  created_by: number
  start_date: string | null
  end_date: string | null
  member_count: number
  is_member?: boolean
}

// ─── Schools ──────────────────────────────────────────────────────────────────
export type SchoolType = 'public' | 'private' | 'state_university' | 'community_college' | 'technical_vocational'

export interface School {
  id: number
  name: string
  slug: string
  school_type: SchoolType
  municipality: string
  province: string
  description: string
  address: string
  phone: string
  email: string
  website: string
  logo_url: string | null
  program_count: number
}

export interface SchoolDetail extends School {
  programs: SchoolProgram[]
  latitude: number | null
  longitude: number | null
  facebook_url: string
}

export interface Program {
  id: number
  name: string
  code: string
  description: string
  program_type: string
}

export interface SchoolProgram {
  id: number
  program: Program
  tuition_per_year: number | null
  scholarship_available: boolean
  admission_requirements: string
}

// ─── Recognition ─────────────────────────────────────────────────────────────
export interface Badge {
  id: number
  name: string
  description: string
  icon: string | null
  category: string
}

export interface UserBadge {
  id: number
  badge: Badge
  earned_at: string
}

export interface LeaderboardEntry {
  id: number
  user: { id: number; full_name: string; avatar_url: string | null }
  total_score: number
  rank: number | null
}

export interface Announcement {
  id: number
  title: string
  content: string
  published_at: string | null
  is_published: boolean
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface Notification {
  id: number
  title: string
  message: string
  notification_type: string
  is_read: boolean
  link: string
  created_at: string
}

// ─── API Pagination ───────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Compliance ───────────────────────────────────────────────────────────────
export interface ComplianceRecord {
  id: number
  user: number
  record_type: string
  value: number
  description: string
  recorded_at: string
}

// ─── Youth Organizations ──────────────────────────────────────────────────────
export type OrgClassification = 'school_based' | 'community_based' | 'faith_based'
export type OrgSubClass = 'sk_council' | 'youth_org' | 'youth_serving'
export type OrgRegCategory = 'lydo' | 'nyc' | 'not_registered'

export interface YouthOrganization {
  id: number
  name: string
  classification: OrgClassification
  sub_classification: OrgSubClass
  registration_category: OrgRegCategory
  barangay: string
  description: string
  contact_person: string
  contact_email: string
  contact_phone: string
  logo_url: string | null
  is_active: boolean
  is_compliant: boolean
  created_at: string
}

export interface OrgAccomplishment {
  id: number
  organization: number
  title: string
  description: string
  date_achieved: string | null
}

// ─── SK Requirements ──────────────────────────────────────────────────────────
export interface SKBarangay {
  id: number
  barangay_name: string
  sk_chairperson: string
  contact_email: string
  contact_phone: string
  description: string
  logo_url: string | null
  submitted_count: number
  pending_count: number
  overdue_count: number
}

export interface SKRequirement {
  id: number
  barangay: number
  requirement_type: string
  status: 'submitted' | 'pending' | 'overdue'
  file: string | null
  submitted_at: string | null
  due_date: string | null
  notes: string
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export interface JobOpportunity {
  id: number
  title: string
  company_or_org: string
  location: string
  job_type: string
  industry: string
  description: string
  requirements: string
  salary_range: string
  application_deadline: string | null
  application_link: string
  contact_email: string
  is_active: boolean
  is_featured: boolean
  created_at: string
}

// ─── Programs ─────────────────────────────────────────────────────────────────
export type ProgramCategory =
  | 'social_inclusion' | 'health' | 'active_citizenship' | 'peace_building'
  | 'education' | 'environment' | 'governance' | 'agriculture'
  | 'global_mobility' | 'economic'

export type ProgramStatus = 'ongoing' | 'completed' | 'upcoming' | 'cancelled'

export interface YouthProgram {
  id: number
  title: string
  category: ProgramCategory
  status: ProgramStatus
  submitter_type: 'sk' | 'youth_org'
  barangay: string
  description: string
  male_participants: number
  female_participants: number
  total_participants: number
  start_date: string | null
  end_date: string | null
  location: string
  is_featured: boolean
  thumbnail_url: string | null
  created_at: string
}

export interface ProgramSubmission {
  id: number
  title: string
  description: string
  submitter_type: 'sk' | 'youth_org'
  status: 'pending' | 'reviewed' | 'approved' | 'rejected'
  submitted_at: string
  admin_notes: string
  file: string | null
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
