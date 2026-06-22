import { BookOpen, Award, GraduationCap } from 'lucide-react'
import HubShell, { type HubItem } from './_HubShell'

const ITEMS: HubItem[] = [
  {
    title: 'Courses',
    description: 'Self-paced learning modules built for Lucena youth \u2014 leadership, livelihood, civic skills, and more.',
    icon: BookOpen,
    to: '/lms',
    accent: 'primary',
  },
  {
    title: 'Badges',
    description: 'Earn recognition badges as you complete programs, courses, and community contributions.',
    icon: Award,
    to: '/badges',
    accent: 'accent',
  },
  {
    title: 'Certifications',
    description: 'Download official certificates for completed courses and verified accomplishments.',
    icon: GraduationCap,
    to: '/certificates',
    accent: 'neutral',
  },
]

export default function LearnHubPage() {
  return (
    <HubShell
      eyebrow="Learn"
      title="Skills, badges, and certificates."
      description="Grow on your own pace. Whether you're prepping for college, building a livelihood, or stepping into youth leadership \u2014 start here."
      items={ITEMS}
    />
  )
}
