import { ClipboardList, MessageSquare, BarChart3 } from 'lucide-react'
import HubShell, { type HubItem } from './_HubShell'

const ITEMS: HubItem[] = [
  {
    title: 'Surveys',
    description: 'Tell LYDO what young Lucenahins actually need. Your responses shape next year\'s programs.',
    icon: ClipboardList,
    to: '/surveys',
    accent: 'primary',
  },
  {
    title: 'Feedback',
    description: 'Send direct feedback on programs, events, or the portal itself. We read every submission.',
    icon: MessageSquare,
    to: '/feedback',
    accent: 'accent',
  },
  {
    title: 'Polls',
    description: 'Quick yes/no questions about live LYDO decisions — make your stance heard in seconds.',
    icon: BarChart3,
    to: '/polls',
    accent: 'neutral',
  },
]

export default function ParticipateHubPage() {
  return (
    <HubShell
      eyebrow="Share Your Insights"
      title="Your seat at the table."
      description="LYDO programs are built with youth input. Surveys, feedback, and polls are how we listen — and how you push for what matters."
      items={ITEMS}
    />
  )
}
