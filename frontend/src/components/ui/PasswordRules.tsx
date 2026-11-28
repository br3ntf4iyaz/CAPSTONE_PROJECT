import { Check } from 'lucide-react'
import { cn } from '@/utils'

/** The rules of a password, the same four the server checks. */
export const PASSWORD_RULES = [
  { key: 'length', text: 'Password must be min 8 characters', ok: (p: string) => p.length >= 8 },
  { key: 'number', text: 'Include one number', ok: (p: string) => /\d/.test(p) },
  { key: 'case', text: 'Include upper and lower case characters', ok: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'special', text: 'Include one special character (like @ or !)', ok: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
]

export const passwordMeetsRules = (p: string) => PASSWORD_RULES.every(r => r.ok(p))

/** A list shown under the password field from the start, so people know what to type. Each rule turns green with a check when it is met. */
export default function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-2.5 space-y-1.5" aria-label="Password rules">
      {PASSWORD_RULES.map(r => {
        const met = r.ok(value)
        return (
          <li key={r.key} className="flex items-center gap-2 text-xs">
            <span className={cn('inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors',
              met ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink-300 bg-white text-transparent')} aria-hidden>
              <Check size={10} strokeWidth={3} />
            </span>
            <span className={met ? 'text-ink-800' : 'text-ink-500'}>
              {r.text}
              <span className="sr-only">{met ? ' (done)' : ' (not yet)'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
