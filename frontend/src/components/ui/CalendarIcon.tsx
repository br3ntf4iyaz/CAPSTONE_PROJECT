/** A flat tear-off calendar (red header with the month, big day on white) for the given date, on a turquoise tile the same size as the hub icon tiles. */
export default function CalendarIcon({ date, className = 'hidden sm:flex' }: { date: Date; className?: string }) {
  const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase()
  const day = date.getDate()
  return (
    <span className={`${className} shrink-0 items-center justify-center w-14 h-14 rounded-2xl bg-[#4dd0d4] shadow-md shadow-[#1d8f93]/30`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label={`${month} ${day}`} xmlns="http://www.w3.org/2000/svg">
        {/* soft shadow of the page on the tile */}
        <rect x="21" y="27" width="64" height="62" rx="5" fill="#0b6f73" opacity="0.35" />
        {/* white page */}
        <rect x="18" y="22" width="64" height="62" rx="5" fill="#ffffff" />
        {/* red header with the month */}
        <path d="M18 27a5 5 0 0 1 5-5h54a5 5 0 0 1 5 5v18H18z" fill="#ff5252" />
        <text x="50" y="40" textAnchor="middle" fontSize={month.length > 7 ? 9.5 : month.length > 5 ? 11.5 : 13} fontWeight="800" fill="#ffffff" fontFamily="inherit">{month}</text>
        {/* the two rings */}
        <circle cx="31" cy="23" r="3.2" fill="#ffffff" />
        <circle cx="69" cy="23" r="3.2" fill="#ffffff" />
        <rect x="28" y="10" width="6" height="17" rx="3" fill="#3f5156" />
        <rect x="66" y="10" width="6" height="17" rx="3" fill="#3f5156" />
        {/* the day */}
        <text x="50" y="76" textAnchor="middle" fontSize="30" fontWeight="800" fill="#3f5156" fontFamily="inherit">{day}</text>
      </svg>
    </span>
  )
}
