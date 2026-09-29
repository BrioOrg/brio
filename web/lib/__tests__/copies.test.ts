import { beforeEach, describe, expect, it, vi } from 'vitest'

import { corrigerRendu, deposerCopie, listerPiecesRendu, urlPiece } from '@brio/api-client'

// F5 (ADR 0028) — wrappers de dépôt/correction de copie. On moque fetch ; le token CSRF est déjà
// dans le cookie pour éviter l'amorce GET.
describe('F5 — wrappers copies', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=tok'
  })

  it('deposerCopie envoie un multipart et renvoie la pièce', async () => {
    const piece = {
      id: 'p1',
      filename: 'copie.jpg',
      contentType: 'image/jpeg',
      tailleOctets: 123,
      uploadedAt: '2026-09-29T10:00:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => piece } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const res = await deposerCopie(
      'http://x',
      'd1',
      new File(['x'], 'copie.jpg', { type: 'image/jpeg' })
    )

    expect(res.id).toBe('p1')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/devoirs/d1/rendu/pieces')
    expect((opts as RequestInit).method).toBe('POST')
    expect((opts as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('deposerCopie mappe une erreur serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response))
    await expect(
      deposerCopie('http://x', 'd1', new File(['x'], 'c.jpg', { type: 'image/jpeg' }))
    ).rejects.toBeTruthy()
  })

  it('listerPiecesRendu lit la liste', async () => {
    const pieces = [
      {
        id: 'p1',
        filename: 'c.jpg',
        contentType: 'image/jpeg',
        tailleOctets: 1,
        uploadedAt: '2026-09-29T10:00:00Z',
      },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => pieces } as Response))
    const res = await listerPiecesRendu('http://x', 'd1', 'e1')
    expect(res).toHaveLength(1)
  })

  it('corrigerRendu poste la note et l’appréciation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    await corrigerRendu('http://x', 'd1', 'e1', { note: 15, appreciation: 'Bien' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/rendus/e1/correction')
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({
      note: 15,
      appreciation: 'Bien',
    })
  })

  it('urlPiece construit l’URL de la pièce', () => {
    expect(urlPiece('http://x', 'p1')).toBe('http://x/api/devoirs/pieces/p1')
  })
})
