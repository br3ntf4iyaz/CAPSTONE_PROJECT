import { Link } from 'react-router-dom'
import { ArrowRight, Users, ClipboardList } from 'lucide-react'
import type { PublicSurvey } from './types'

export function SurveysSection({ surveys, isLoading, gated }: { surveys?: PublicSurvey[]; isLoading: boolean; gated: (dest: string) => () => void }) {
  // ── Surveys ──────────────────────────────────────────────────────
  return (
    <section id="participate" className="bg-white border-y border-ink-100 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="eyebrow mb-3">Participate</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2">
              Active surveys from LYDO.
            </h2>
            <p className="text-ink-600 mt-2 max-w-lg">
              Read what's being asked — sign in to submit your response.
            </p>
          </div>
          <button
            onClick={gated('/surveys')}
            className="btn-secondary self-start sm:self-end whitespace-nowrap"
          >
            All surveys <ArrowRight size={16} />
          </button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-ink-100/50 animate-pulse" />)}
          </div>
        ) : surveys && surveys.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {surveys.map(survey => (
              <div key={survey.id} className="bg-paper-50 hover:bg-white border border-ink-100 hover:border-primary-200 hover:shadow-md rounded-2xl p-6 transition-all group flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <ClipboardList size={18} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-ink-900 leading-snug group-hover:text-primary-700 transition-colors">
                      {survey.title}
                    </h3>
                    {survey.description && (
                      <p className="text-xs text-ink-500 mt-1 line-clamp-2">{survey.description}</p>
                    )}
                  </div>
                </div>

                {/* Preview first 2 questions */}
                {survey.questions.length > 0 && (
                  <ol className="space-y-1.5 pl-0">
                    {survey.questions.slice(0, 2).map((q, qi) => (
                      <li key={q.id} className="flex items-start gap-2 text-xs text-ink-600">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-[9px] mt-0.5">
                          {qi + 1}
                        </span>
                        <span className="line-clamp-1">{q.question}</span>
                      </li>
                    ))}
                    {survey.questions.length > 2 && (
                      <li className="text-[11px] text-ink-400 pl-6">
                        +{survey.questions.length - 2} more question{survey.questions.length - 2 !== 1 ? 's' : ''}
                      </li>
                    )}
                  </ol>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink-100">
                  <div className="flex items-center gap-3 text-xs text-ink-400">
                    <span>{survey.questions.length} questions</span>
                    <span className="flex items-center gap-1"><Users size={10} /> {survey.response_count}</span>
                  </div>
                  <Link
                    to={`/surveys/${survey.id}`}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-0.5 transition-colors"
                  >
                    See questions <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-paper-50 rounded-2xl border border-ink-100 p-10 text-center">
            <ClipboardList size={36} className="text-ink-300 mx-auto mb-3" />
            <p className="text-ink-500 text-sm">No active surveys right now — check back soon.</p>
          </div>
        )}
      </div>
    </section>
  )
}
