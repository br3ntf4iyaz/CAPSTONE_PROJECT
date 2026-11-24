/**
 * Philippine national holidays that fall on the same date every year, plus Holy Week, which follows Easter.
 * Holidays that are proclaimed afresh each year and follow the lunar calendar (Chinese New Year, Eid'l Fitr, Eid'l Adha)
 * and one-off declarations are NOT included, because their dates cannot be worked out reliably.
 */
export type HolidayKind = 'regular' | 'special' | 'working'
export interface Holiday { name: string; kind: HolidayKind }

export const HOLIDAY_KIND_LABEL: Record<HolidayKind, string> = {
  regular: 'Regular holiday',
  special: 'Special non-working day',
  working: 'Special working day',
}

/** Easter Sunday of a year (the usual Gregorian computation). */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const key = (m: number, d: number) => `${m}-${d}`
const cache = new Map<number, Map<string, Holiday>>()

export function holidaysOfYear(year: number): Map<string, Holiday> {
  const hit = cache.get(year)
  if (hit) return hit
  const map = new Map<string, Holiday>()
  const add = (m: number, d: number, name: string, kind: HolidayKind) => map.set(key(m, d), { name, kind })

  add(1, 1, "New Year's Day", 'regular')
  add(2, 25, 'EDSA People Power Anniversary', 'working')
  add(4, 9, 'Araw ng Kagitingan (Day of Valor)', 'regular')
  add(5, 1, 'Labor Day', 'regular')
  add(6, 12, 'Independence Day', 'regular')
  add(8, 21, 'Ninoy Aquino Day', 'special')
  add(11, 1, "All Saints' Day", 'special')
  add(11, 30, 'Bonifacio Day', 'regular')
  add(12, 8, 'Feast of the Immaculate Conception of Mary', 'special')
  add(12, 24, 'Christmas Eve', 'special')
  add(12, 25, 'Christmas Day', 'regular')
  add(12, 30, 'Rizal Day', 'regular')
  add(12, 31, "New Year's Eve", 'special')

  // National Heroes Day: the last Monday of August
  const lastDay = new Date(year, 7, 31)
  const monday = 31 - ((lastDay.getDay() + 6) % 7)
  add(8, monday, 'National Heroes Day', 'regular')

  // Holy Week
  const e = easter(year)
  const off = (days: number) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + days)
  const hw: [number, string, HolidayKind][] = [[-3, 'Maundy Thursday', 'regular'], [-2, 'Good Friday', 'regular'], [-1, 'Black Saturday', 'special']]
  for (const [n, name, kind] of hw) { const d = off(n); add(d.getMonth() + 1, d.getDate(), name, kind) }

  cache.set(year, map)
  return map
}

export function holidayOn(year: number, month0: number, day: number): Holiday | undefined {
  return holidaysOfYear(year).get(key(month0 + 1, day))
}
