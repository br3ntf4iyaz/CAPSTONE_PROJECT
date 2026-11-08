// Shared types and fallback data for the public home page.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PublicEvent {
  id: number
  title: string
  description: string
  location: string
  start_datetime: string
  end_datetime: string
  is_featured: boolean
  registration_count: number
}

export interface PublicSurvey {
  id: number
  title: string
  description: string
  is_active: boolean
  response_count: number
  questions: { id: number; question: string; question_type: string; order: number }[]
  created_at: string
}

export interface FeaturedPost {
  id: number
  title: string
  content: string
  post_type: string
  thumbnail?: string
  source?: string
  date_of_event?: string
  is_published: boolean
  order: number
  created_at: string
}

// ─── Slide types ─────────────────────────────────────────────

/** Shape from the API (/programs/slides/) */
export interface ApiSlide {
  id: number
  title: string
  description: string
  organizer: string
  tag_label: string
  tag_color: string
  image_url?: string
  is_active: boolean
  order: number
}

/** Internal shape used by ProgramSlider */
export interface Slide {
  id: number
  image: string
  tag: string
  tagColor: string
  title: string
  description: string
  organizer: string
}

/** Static fallback slides (shown when API has no slides yet) */
export const FALLBACK_SLIDES: Slide[] = [
  { id: 1, image: '/images/activities/youth-training.jpg', tag: 'LYDO Program', tagColor: 'bg-accent-400 text-white', title: 'Barangay-Level Youth Training & Orientation', description: 'Empowering youth across Lucena City barangays through skills training, rights awareness, and community engagement activities organized by LYDO.', organizer: 'Lucena City Youth Development Office' },
  { id: 2, image: '/images/activities/heritage-tour.jpg', tag: 'SK Activity', tagColor: 'bg-emerald-500 text-white', title: 'Heritage & Cultural Immersion Tour', description: 'SK youth leaders explore Lucena City history and culture through guided museum visits.', organizer: 'Sangguniang Kabataan Federation' },
  { id: 3, image: '/images/activities/palarong-pinoy.jpg', tag: 'Community Event', tagColor: 'bg-amber-500 text-white', title: 'Palarong Pinoy \u2014 Car-Free Sunday', description: 'Celebrating Filipino traditional games every Car-Free Sunday on Quezon Avenue, in partnership with LYDO.', organizer: 'LYDO & City Government of Lucena' },
  { id: 4, image: '/images/activities/lydc-meeting-1.jpg', tag: 'LYDO Assembly', tagColor: 'bg-primary text-white', title: 'LYDC 4th Quarterly Meeting & LYORP General Assembly', description: 'City youth leaders gathered at Lucena City Government Complex for the quarterly LYDC meeting.', organizer: 'Lucena Youth Development Council' },
  { id: 5, image: '/images/activities/lydc-meeting-2.jpg', tag: 'LYDO Assembly', tagColor: 'bg-primary text-white', title: 'LYORP General Assembly cum Logo Making Contest', description: 'Youth organizations across Lucena City converged for the LYORP General Assembly, fostering collaboration and youth governance.', organizer: 'Lucena Youth Development Council' },
]

export function apiSlidesToSlides(apiSlides: ApiSlide[]): Slide[] {
  return apiSlides.map(s => ({
    id: s.id,
    image: s.image_url ?? '',
    tag: s.tag_label,
    tagColor: s.tag_color,
    title: s.title,
    description: s.description,
    organizer: s.organizer,
  }))
}

export interface PublicStats {
  registered_youth: number
  barangay_sk_councils: number
  youth_organizations: number
  active_jobs: number
}
