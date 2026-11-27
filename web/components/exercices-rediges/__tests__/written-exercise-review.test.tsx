import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TeacherWrittenCopy, WrittenExercise } from '@/lib/exercices-rediges'
import { WrittenExerciseReader } from '../written-exercise-reader'
import { WrittenExerciseReviews } from '../written-exercise-reviews'

const api = vi.hoisted(() => ({
  submitWrittenExercise: vi.fn(),
  listTeacherWrittenCopies: vi.fn(),
  publishWrittenFeedback: vi.fn(),
}))

vi.mock('@/lib/exercices-rediges', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/lib/exercices-rediges')),
  ...api,
}))

const exercise: WrittenExercise = {
  id: 'fb87a268-7cc8-4c69-8155-f638fbda50bf',
  version: 1,
  titre: 'Décrire un paysage',
  enonce: 'Décris le paysage dans un paragraphe.',
  modeCorrection: 'enseignant',
  photoAutorisee: true,
  cloture: false,
}

const copy: TeacherWrittenCopy = {
  eleveId: '27eb7fbf-fce0-44b5-9a08-294c2fae0434',
  nomAffiche: 'Lou',
  reponse: '',
  remisAt: '2026-11-26T12:00:00Z',
  photo: true,
}

beforeEach(() => vi.resetAllMocks())

describe('written exercise reviews', () => {
  it('lets a student submit a photo alone and opens the rubric while waiting for feedback', async () => {
    const photo = new File(['photo'], 'copie.png', { type: 'image/png' })
    api.submitWrittenExercise.mockResolvedValue({
      ...exercise,
      corrige: 'Deux détails précis sont attendus.',
      copieModele: 'Le champ se termine au pied de la colline.',
      soumission: { reponse: '', remisAt: copy.remisAt, photo: true },
    })
    render(<WrittenExerciseReader initialExercise={exercise} />)

    expect(screen.getByRole('button', { name: 'Remettre ma réponse' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Grille de correction' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Photo de ta copie (facultative)'), {
      target: { files: [photo] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remettre ma réponse' }))

    expect(await screen.findByRole('heading', { name: 'Grille de correction' })).toBeInTheDocument()
    expect(api.submitWrittenExercise).toHaveBeenCalledWith(exercise.id, 1, '', photo)
    expect(screen.getByRole('heading', { name: 'Copie modèle' })).toBeInTheDocument()
    const sideBySide = screen.getByRole('region', { name: 'Ta réponse et le corrigé' })
    const panels = within(sideBySide).getAllByRole('region')
    expect(panels.map((panel) => panel.getAttribute('aria-labelledby'))).toEqual([
      within(panels[0]).getByRole('heading', { name: 'Ta réponse' }).id,
      within(panels[1]).getByRole('heading', { name: 'Corrigé', exact: true }).id,
    ])
    expect(within(panels[0]).getByRole('img', { name: 'Photo de ta copie' })).toHaveAttribute(
      'src',
      `/api/exercices-rediges/${exercise.id}/photo`
    )
    expect(screen.getByRole('status')).toHaveTextContent('En attente du retour de ton enseignant.')
    expect(screen.getByRole('link', { name: 'Ouvrir la photo de ta copie' })).toHaveAttribute(
      'href',
      `/api/exercices-rediges/${exercise.id}/photo`
    )
    expect(screen.queryByText('Réponse incorrecte')).not.toBeInTheDocument()
  })

  it.each([true, false])('uses the server verdict for a formula (correct=%s)', (correct) => {
    render(
      <WrittenExerciseReader
        initialExercise={{
          ...exercise,
          modeCorrection: 'automatique',
          corrige: 'La forme développée est $2x + 2$.',
          soumission: { reponse: '2(x+1)', correct, remisAt: copy.remisAt },
        }}
      />
    )
    const solution = screen.getByRole('region', { name: 'Corrigé', exact: true })
    expect(within(solution).getByText(/La forme développée/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      correct ? 'Réponse correcte' : 'Réponse incorrecte'
    )
    expect(Boolean(within(solution).queryByText('Ton résultat diffère du résultat attendu.'))).toBe(
      !correct
    )
  })

  it('shows only the correction after closure without a submission', () => {
    render(
      <WrittenExerciseReader
        initialExercise={{ ...exercise, cloture: true, corrige: 'Décrire deux détails.' }}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Tu n’as pas remis de réponse.')
    expect(screen.getByRole('region', { name: 'Corrigé', exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ta réponse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remettre ma réponse' })).not.toBeInTheDocument()
  })

  it('keeps the submitted text intact alongside the published feedback', () => {
    render(
      <WrittenExerciseReader
        initialExercise={{
          ...exercise,
          corrige: 'Décrire deux détails.',
          soumission: {
            reponse: 'Le pré est vert.\nIl y a un arbre.',
            remisAt: copy.remisAt,
            retour: { commentaire: 'Précise où se trouve l’arbre.', publieAt: copy.remisAt },
          },
        }}
      />
    )
    const answer = screen.getByRole('region', { name: 'Ta réponse', exact: true })
    expect(answer.textContent).toContain('Le pré est vert.\nIl y a un arbre.')
    expect(screen.getByRole('region', { name: 'Corrigé', exact: true })).toHaveTextContent(
      'Précise où se trouve l’arbre.'
    )
    expect(screen.queryByText('En attente du retour de ton enseignant.')).not.toBeInTheDocument()
    expect(screen.queryByText('Réponse incorrecte')).not.toBeInTheDocument()
  })

  it('lets a teacher open a private photo and publish feedback on the selected copy', async () => {
    api.listTeacherWrittenCopies.mockResolvedValue([copy])
    api.publishWrittenFeedback.mockResolvedValue({
      ...copy,
      retour: { commentaire: 'Précise les couleurs dans le paysage.', publieAt: copy.remisAt },
    })
    render(<WrittenExerciseReviews exerciseId={exercise.id} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Lou' }))
    const review = screen.getByRole('region', { name: 'Copie de Lou' })
    expect(
      within(review).getByRole('link', { name: 'Ouvrir la photo de la copie' })
    ).toHaveAttribute(
      'href',
      `/api/prof/exercices-rediges/${exercise.id}/copies/${copy.eleveId}/photo`
    )
    fireEvent.change(within(review).getByLabelText('Commentaire pour l’élève'), {
      target: { value: 'Précise les couleurs dans le paysage.' },
    })
    fireEvent.click(within(review).getByRole('button', { name: 'Publier le retour' }))

    expect(await within(review).findByRole('status')).toHaveTextContent('Retour publié.')
    expect(api.publishWrittenFeedback).toHaveBeenCalledWith(
      exercise.id,
      copy.eleveId,
      'Précise les couleurs dans le paysage.'
    )
  })
})
