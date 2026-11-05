import { parseScratch } from '@brio/content'

import { RichTextRenderer } from '@/components/blocs/rich-text'
import { ScratchBlocks } from '@/components/scratch-blocks'
import { renderKatex } from '@/lib/katex'

/**
 * The blocks courses and Communauté messages have in common (ADR 0035 §2). This module stays free
 * of exercises, figures and charts, so that a message does not ship them to the browser.
 *
 * `id` is optional: a course anchors its blocks, a message must not put a student's text in a DOM id.
 */
export function SharedBlock({
  id,
  block,
}: {
  id?: string
  block: { type: string; [key: string]: unknown }
}) {
  switch (block.type) {
    case 'prose':
      return (
        <p id={id} className="font-prose text-base leading-relaxed text-ink">
          <RichTextRenderer text={block.text as string} />
        </p>
      )

    case 'formula': {
      const displayMode = (block.display as string) !== 'inline'
      const html = renderKatex(block.latex as string, displayMode)
      // No code-block chrome: the formula sits directly on the page ground.
      return displayMode ? (
        <div
          id={id}
          className="overflow-x-auto py-1 text-center text-ink"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span id={id} dangerouslySetInnerHTML={{ __html: html }} />
      )
    }

    case 'code': {
      // A Scratch programme that does not parse (a teacher's course skips CI) stays as text.
      const scratch = block.language === 'scratch' ? parseScratch(block.code as string) : null
      if (scratch?.ok) {
        return <ScratchBlocks id={id} code={block.code as string} script={scratch.script} />
      }
      return (
        <pre
          id={id}
          className="overflow-x-auto rounded-md border border-line bg-surface-raised p-4 font-mono text-sm text-ink"
        >
          <code>{block.code as string}</code>
        </pre>
      )
    }

    case 'list': {
      const items = (Array.isArray(block.items) ? block.items : []).filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
      if (items.length === 0) return null
      return (
        <ul
          id={id}
          className="list-disc space-y-1.5 pl-6 font-prose text-base leading-relaxed text-ink marker:text-ink-muted"
        >
          {items.map((item, i) => (
            <li key={i}>
              <RichTextRenderer text={item} />
            </li>
          ))}
        </ul>
      )
    }

    default:
      return null
  }
}
