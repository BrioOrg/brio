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
    expect(screen.getByRole('status')).toHaveTextContent('En attente du retour de ton enseignant.')
    expect(screen.getByRole('link', { name: 'Ouvrir la photo de ta copie' })).toHaveAttribute(
      'href',
      `/api/exercices-rediges/${exercise.id}/photo`
    )
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
