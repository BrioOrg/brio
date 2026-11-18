import { TONES, type Tone } from '@brio/content'

// Teinte d'un élément de figure (ADR 0037) : l'encre par défaut, ou l'une des quatre couleurs
// qu'une formule reprend avec \tone{n}{…}. Les couleurs varient avec le thème : on les nomme par
// leur numéro, et la pastille montre celle du thème courant.

const PASTILLE = {
  1: 'bg-tone-1',
  2: 'bg-tone-2',
  3: 'bg-tone-3',
  4: 'bg-tone-4',
} as const satisfies Record<Tone, string>

export function ChoixTeinte({
  tone,
  onChange,
  ariaLabel,
}: {
  tone?: Tone
  onChange: (tone: Tone | undefined) => void
  ariaLabel: string
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden
        className={`block h-3 w-3 shrink-0 rounded-xs border border-line ${tone ? PASTILLE[tone] : 'bg-ink'}`}
      />
      <select
        aria-label={ariaLabel}
        className="rounded-md border border-line bg-surface-page px-2 py-1 font-display text-sm font-bold text-ink focus:border-accent focus:outline-none"
        value={tone ?? ''}
        onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as Tone) : undefined)}
      >
        <option value="">encre</option>
        {TONES.map((n) => (
          <option key={n} value={n}>
            teinte {n}
          </option>
        ))}
      </select>
    </span>
  )
}
