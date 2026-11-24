import { Link } from 'react-router-dom'
import { openCookieSettings } from '@/lib/consent'
import { cn } from '@/utils'

/** The policy links shown in footers and on the sign-in and registration pages. They are public: no sign-in needed. */
export default function PolicyLinks({ className, linkClassName, disclosure = false }: { className?: string; linkClassName?: string; disclosure?: boolean }) {
  const cls = cn('underline-offset-2 hover:underline', linkClassName)
  return (
    <nav aria-label="Policies" className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      <Link to="/terms" className={cls}>Terms of Use</Link>
      <Link to="/privacy" className={cls}>Privacy Policy</Link>
      <Link to="/cookies" className={cls}>Cookie Policy</Link>
      {disclosure && <Link to="/transparency" className={cls}>Public Disclosure</Link>}
      <button type="button" onClick={openCookieSettings} className={cls}>Cookie settings</button>
    </nav>
  )
}
