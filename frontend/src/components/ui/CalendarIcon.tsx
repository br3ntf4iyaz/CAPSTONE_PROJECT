/** A flat tear-off calendar (red top, two rings, month and day) that shows the given date. No background, just the calendar. */
export default function CalendarIcon({ date, className = 'hidden sm:flex' }: { date: Date; className?: string }) {
  const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase()
  const day = date.getDate()
  return (
    <span className={`${className} shrink-0 items-center justify-center w-14 h-14 rounded-2xl bg-[#e8e8e8] shadow-md`}>
    <svg viewBox="0 0 100 100" className="w-full h-full p-1" role="img" aria-label={`${month} ${day}`} xmlns="http://www.w3.org/2000/svg">
      {/* white page with a soft shadow */}
      <rect x="9" y="17" width="82" height="76" rx="13" fill="#000" opacity="0.08" transform="translate(0 2)" />
      <rect x="9" y="17" width="82" height="76" rx="13" fill="#ffffff" />
      {/* red header */}
      <path d="M9 30a13 13 0 0 1 13-13h56a13 13 0 0 1 13 13v14H9z" fill="#f04438" />
      {/* the two rings */}
      <rect x="27" y="7" width="8" height="22" rx="4" fill="#3f5156" />
      <rect x="65" y="7" width="8" height="22" rx="4" fill="#3f5156" />
      <circle cx="31" cy="31" r="5.2" fill="none" stroke="#ffffff" strokeWidth="2.4" />
      <circle cx="69" cy="31" r="5.2" fill="none" stroke="#ffffff" strokeWidth="2.4" />
      <rect x="27" y="7" width="8" height="22" rx="4" fill="#3f5156" />
      <rect x="65" y="7" width="8" height="22" rx="4" fill="#3f5156" />
      {/* month and day */}
      <text x="50" y="62" textAnchor="middle" fontSize={month.length > 7 ? 11.5 : month.length > 5 ? 15 : 17} fontWeight="700" fill="#3f5156" fontFamily="inherit">{month}</text>
      <text x="50" y="89" textAnchor="middle" fontSize="30" fontWeight="800" fill="#3f5156" fontFamily="inherit">{day}</text>
    </svg>
    </span>
  )
}
