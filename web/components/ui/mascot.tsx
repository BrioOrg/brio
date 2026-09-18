type MascotMood = 'calm' | 'happy'

type MascotProps = {
  /** Rendered width in px; height keeps the 128×108 aspect ratio. */
  size?: number
  mood?: MascotMood
  /** Accessible name. Omit to render the mascot as decorative (aria-hidden). */
  label?: string
  className?: string
}

/**
 * Brio's mascot — le caméléon.
 *
 * This is an illustration asset, not UI chrome: the colours below are the
 * character's own palette, taken verbatim from the frozen mockup
 * `docs/design/visuels/2-parcours-atlas.html`. They are intentionally NOT
 * design tokens — a mascot is art. The token-drift gate only guards Tailwind
 * classes and CSS declarations, not SVG presentation attributes.
 *
 * Standalone by design (no branch/scene) so it can be dropped onto the parcours
 * or atlas later (#79). `mood` gives it a couple of simple expressions; more can
 * be added once the character's states are decided.
 */
export function Mascot({ size = 96, mood = 'calm', label, className }: MascotProps) {
  const decorative = !label
  return (
    <svg
      viewBox="0 0 128 108"
      width={size}
      height={(size * 108) / 128}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      focusable="false"
      className={className}
    >
      {/* queue enroulée */}
      <path
        d="M54 62 C 42 66, 38 82, 52 82 C 62 82, 62 70, 53 70 C 47 70, 47 77, 52 77"
        fill="none"
        stroke="#2f8a45"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* pattes */}
      <path
        d="M60 62 C 57 72, 54 78, 52 82"
        fill="none"
        stroke="#2f8a45"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M47 83 l6 4 M57 83 l-6 4"
        fill="none"
        stroke="#2f8a45"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M86 60 C 89 70, 92 78, 94 83"
        fill="none"
        stroke="#2f8a45"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M89 84 l6 4 M99 84 l-6 4"
        fill="none"
        stroke="#2f8a45"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* corps */}
      <path
        d="M50 60 C 44 40, 62 30, 82 33 C 98 35, 106 43, 104 50 C 102 60, 88 64, 72 64 L58 64 C 52 64, 51 62, 50 60 Z"
        fill="#46b45f"
      />
      <path
        d="M58 62 C 70 66, 88 64, 100 54 C 98 62, 84 66, 66 65 C 61 64, 58 63, 58 62 Z"
        fill="#86e0a0"
        opacity=".85"
      />
      {/* crête dorsale */}
      <path d="M56 41 l4 -6 3 6 4 -7 4 7 4 -6 4 6 4 -5 3 5" fill="#2f8a45" />
      {/* crête de tête */}
      <path d="M92 37 C 89 27, 97 25, 100 33 C 101 36, 98 39, 92 37 Z" fill="#3aa054" />
      {/* tête */}
      <path
        d="M92 37 C 108 33, 122 39, 122 47 C 122 55, 110 58, 98 55 C 90 53, 87 41, 92 37 Z"
        fill="#46b45f"
      />
      <path
        d="M108 52 C 114 52, 119 50, 121 47"
        fill="none"
        stroke="#2b7d40"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* sourire — état happy */}
      {mood === 'happy' && (
        <path
          d="M112 53 C 116 56, 120 55, 122 51"
          fill="none"
          stroke="#2b7d40"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      {/* œil */}
      <circle cx="106" cy="45" r="7" fill="#ff7d1e" />
      <circle cx="106" cy="45" r="2.8" fill="#102a18" />
      <circle
        cx={mood === 'happy' ? 103.4 : 103.6}
        cy="42.8"
        r={mood === 'happy' ? 1.8 : 1.4}
        fill="#fff"
      />
    </svg>
  )
}
