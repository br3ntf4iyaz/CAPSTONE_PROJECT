import type { ReactNode } from 'react'

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p) || /^__[^_]+__$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-black/5 px-1 text-[0.85em]">{p.slice(1, -1)}</code>
    return p
  })
}

type ListKind = 'ul' | 'ol'

/** Small, safe markdown renderer for chatbot replies: headings, bullet and numbered lists, bold, italics. */
export function ChatMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
  let items: ReactNode[] = []
  let kind: ListKind | null = null

  const flush = () => {
    if (!items.length || !kind) return
    const Tag = kind
    out.push(
      <Tag
        key={out.length}
        className={`${kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1 my-1.5 marker:text-current`}
      >
        {items}
      </Tag>,
    )
    items = []
    kind = null
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (h) {
      flush()
      out.push(<p key={i} className="font-semibold mt-2 first:mt-0">{inline(h[2])}</p>)
    } else if (ul || ol) {
      const k: ListKind = ul ? 'ul' : 'ol'
      if (kind && kind !== k) flush()
      kind = k
      items.push(<li key={i} className="pl-0.5">{inline((ul ?? ol)![1])}</li>)
    } else if (!line.trim()) {
      flush()
    } else {
      flush()
      out.push(<p key={i} className="mt-1.5 first:mt-0">{inline(line.trim())}</p>)
    }
  })
  flush()

  return <div className="break-words [overflow-wrap:anywhere] text-left">{out}</div>
}
