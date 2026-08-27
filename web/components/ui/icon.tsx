type IconWeight = 'regular' | 'bold'

type IconProps = {
  name: string
  weight?: IconWeight
  size?: number
  label?: string
  className?: string
}

export function Icon({ name, weight = 'regular', size = 24, label, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={className}
      focusable="false"
    >
      <use href={`/icons/sprite.svg#ph-${name}-${weight}`} />
    </svg>
  )
}
