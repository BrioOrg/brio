import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { BlockRenderer } from '@/components/blocs/block-renderer'
import { BlocEditeur } from '@/components/prof/bloc-editeur'
import {
  brouillonVersApercu,
  contenuDepuisBrouillon,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
} from '@/lib/cours-editeur'

function CourseHarness() {
  const [draft] = useState(nouveauBrouillon)
  const [block, setBlock] = useState(() => nouveauBloc('simulateur-probabilites'))
  const course = { ...draft, sections: [{ ...draft.sections[0], blocks: [block] }] }
  const preview = brouillonVersApercu(course).chapitre.sections[0].blocks[0]
  const published = contenuDepuisBrouillon(course).sections[0].blocks[0]

  return (
    <>
      <BlocEditeur
        bloc={block}
        onModifier={(patch) => setBlock((current) => ({ ...current, ...patch }))}
      />
      <section aria-label="Aperçu élève">
        <BlockRenderer block={preview} apercu />
      </section>
      <section aria-label="Cours publié">
        <BlockRenderer block={published} apercu={false} />
      </section>
    </>
  )
}

describe('Probability simulator course block', () => {
  it('uses the selected experiment and formatted instruction in the preview and published course', () => {
    render(<CourseHarness />)

    const experiment = screen.getByRole('combobox', { name: 'Expérience de départ' })
    expect(experiment).toHaveValue('die')
    fireEvent.change(experiment, { target: { value: 'urn' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Consigne (facultative)' }), {
      target: { value: 'Compare les **fréquences**.' },
    })

    for (const name of ['Aperçu élève', 'Cours publié']) {
      const view = within(screen.getByRole('region', { name }))
      expect(view.getByRole('combobox')).toHaveValue('urn')
      expect(view.getByText('fréquences', { selector: 'strong' })).toBeVisible()
      expect(view.getByRole('status')).toHaveTextContent('0 essais')
      fireEvent.click(view.getByRole('button', { name: 'Lancer 10 essais' }))
      expect(view.getByRole('status')).toHaveTextContent('10 essais')
    }
  })

  it('omits an empty instruction and reports an invalid experiment before publication', () => {
    const draft = nouveauBrouillon()
    const section = draft.sections[0]
    const block = { ...nouveauBloc('simulateur-probabilites'), consigne: '  ' }
    const document = contenuDepuisBrouillon({
      ...draft,
      sections: [{ ...section, blocks: [block] }],
    })
    expect(document.sections[0].blocks[0]).not.toHaveProperty('consigne')
    expect(problemesBloc({ ...block, experiment: 'cards' }, section.id)).toContainEqual(
      expect.objectContaining({ champ: 'experiment', gravite: 'bloquant' })
    )
  })
})
