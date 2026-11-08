import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { toArray } from '@/utils'
import { useAuthStore } from '@/store/authStore'
import { HeroSection } from './home/HeroSection'
import { ActivitiesSection } from './home/ActivitiesSection'
import { FeaturedPostsSection } from './home/FeaturedPostsSection'
import { FeaturesSection } from './home/FeaturesSection'
import { OpportunitiesSection } from './home/OpportunitiesSection'
import { EventsSection } from './home/EventsSection'
import { ResourcesSection } from './home/ResourcesSection'
import { SurveysSection } from './home/SurveysSection'
import { ChatbotPromoSection } from './home/ChatbotPromoSection'
import { CtaSection } from './home/CtaSection'
import {
  FALLBACK_SLIDES, apiSlidesToSlides,
  type ApiSlide, type FeaturedPost, type PublicEvent, type PublicStats, type PublicSurvey, type Slide,
} from './home/types'

/**
 * Public landing page. This file only loads the data and lays out the sections;
 * each section lives in ./home. Every query falls back to an empty value so the
 * page still renders when the API is unreachable.
 */
export default function YouthHomePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  // Gate: if not logged in, redirect to login with intended destination
  const gated = (dest: string) => () => {
    if (isAuthenticated) navigate(dest)
    else navigate(`/login?next=${dest}`)
  }

  const featuredPostsQ = useQuery({
    queryKey: ['public-featured-posts'],
    queryFn: () =>
      apiClient.get('/events/featured-posts/')
        .then(r => toArray<FeaturedPost>(r.data))
        .catch(() => []),
  })

  const publicEventsQ = useQuery({
    queryKey: ['public-events-home'],
    queryFn: () =>
      apiClient.get('/events/?ordering=start_datetime')
        .then(r => toArray<PublicEvent>(r.data).slice(0, 4))
        .catch(() => []),
  })

  const publicSurveysQ = useQuery({
    queryKey: ['public-surveys-home'],
    queryFn: () =>
      apiClient.get('/events/surveys/')
        .then(r => toArray<PublicSurvey>(r.data).filter(s => s.is_active).slice(0, 3))
        .catch(() => []),
  })

  const featuredSlidesQ = useQuery({
    queryKey: ['public-featured-slides'],
    queryFn: () =>
      apiClient.get('/programs/slides/')
        .then(r => toArray<ApiSlide>(r.data))
        .catch(() => []),
  })

  const statsQ = useQuery<PublicStats | null>({
    queryKey: ['public-stats'],
    queryFn: () => apiClient.get('/auth/stats/').then(r => r.data).catch(() => null),
    staleTime: 1000 * 60 * 10,
  })

  const slides: Slide[] = featuredSlidesQ.data && featuredSlidesQ.data.length > 0
    ? apiSlidesToSlides(featuredSlidesQ.data)
    : FALLBACK_SLIDES

  return (
    <div className="bg-paper-50">
      <HeroSection isAuthenticated={isAuthenticated} stats={statsQ.data} />
      <ActivitiesSection slides={slides} />
      <FeaturedPostsSection posts={featuredPostsQ.data ?? []} isLoading={featuredPostsQ.isLoading} />
      <FeaturesSection gated={gated} />
      <OpportunitiesSection />
      <EventsSection events={publicEventsQ.data} isLoading={publicEventsQ.isLoading} gated={gated} />
      <ResourcesSection />
      <SurveysSection surveys={publicSurveysQ.data} isLoading={publicSurveysQ.isLoading} gated={gated} />
      <ChatbotPromoSection gated={gated} />
      <CtaSection />
    </div>
  )
}
