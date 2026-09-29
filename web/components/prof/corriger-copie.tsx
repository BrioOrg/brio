'use client'

import { useEffect, useState } from 'react'

import {
  corrigerRendu,
  listerPiecesRendu,
  urlPiece,
  type PieceInfo,
} from '@brio/api-client'

import { apiBaseUrl } from '@/lib/api-base-url'

// Correction d'une copie par l'enseignant (F5, ADR 0028) : voir les pièces déposées + saisir une
// note et une appréciation. Réservé à l'enseignant du devoir (le serveur revérifie). Thème clair.
export function CorrigerCopie({ devoirId, eleveId }: { devoirId: string; eleveId: string }) {
  const [pieces, setPieces] = useState<PieceInfo[] | null>(null)
  const [note, setNote] = useState('')
  const [appreciation, setAppreciation] = useState('')
  const [etat, setEtat] = useState<'repos' | 'enregistrement' | 'enregistre' | 'echec'>('repos')

  useEffect(() => {
    void (async () => {
      try {
        setPieces(await listerPiecesRendu(apiBaseUrl(), devoirId, eleveId))
      } catch {
        setPieces([])
      }
    })()
  }, [devoirId, eleveId])

  async function enregistrer() {
    setEtat('enregistrement')
    try {
      const valeurNote = note.trim() === '' ? undefined : Number(note)
      await corrigerRendu(apiBaseUrl(), devoirId, eleveId, {
        note: Number.isNaN(valeurNote as number) ? undefined : valeurNote,
        appreciation: appreciation.trim() === '' ? undefined : appreciation,
      })
      setEtat('enregistre')
    } catch {
      setEtat('echec')
    }
  }

  return (
    <div className="mt-2 rounded-md border border-line bg-surface-page p-3">
      <p className="font-display text-[11px] font-extrabold uppercase tracking-widest text-ink-muted">
        Copies déposées
      </p>
      {pieces == null ? (
        <p className="mt-1 text-xs text-ink-muted">Chargement…</p>
      ) : pieces.length === 0 ? (
        <p className="mt-1 text-xs text-ink-muted">Aucune copie déposée.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {pieces.map((p) => (
            <li key={p.id}>
              <a
                href={urlPiece(apiBaseUrl(), p.id)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent-ink underline"
              >
                {p.filename ?? 'copie'}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[11px] font-bold uppercase tracking-wide text-ink-muted">
          Note
          <input
            type="number"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-20 rounded-md border border-line bg-surface-panel px-2 py-1 font-prose text-sm text-ink"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col text-[11px] font-bold uppercase tracking-wide text-ink-muted">
          Appréciation
          <input
            type="text"
            value={appreciation}
            onChange={(e) => setAppreciation(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-surface-panel px-2 py-1 font-prose text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={enregistrer}
          disabled={etat === 'enregistrement'}
          className="rounded-lg bg-accent px-3 py-1.5 font-display text-sm font-extrabold text-surface-panel"
        >
          Enregistrer
        </button>
      </div>
      {etat === 'enregistre' && <p className="mt-1 text-xs text-success">Correction enregistrée.</p>}
      {etat === 'echec' && <p className="mt-1 text-xs text-danger">Échec de l’enregistrement.</p>}
    </div>
  )
}
