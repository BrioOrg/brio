import { parseRichText, type RichTextToken } from '@brio/content'

import { renderKatex } from '@/lib/katex'

export function RichTextRenderer({ text }: { text: string }) {
  const tokens = parseRichText(text)
  return (
    <>
      {tokens.map((token, i) => (
        <RichTextSpan key={i} token={token} />
      ))}
    </>
  )
}

function RichTextSpan({ token }: { token: RichTextToken }) {
  switch (token.kind) {
    case 'text':
      return <>{token.value}</>
    case 'bold':
      return <strong className="font-bold text-ink">{token.value}</strong>
    case 'italic':
      return <em>{token.value}</em>
    case 'highlight':
      return (
        <mark className="rounded-xs bg-warning/25 px-0.5 text-ink box-decoration-clone">
          {token.value}
        </mark>
      )
    case 'math': {
      const html = renderKatex(token.value, false)
      return <span dangerouslySetInnerHTML={{ __html: html }} />
    }
  }
}
