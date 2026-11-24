import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Briefcase, ClipboardCheck, GraduationCap } from 'lucide-react'
import { cn } from '@/utils'
import AdminApplicationsPage from './AdminApplicationsPage'
import AdminScholarshipApplicationsPage from './AdminScholarshipApplicationsPage'

type Tab = 'jobs' | 'scholarships'

/** One place for everything young people apply for. It only shows the two existing lists as tabs: nothing about how people apply or how applications are stored changes. */
export default function AdminApplicationsHubPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'scholarships' ? 'scholarships' : 'jobs'
  const counts = useQueryClient().getQueryData<Record<string, number>>(['admin-nav-counts']) ?? {}
  const tabs: { key: Tab; label: string; icon: typeof Briefcase; badge: number }[] = [
    { key: 'jobs', label: 'Job applications', icon: Briefcase, badge: counts['/admin/applications:jobs'] ?? 0 },
    { key: 'scholarships', label: 'Scholarship applications', icon: GraduationCap, badge: counts['/admin/applications:scholarships'] ?? 0 },
  ]
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ClipboardCheck size={22} className="text-primary-700" /> Applications</h1>
        <p className="mt-1 text-sm text-gray-500">Everything young people have applied for. The jobs and scholarships themselves are managed in Jobs, Scholarships &amp; Schools.</p>
      </div>
      <div className="flex gap-2" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setParams(t.key === 'jobs' ? {} : { tab: t.key }, { replace: true })}
            className={cn('inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold',
              tab === t.key ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300')}>
            <t.icon size={15} /> {t.label}
            {t.badge > 0 && <span className={cn('rounded-full px-1.5 text-[11px] font-bold', tab === t.key ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700')}>{t.badge}</span>}
          </button>
        ))}
      </div>
      {tab === 'jobs' ? <AdminApplicationsPage embedded /> : <AdminScholarshipApplicationsPage embedded />}
    </div>
  )
}
