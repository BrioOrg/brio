type SkeletonProps = {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'pill'
}

const ROUNDED = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  pill: 'rounded-pill',
}

export function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'bg-surface-raised',
        // Static pulse under reduced-motion; travelling shimmer otherwise
        'motion-safe:animate-pulse',
        ROUNDED[rounded],
        className,
      ].join(' ')}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={['flex flex-col gap-2', className].join(' ')} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          rounded="pill"
          className={['h-4', i === lines - 1 ? 'w-3/4' : 'w-full'].join(' ')}
        />
      ))}
    </div>
  )
}
