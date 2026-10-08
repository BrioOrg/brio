import {
  buildScratchModel,
  type ScratchBlock,
  type ScratchCategory,
  type ScratchPart,
  type ScratchStatement,
} from '@brio/content'
import { Icon } from '@/components/ui/icon'

// Literal class names so Tailwind generates them (ADR 0031 §4).
const FILL: Record<ScratchCategory, string> = {
  events: 'bg-scratch-events border-scratch-events-edge',
  control: 'bg-scratch-control border-scratch-control-edge',
  motion: 'bg-scratch-motion border-scratch-motion-edge',
  looks: 'bg-scratch-looks border-scratch-looks-edge',
  sensing: 'bg-scratch-sensing border-scratch-sensing-edge',
  operators: 'bg-scratch-operators border-scratch-operators-edge',
  variables: 'bg-scratch-variables border-scratch-variables-edge',
}

const ICON = {
  flag: 'flag',
  'turn-right': 'arrow-clockwise',
  'turn-left': 'arrow-counter-clockwise',
}

const ROW = 'flex items-center gap-1.5 whitespace-nowrap border px-2 py-1.5'

/**
 * A Scratch programme drawn as blocks. The drawing is hidden from assistive technology; the
 * source text, which keeps the parentheses and the `fin` of each loop, is read instead (ADR 0031 §5).
 */
export function ScratchBlocks({
  id,
  code,
  script,
}: {
  id: string
  code: string
  script: ScratchStatement[]
}) {
  return (
    <figure
      id={id}
      aria-label="Programme Scratch"
      className="my-1 overflow-x-auto rounded-md border border-line bg-surface-raised p-4"
    >
      <div
        aria-hidden
        className="inline-flex flex-col font-display text-sm font-bold text-scratch-ink"
      >
        <Stack blocks={buildScratchModel(script)} />
      </div>
      <pre className="sr-only">{code}</pre>
    </figure>
  )
}

function Stack({ blocks }: { blocks: ScratchBlock[] }) {
  return (
    <div className="flex flex-col items-start">
      {blocks.map((block, i) => (
        <Block key={i} block={block} first={i === 0} />
      ))}
    </div>
  )
}

// Consecutive blocks overlap by their border width so the seam is a single line.
function Block({ block, first }: { block: ScratchBlock; first: boolean }) {
  const fill = FILL[block.category]
  const overlap = first ? '' : '-mt-px'

  if (block.shape === 'hat') {
    return (
      <div className={`${ROW} ${fill} ${overlap} rounded-t-xl rounded-b-xs pt-3`}>
        <Parts parts={block.parts} />
      </div>
    )
  }
  if (block.shape === 'stack') {
    return (
      <div className={`${ROW} ${fill} ${overlap} rounded-xs`}>
        <Parts parts={block.parts} />
      </div>
    )
  }
  // A C block: its header, an arm along the left of the inner blocks, and a foot. The arm is
  // drawn over the header's and the foot's borders, which leaves the C's inner edge only.
  return (
    <div className={`flex flex-col items-stretch ${overlap}`}>
      <div className={`${ROW} ${fill} self-start rounded-t-xs rounded-br-xs`}>
        <Parts parts={block.parts} />
      </div>
      <div className="flex">
        <div className={`${fill} relative z-10 -my-px w-4 shrink-0 border-x`} />
        <div className="py-px">
          <Stack blocks={block.body} />
        </div>
      </div>
      <div className={`${fill} h-4 rounded-b-xs rounded-tr-xs border`} />
    </div>
  )
}

function Parts({ parts }: { parts: ScratchPart[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <Part key={i} part={part} />
      ))}
    </>
  )
}

function Part({ part }: { part: ScratchPart }) {
  switch (part.kind) {
    case 'label':
      return <span>{part.text}</span>
    case 'icon':
      return <Icon name={ICON[part.icon]} weight="bold" size={16} className="shrink-0" />
    case 'input':
      return (
        <span className="min-w-6 rounded-pill bg-scratch-slot px-2 py-0.5 text-center font-semibold">
          {part.text}
        </span>
      )
    case 'dropdown':
      return (
        <span className={`${FILL.variables} rounded-xs border px-1.5 py-0.5`}>{part.text} ▾</span>
      )
    case 'reporter':
      return (
        <span
          className={`${FILL[part.category]} flex items-center gap-1 rounded-pill border px-2 py-0.5`}
        >
          <Parts parts={part.parts} />
        </span>
      )
  }
}
