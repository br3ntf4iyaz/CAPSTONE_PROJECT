import { cn } from '@/utils'

/** The three kinds of youth account, so LYDO reviews each group on its own and nothing is mixed up. */
export type AccountGroup = 'all' | 'general_youth' | 'youth_org_leader' | 'sk'

export const ACCOUNT_GROUPS: { key: AccountGroup; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'general_youth', label: 'General Youth' },
  { key: 'youth_org_leader', label: 'Youth Org Leaders' },
  { key: 'sk', label: 'SK Officials' },
]

/** An account with no type counts as general youth. */
export const groupOf = (t?: string | null): Exclude<AccountGroup, 'all'> => (t === 'sk' || t === 'youth_org_leader' ? t : 'general_youth')

export function inGroup(group: AccountGroup, t?: string | null) {
  return group === 'all' || groupOf(t) === group
}

export function AccountGroupTabs({ value, onChange, types }: { value: AccountGroup; onChange: (g: AccountGroup) => void; types: (string | null | undefined)[] }) {
  const count = (g: AccountGroup) => types.filter(t => inGroup(g, t)).length
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1" role="tablist" aria-label="Account type">
      {ACCOUNT_GROUPS.map(g => (
        <button key={g.key} type="button" role="tab" aria-selected={value === g.key} onClick={() => onChange(g.key)}
          className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', value === g.key ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-600 hover:text-ink-900')}>
          {g.label} <span className="ml-1 text-ink-400">{count(g.key)}</span>
        </button>
      ))}
    </div>
  )
}
