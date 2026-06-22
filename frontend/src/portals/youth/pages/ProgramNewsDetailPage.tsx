import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Tag } from 'lucide-react'

// Same static data as the News page carousel slides
const PROGRAM_SLIDES = [
  {
    id: '1',
    image: '/images/activities/youth-training.jpg',
    tag: 'LYDO Program',
    title: 'Barangay-Level Youth Training & Orientation',
    description: 'Empowering youth across Lucena City barangays through skills training, rights awareness, and community engagement activities organized by LYDO.',
    body: `The Lucena City Youth Development Office (LYDO) regularly conducts barangay-level youth training and orientation programs across all barangays of Lucena City.

These sessions aim to equip young Lucenahins with essential life skills, awareness of their rights and responsibilities, and practical knowledge about community engagement and governance.

Topics covered include youth leadership, SK roles and responsibilities, community-based project planning, and mental health awareness. Participants receive certificates of completion and are encouraged to cascade their learnings to fellow youth in their communities.

The program is open to all registered youth aged 15–30 residing in Lucena City.`,
    organizer: 'Lucena City Youth Development Office',
  },
  {
    id: '2',
    image: '/images/activities/heritage-tour.jpg',
    tag: 'SK Activity',
    title: 'Heritage & Cultural Immersion Tour',
    description: 'SK youth leaders explore Lucena City history and culture through guided museum visits.',
    body: `The Sangguniang Kabataan Federation of Lucena City organizes Heritage and Cultural Immersion Tours as part of its commitment to instilling pride and awareness of local history among the youth.

Participants visit key historical landmarks and museums in Lucena City and the surrounding Quezon Province, guided by local historians and cultural advocates.

The tour covers the rich heritage of Lucena as a major city in Quezon Province — from its role during the Philippine Revolution to its present-day cultural identity. SK officers lead their fellow youth in reflection activities and community storytelling sessions after each tour.`,
    organizer: 'Sangguniang Kabataan Federation',
  },
  {
    id: '3',
    image: '/images/activities/palarong-pinoy.jpg',
    tag: 'Community Event',
    title: 'Palarong Pinoy — Car-Free Sunday',
    description: 'Celebrating Filipino traditional games every Car-Free Sunday on Quezon Avenue, in partnership with LYDO.',
    body: `Every Car-Free Sunday along Quezon Avenue, LYDO and the City Government of Lucena bring back the spirit of Filipino traditional games through Palarong Pinoy.

The event features beloved childhood games such as patintero, sipa, piko, tumbang preso, luksong tinik, and many more. Families, children, and youth from all barangays are welcome to join.

Palarong Pinoy serves as both a recreational and cultural preservation activity — keeping Filipino traditions alive while promoting physical activity, community bonding, and a sense of shared identity among Lucena youth.`,
    organizer: 'LYDO & City Government of Lucena',
  },
  {
    id: '4',
    image: '/images/activities/lydc-meeting-1.jpg',
    tag: 'LYDO Assembly',
    title: 'LYDC 4th Quarterly Meeting & LYORP General Assembly',
    description: 'City youth leaders gathered at Lucena City Government Complex for the quarterly LYDC meeting.',
    body: `The Lucena Youth Development Council (LYDC) holds quarterly meetings to assess the status of youth programs, discuss pressing concerns of Lucena youth, and align plans with the City Government.

The 4th Quarterly Meeting brought together SK chairpersons and federation officers from all 33 barangays of Lucena City, alongside representatives from registered youth organizations.

Key agenda items included the review of annual accomplishment reports, endorsement of new youth programs for the coming year, and the planning of the LYORP General Assembly. The meeting was presided over by the City Youth Development Officer and attended by the City Mayor's representative.`,
    organizer: 'Lucena Youth Development Council',
  },
  {
    id: '5',
    image: '/images/activities/lydc-meeting-2.jpg',
    tag: 'LYDO Assembly',
    title: 'LYORP General Assembly cum Logo Making Contest',
    description: 'Youth organizations across Lucena City converged for the LYORP General Assembly, fostering collaboration and youth governance.',
    body: `The Lucena Youth Organizations and Registered Programs (LYORP) General Assembly brought together youth organizations from across Lucena City for a day of collaboration, recognition, and creative expression.

Alongside the assembly proper — which covered updates on accreditation, compliance requirements, and upcoming city-wide youth programs — a Logo Making Contest was held to give youth artists the opportunity to design the official LYORP emblem.

The event highlighted the importance of unity among Lucena's diverse youth groups and reinforced their shared commitment to participatory governance and community service. Winning logo designs were recognized and will be used in official LYORP communications.`,
    organizer: 'Lucena Youth Development Council',
  },
]

export default function ProgramNewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const slide = PROGRAM_SLIDES.find(s => s.id === id)

  if (!slide) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-ink-500 mb-4">Program not found.</p>
        <Link to="/news-feed" className="btn-primary">Back to News</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-primary-700 transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Back to News
      </button>

      {/* Cover image */}
      <div className="relative w-full rounded-2xl overflow-hidden mb-8" style={{ aspectRatio: '16/9' }}>
        <img
          src={slide.image}
          alt={slide.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-ink-500">
        <span className="flex items-center gap-1.5 font-semibold text-primary-600">
          <Tag size={13} /> {slide.tag}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={13} /> {slide.organizer}
        </span>
      </div>

      {/* Title */}
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-ink-900 leading-tight mb-4">
        {slide.title}
      </h1>

      {/* Lead */}
      <p className="text-lg text-ink-600 leading-relaxed border-l-4 border-primary-400 pl-4 mb-8">
        {slide.description}
      </p>

      {/* Body */}
      <div className="prose prose-ink max-w-none space-y-4">
        {slide.body.split('\n\n').map((para, i) => (
          <p key={i} className="text-base text-ink-700 leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-10 pt-8 border-t border-ink-100">
        <Link to="/programs" className="btn-primary">
          View All Programs
        </Link>
      </div>
    </div>
  )
}
