/**
 * Reads the text on the front of an ID, on the user's own device (tesseract.js, files served from
 * /ocr, nothing is uploaded for this step), then compares it with the account.
 */

export interface OcrSummary {
  ran: boolean
  confidence?: number
  name_score?: number
  keyword_found?: boolean
  id_number_found?: boolean
  id_number?: string
  expiry_date?: string
  expired?: boolean
  text?: string
}

const TYPE_KEYWORDS: Record<string, string[]> = {
  national_id: ['PHILIPPINE IDENTIFICATION', 'PHILSYS', 'PAMBANSANG', 'NATIONAL ID', 'PHILID'],
  drivers_license: ['DRIVER', 'LICENSE', 'LICENCE', 'LAND TRANSPORTATION', 'LTO'],
  passport: ['PASSPORT', 'PASAPORTE', 'P<PHL'],
  sss: ['SOCIAL SECURITY', 'SSS'],
  umid: ['UMID', 'UNIFIED MULTI', 'SOCIAL SECURITY', 'GSIS', 'PHILHEALTH', 'PAG-IBIG', 'PAGIBIG'],
  school_id: ['UNIVERSITY', 'COLLEGE', 'SCHOOL', 'STUDENT', 'INSTITUTE', 'ACADEMY', 'PAARALAN'],
  barangay_id: ['BARANGAY', 'BRGY'],
  voters_id: ['VOTER', 'COMELEC', 'COMMISSION ON ELECTIONS'],
  philhealth: ['PHILHEALTH', 'PHILIPPINE HEALTH'],
  postal: ['POSTAL', 'PHLPOST'],
  prc: ['PROFESSIONAL REGULATION', 'PRC'],
  other_gov: ['REPUBLIC', 'REPUBLIKA', 'PHILIPPINES', 'GOVERNMENT'],
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
}

/** Uppercase, no accents (Ñ -> N), single spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9<\-/.,\n ]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let diff = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++diff > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return diff + (a.length - i) + (b.length - j) <= 1
}

/** Share of the account's name parts that appear on the ID (one typo allowed in longer words). */
export function nameScore(text: string, firstName: string, lastName: string): number {
  const SKIP = new Set(['JR', 'SR', 'II', 'III', 'IV', 'DE', 'DELA', 'DEL', 'LOS', 'LAS'])
  const parts = normalize(`${firstName} ${lastName}`)
    .split(/[\s\-.,]+/)
    .filter(p => p.length >= 2 && !SKIP.has(p))
  if (parts.length === 0) return 0
  const words = normalize(text).split(/[\s,.:;/]+/).filter(Boolean)
  const joined = normalize(text).replace(/\s+/g, ' ')
  let hit = 0
  for (const p of parts) {
    const found = joined.includes(p) || (p.length >= 5 && words.some(w => editDistanceAtMost1(w, p)))
    if (found) hit++
  }
  return hit / parts.length
}

export function findIdNumber(text: string): string | undefined {
  const cands = normalize(text).match(/[A-Z0-9][A-Z0-9\- ]{6,22}[A-Z0-9]/g) ?? []
  const found = cands
    .map(c => c.trim())
    .find(c => (c.match(/\d/g)?.length ?? 0) >= 6 && !/^\d{4}-\d{2}-\d{2}$/.test(c) && !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(c))
  if (!found) return undefined
  // drop the label in front of the number ("LICENSE NO N01-23-456789" -> "N01-23-456789")
  const tokens = found.split(' ')
  const first = tokens.findIndex(t => /\d/.test(t))
  return tokens.slice(Math.max(0, first)).join(' ')
}

function toISO(y: number, m: number, d: number): string | undefined {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Date written near words like EXPIRY / VALID UNTIL. */
export function findExpiry(text: string): string | undefined {
  const t = normalize(text)
  const lines = t.split('\n')
  const keyRe = /EXPIR|VALID UNTIL|VALIDITY|VALID THRU|VALID TO/
  for (let i = 0; i < lines.length; i++) {
    if (!keyRe.test(lines[i])) continue
    const chunk = `${lines[i]} ${lines[i + 1] ?? ''}`
    let m = chunk.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (m) { const r = toISO(+m[1], +m[2], +m[3]); if (r) return r }
    m = chunk.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
    if (m) { const r = toISO(+m[3], +m[1], +m[2]) ?? toISO(+m[3], +m[2], +m[1]); if (r) return r }
    m = chunk.match(/([A-Z]{3,9})\.? (\d{1,2}),? (\d{4})/)
    if (m && MONTHS[m[1]]) { const r = toISO(+m[3], MONTHS[m[1]], +m[2]); if (r) return r }
    m = chunk.match(/(\d{1,2}) ([A-Z]{3,9}),? (\d{4})/)
    if (m && MONTHS[m[2]]) { const r = toISO(+m[3], MONTHS[m[2]], +m[1]); if (r) return r }
  }
  return undefined
}

/** Compare raw OCR text with the account and the chosen ID type. Pure function (easy to test). */
export function summarize(text: string, opts: { firstName: string; lastName: string; idType: string; confidence?: number; today?: Date }): OcrSummary {
  const t = normalize(text)
  const keywords = TYPE_KEYWORDS[opts.idType] ?? TYPE_KEYWORDS.other_gov
  const keyword_found = keywords.some(k => t.includes(k)) || t.includes('REPUBLIC OF THE PHILIPPINES') || t.includes('REPUBLIKA NG PILIPINAS')
  const id_number = findIdNumber(text)
  const expiry_date = findExpiry(text)
  const today = (opts.today ?? new Date()).toISOString().slice(0, 10)
  return {
    ran: true,
    confidence: opts.confidence !== undefined ? Math.max(0, Math.min(1, opts.confidence / 100)) : undefined,
    name_score: nameScore(text, opts.firstName, opts.lastName),
    keyword_found,
    id_number_found: !!id_number,
    id_number,
    expiry_date,
    expired: expiry_date ? expiry_date < today : false,
    text: t.replace(/\n+/g, ' | ').slice(0, 1500),
  }
}

/** Run OCR on the captured ID front. Resolves {ran:false} if it cannot run (the admin then reviews). */
export async function readIdFront(
  file: File,
  opts: { firstName: string; lastName: string; idType: string },
  onProgress?: (pct: number) => void,
): Promise<OcrSummary> {
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr',
      langPath: '/ocr',
      gzip: true,
      logger: m => { if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100)) },
    })
    const { data } = await worker.recognize(file)
    await worker.terminate()
    if (!data.text || data.text.trim().length < 15) return { ran: false }
    return summarize(data.text, { ...opts, confidence: data.confidence })
  } catch {
    return { ran: false }
  }
}
