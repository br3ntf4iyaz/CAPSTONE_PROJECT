/** A flat graduation cap (navy mortarboard, yellow tassel) in the LYDOP colours. Used as the school badge. */
export default function GradCapIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Graduation cap" xmlns="http://www.w3.org/2000/svg">
      {/* the cap under the board */}
      <path d="M15 30 V43 C15 49.5 22.5 53 32 53 C41.5 53 49 49.5 49 43 V30 L32 37 Z" fill="#0f2747" />
      <path d="M15 30 L32 37 L49 30" fill="none" stroke="#173a66" strokeWidth="1.6" strokeLinejoin="round" />
      {/* the board */}
      <polygon points="32,9 60,21.5 32,34 4,21.5" fill="#152f55" />
      <polygon points="32,9 60,21.5 32,34" fill="#1c4072" />
      {/* the tassel */}
      <path d="M32 21.5 L10.5 27.5 V41" fill="none" stroke="#fcd116" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="21.5" r="3" fill="#fcd116" />
      <path d="M7.5 41 H13.5 L14.5 51 H6.5 Z" fill="#fcd116" />
      <path d="M8.8 43 V50 M10.5 43 V50.5 M12.2 43 V50" stroke="#e6bd0d" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  )
}
