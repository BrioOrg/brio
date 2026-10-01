'use client'

import * as Tooltip from '@radix-ui/react-tooltip'

/**
 * Shared hover/focus state for the infobulles below it: once one has opened, moving to a
 * neighbour opens the next one without waiting for the delay again.
 */
export function InfobulleProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>
}

type InfobulleProps = {
  label: string
  /** A single focusable element (usually a button) that receives the trigger props. */
  children: React.ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * Names an icon-only control on hover and keyboard focus. Not shown on touch: the control
 * must still carry its own aria-label, the infobulle is a visual aid only.
 */
export function Infobulle({ label, children, side = 'top' }: InfobulleProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      {/* No Portal: the content must inherit a locally forced data-theme (the course editor is
          always light). Radix positions it as `fixed`, so overflow containers do not clip it. */}
      <Tooltip.Content
        side={side}
        sideOffset={6}
        collisionPadding={8}
        className="z-50 rounded-sm border border-line bg-surface-panel px-2 py-1 font-display text-xs font-extrabold text-ink"
      >
        {label}
      </Tooltip.Content>
    </Tooltip.Root>
  )
}
