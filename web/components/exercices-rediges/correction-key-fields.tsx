import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import type { WrittenCorrectionKey } from '@/lib/exercices-rediges'

const emptyCriterion = { attendu: '', variantes: [] }
export const emptyCorrectionKey: WrittenCorrectionKey = {
  type: 'liste',
  minimum: 1,
  criteres: [emptyCriterion],
  confirmee: false,
}

export function CorrectionKeyFields({
  value,
  onChange,
}: {
  value: WrittenCorrectionKey
  onChange: (value: WrittenCorrectionKey) => void
}) {
  function change(patch: Partial<WrittenCorrectionKey>) {
    onChange({ ...value, confirmee: false, ...patch })
  }

  function update(index: number, criterion: WrittenCorrectionKey['criteres'][number]) {
    change({ criteres: value.criteres.map((current, i) => (i === index ? criterion : current)) })
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-semibold">Clé de correction</legend>
      <SelectInput
        label="Type de réponse"
        value={value.type}
        onChange={(event) =>
          change({ type: event.target.value === 'liste' ? 'liste' : 'traduction' })
        }
      >
        <option value="liste">Éléments attendus dans une liste fermée</option>
        <option value="traduction">Traduction avec sens ou temps imposé</option>
      </SelectInput>
      <TextInput
        label="Nombre minimum de critères attendus"
        type="number"
        min={1}
        max={value.criteres.length}
        value={value.minimum || ''}
        onChange={(event) => change({ minimum: Number(event.target.value) })}
      />
      {value.criteres.map((criterion, index) => (
        <fieldset key={index} className="space-y-2 border-t border-line pt-2">
          <legend className="text-sm font-semibold">Critère {index + 1}</legend>
          <TextInput
            label={`Élément attendu ${index + 1}`}
            value={criterion.attendu}
            maxLength={180}
            onChange={(event) => update(index, { ...criterion, attendu: event.target.value })}
          />
          <label className="block space-y-1">
            <span className="block text-sm font-semibold">
              Variantes admises {index + 1} (une par ligne)
            </span>
            <textarea
              className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 font-prose text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              rows={2}
              value={criterion.variantes.join('\n')}
              maxLength={403}
              onChange={(event) =>
                update(index, { ...criterion, variantes: event.target.value.split('\n') })
              }
            />
          </label>
          {value.criteres.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                change({
                  minimum: Math.min(value.minimum, value.criteres.length - 1),
                  criteres: value.criteres.filter((_, current) => current !== index),
                })
              }
            >
              Retirer le critère {index + 1}
            </Button>
          )}
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={value.criteres.length >= 6}
        onClick={() => change({ criteres: [...value.criteres, emptyCriterion] })}
      >
        Ajouter un critère
      </Button>
      <TextInput
        label="Court extrait de la leçon (facultatif)"
        maxLength={500}
        value={value.extraitLecon ?? ''}
        onChange={(event) => change({ extraitLecon: event.target.value })}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          checked={value.confirmee}
          onChange={(event) => change({ confirmee: event.target.checked })}
        />
        J’ai vérifié le corrigé et les critères. Chaque critère est vérifiable sans jugement
        subjectif.
      </label>
    </fieldset>
  )
}
