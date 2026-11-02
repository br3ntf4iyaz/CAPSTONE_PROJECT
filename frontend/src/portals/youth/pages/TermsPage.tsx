import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      <div className="ph-stripe h-1 w-full" />

      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <LydoLogo size={36} />
            <span className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
            </span>
          </Link>
          <Link to="/register" className="text-sm font-semibold text-ink-600 hover:text-primary-700 transition-colors">
            ← Back to register
          </Link>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <div className="bg-white rounded-2xl border border-ink-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Scale size={20} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Legal</p>
              <h1 className="font-display font-extrabold text-2xl text-ink-900">Terms and Conditions</h1>
            </div>
          </div>
          <p className="text-sm text-ink-500 mb-8">Last updated: June 2026</p>

          <div className="prose prose-ink max-w-none space-y-6 text-ink-700 leading-relaxed">
            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">1. Acceptance of Terms</h2>
              <p>By creating an account on the Lucena Youth Leadership Hub ("LYDO Platform"), you agree to be bound by these terms and conditions. If you do not agree, please do not use this platform.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">2. Eligibility</h2>
              <p>This platform is intended for youth residents of Lucena City aged 15–30 years old, as well as Sangguniang Kabataan officials and youth organization leaders operating within the city.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">3. User Responsibilities</h2>
              <p>You agree to provide accurate, truthful information when registering and using the platform. You are responsible for maintaining the confidentiality of your account credentials. You agree not to misuse or abuse platform features.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">4. Data Use</h2>
              <p>Information collected through this platform is used solely for youth development purposes by the Lucena City Youth Development Office (LYDO). Your data will not be sold to third parties. Please see our <Link to="/privacy" className="text-primary-700 underline">Privacy Policy</Link> for full details.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">5. Platform Availability</h2>
              <p>The LYDO Platform is provided as a free service to Lucena youth. We reserve the right to modify, suspend, or discontinue any feature or the platform as a whole without prior notice.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">6. Contact</h2>
              <p>For questions about these terms, please contact us at <a href="mailto:lydo@lucena.gov.ph" className="text-primary-700 underline">lydo@lucena.gov.ph</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
