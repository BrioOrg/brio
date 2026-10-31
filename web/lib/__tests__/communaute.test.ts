import { CommunauteError } from '@brio/api-client'
import { describe, expect, it } from 'vitest'

import {
  dateMessage,
  estIdQuestion,
  libelleAuteur,
  libelleMatiere,
  messageErreur,
  urlCommunaute,
} from '../communaute'

describe('communaute', () => {
  it('writes an author as « pseudonym · level », or the pseudonym alone', () => {
    expect(libelleAuteur({ pseudonyme: 'Renard-Turquoise', niveau: '3e' })).toBe(
      'Renard-Turquoise · 3e'
    )
    expect(libelleAuteur({ pseudonyme: 'Membre', niveau: null })).toBe('Membre')
  })

  it('dates a message in French time, wherever it renders', () => {
    expect(dateMessage('2026-10-20T16:00:00Z')).toBe('20 oct., 18:00')
  })

  it('accepts only a UUID as a question id', () => {
    expect(estIdQuestion('00000000-0000-4000-8000-000000000301')).toBe(true)
    expect(estIdQuestion('nouvelle')).toBe(false)
    expect(estIdQuestion('../moi')).toBe(false)
  })

  it('builds the list URL, the first page without a page number', () => {
    expect(urlCommunaute({ niveau: '3e', matiere: '' })).toBe('/communaute?niveau=3e')
    expect(urlCommunaute({ niveau: 'tous', matiere: 'mathematiques', page: 2 })).toBe(
      '/communaute?niveau=tous&matiere=mathematiques&page=2'
    )
  })

  it('names a known subject and leaves an unknown one as it came', () => {
    expect(libelleMatiere('mathematiques')).toBe('Mathématiques')
    expect(libelleMatiere('svt')).toBe('svt')
  })

  it('shows the server’s message, and the fallback for anything else', () => {
    expect(messageErreur(new CommunauteError(409, 'Déjà résolue.'), 'repli')).toBe('Déjà résolue.')
    expect(messageErreur(new Error('réseau'), 'repli')).toBe('repli')
  })
})
