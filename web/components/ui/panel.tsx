type PanelProps = {
  raised?: boolean
  className?: string
  children: React.ReactNode
}

export function Panel({ raised = false, className = '', children }: PanelProps) {
  return (
    <div
      className={[
        'rounded-lg border border-line p-4',
        raised ? 'bg-surface-raised' : 'bg-surface-panel',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
