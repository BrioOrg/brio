import { z } from 'zod'

import { SharedBlock } from '@/components/blocs/shared-block'

/**
 * The palette of a Communauté message (ADR 0035 §3). Scratch is a `code` block. Anything else in a
 * stored body (a heading, an exercise, a future block type) is dropped here, whatever the server
 * accepted. The `id` is left out of the schema so that it never reaches the page: several messages
 * share a page, and a student's text must not choose a DOM id.
 */
export const blocCommunaute = z.discriminatedUnion('type', [
  z.object({ type: z.literal('prose'), text: z.string() }),
  z.object({
    type: z.literal('formula'),
    latex: z.string(),
    display: z.enum(['inline', 'block']).optional(),
  }),
  z.object({ type: z.literal('code'), code: z.string(), language: z.string().optional() }),
  z.object({ type: z.literal('list'), items: z.array(z.string()) }),
])

/**
 * The body of a question, answer or comment. The page imports KaTeX's stylesheet, like the chapter
 * and teacher layouts. The scroll box keeps a formula that pushes itself out
 * of its line (`\kern`, `\raisebox`) from drawing over the rest of the thread.
 */
export function BlocsCommunaute({ blocs }: { blocs: readonly unknown[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-auto overflow-y-hidden">
      {blocs.map((bloc, i) => {
        const parsed = blocCommunaute.safeParse(bloc)
        return parsed.success ? <SharedBlock key={i} block={parsed.data} /> : null
      })}
    </div>
  )
}
