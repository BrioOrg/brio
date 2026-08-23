export type RichTextToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'math'; value: string }

/**
 * Tokenizes a richText string into a flat array of typed spans.
 *
 * Markup supported: **bold**, *italic*, $...$  (inline LaTeX).
 * Escaping: \* emits a literal asterisk; \$ emits a literal dollar sign.
 * Unclosed delimiters are emitted literally, including the delimiter characters.
 *
 * Order of operations: math spans are extracted first so that * inside LaTeX
 * (e.g. $a * b$) is never consumed by the emphasis parser.
 *
 * Returns no JSX — callers supply the renderer (web, mobile, etc.).
 */
export function parseRichText(input: string): RichTextToken[] {
  if (input.length === 0) return []

  const segments = splitMathSegments(input)
  const tokens: RichTextToken[] = []

  for (const seg of segments) {
    if (seg.isMath) {
      tokens.push({ kind: 'math', value: seg.value })
    } else {
      for (const token of parseEmphasis(seg.value)) {
        tokens.push(token)
      }
    }
  }

  return mergeAdjacentText(tokens)
}

type Segment = { isMath: boolean; value: string }

function splitMathSegments(input: string): Segment[] {
  const segments: Segment[] = []
  let i = 0
  let text = ''

  while (i < input.length) {
    if (input[i] === '\\' && i + 1 < input.length && input[i + 1] === '$') {
      text += '$'
      i += 2
      continue
    }
    if (input[i] === '$') {
      const closeIdx = input.indexOf('$', i + 1)
      if (closeIdx !== -1) {
        if (text) {
          segments.push({ isMath: false, value: text })
          text = ''
        }
        segments.push({ isMath: true, value: input.slice(i + 1, closeIdx) })
        i = closeIdx + 1
      } else {
        text += '$'
        i++
      }
      continue
    }
    text += input[i]
    i++
  }

  if (text) segments.push({ isMath: false, value: text })
  return segments
}

function parseEmphasis(input: string): RichTextToken[] {
  const tokens: RichTextToken[] = []
  let i = 0
  let text = ''

  while (i < input.length) {
    if (input[i] === '\\' && i + 1 < input.length && input[i + 1] === '*') {
      text += '*'
      i += 2
      continue
    }
    if (input[i] === '*' && i + 1 < input.length && input[i + 1] === '*') {
      const closeIdx = input.indexOf('**', i + 2)
      if (closeIdx !== -1) {
        if (text) {
          tokens.push({ kind: 'text', value: text })
          text = ''
        }
        tokens.push({ kind: 'bold', value: input.slice(i + 2, closeIdx) })
        i = closeIdx + 2
      } else {
        text += '**'
        i += 2
      }
      continue
    }
    if (input[i] === '*') {
      const closeIdx = input.indexOf('*', i + 1)
      if (closeIdx !== -1) {
        if (text) {
          tokens.push({ kind: 'text', value: text })
          text = ''
        }
        tokens.push({ kind: 'italic', value: input.slice(i + 1, closeIdx) })
        i = closeIdx + 1
      } else {
        text += '*'
        i++
      }
      continue
    }
    text += input[i]
    i++
  }

  if (text) tokens.push({ kind: 'text', value: text })
  return tokens
}

function mergeAdjacentText(tokens: RichTextToken[]): RichTextToken[] {
  const result: RichTextToken[] = []
  for (const token of tokens) {
    const last = result[result.length - 1]
    if (token.kind === 'text' && last?.kind === 'text') {
      result[result.length - 1] = { kind: 'text', value: last.value + token.value }
    } else {
      result.push(token)
    }
  }
  return result
}
