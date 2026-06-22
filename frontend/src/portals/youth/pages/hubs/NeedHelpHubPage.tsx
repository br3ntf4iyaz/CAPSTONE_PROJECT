import { MessageCircle, LifeBuoy, Mail } from 'lucide-react'
import HubShell, { type HubItem } from './_HubShell'

const ITEMS: HubItem[] = [
  {
    title: 'AI Assistant',
    description: 'Ask anything \u2014 youth rights, programs, scholarships, FAQs, local services. Answers powered by AI.',
    icon: MessageCircle,
    to: '/chatbot',
    accent: 'primary',
  },
  {
    title: 'Contact Support',
    description: 'Stuck on something? Open a support ticket and a LYDO staffer will get back to you.',
    icon: LifeBuoy,
    badge: 'Coming soon',
    accent: 'neutral',
  },
  {
    title: 'Email LYDO directly',
    description: 'For sensitive concerns or partnerships, reach the office at lydo@lucenacity.gov.ph.',
    icon: Mail,
    to: 'mailto:lydo@lucenacity.gov.ph',
    external: true,
    accent: 'neutral',
  },
]

export default function NeedHelpHubPage() {
  return (
    <HubShell
      eyebrow="Need help?"
      title="We've got you covered."
      description="Whatever the question \u2014 from how to register to what's a YORP \u2014 there's a way to get an answer here."
      items={ITEMS}
    />
  )
}
