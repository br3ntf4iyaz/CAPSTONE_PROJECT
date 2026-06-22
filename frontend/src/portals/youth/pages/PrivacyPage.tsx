import { Link } from 'react-router-dom'
import { Sparkles, ShieldCheck } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      <div className="ph-stripe h-1 w-full" />

      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white">
              <Sparkles size={18} strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent-400 border-2 border-white" />
            </span>
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
              <ShieldCheck size={20} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Legal</p>
              <h1 className="font-display font-extrabold text-2xl text-ink-900">Privacy Policy</h1>
            </div>
          </div>
          <p className="text-sm text-ink-500 mb-8">Last updated: June 2026</p>

          <div className="prose prose-ink max-w-none space-y-6 text-ink-700 leading-relaxed">
            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">1. Information We Collect</h2>
              <p>When you register, we collect your name, email address, barangay, and youth type. When you use the platform, we may collect participation records, survey responses, and uploaded documents (such as government IDs for identity verification).</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">2. How We Use Your Information</h2>
              <p>Your information is used to provide and improve platform services, deliver program announcements relevant to your barangay, generate anonymised statistics for LYDO planning purposes, and facilitate SK compliance tracking where applicable.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">3. Data Sharing</h2>
              <p>We do not sell your personal data. Information may be shared with Lucena City government offices strictly for youth development purposes. We do not share your information with commercial third parties.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">4. Data Retention</h2>
              <p>We retain your account data for as long as your account is active. You may request deletion of your account and associated data by contacting LYDO directly.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">5. Security</h2>
              <p>We take reasonable measures to protect your personal information. Passwords are stored securely using industry-standard hashing. We use HTTPS for all data transmissions.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">6. Your Rights</h2>
              <p>Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the right to access, correct, and object to the processing of your personal information. To exercise these rights, contact us at <a href="mailto:lydo@lucena.gov.ph" className="text-primary-700 underline">lydo@lucena.gov.ph</a>.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">7. Changes to This Policy</h2>
              <p>We may update this privacy policy from time to time. Material changes will be communicated via email or platform notification. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
