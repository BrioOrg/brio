'use client'

import { useRef, useState } from 'react'

import { deposerCopie, type PieceInfo } from '@brio/api-client'

import { apiBaseUrl } from '@/lib/api-base-url'

// Dépôt d'une copie (photo/scan) par l'élève sur son rendu (F5, ADR 0028). Le serveur retire l'EXIF
// et restreint l'accès ; ici on offre juste l'envoi + un accusé. Jamais de donnée fabriquée.
export function DeposerCopie({ devoirId }: { devoirId: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [pieces, setPieces] = useState<PieceInfo[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setEnvoi(true)
    setErreur(null)
    try {
      const piece = await deposerCopie(apiBaseUrl(), devoirId, fichier)
      setPieces((prev) => [...prev, piece])
    } catch {
      setErreur('Le dépôt a échoué (JPEG, PNG ou PDF ; 10 Mo maximum).')
    } finally {
      setEnvoi(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Déposer ma copie
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={onChange}
          disabled={envoi}
          aria-label="Choisir une photo ou un scan de ma copie"
          className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:font-display file:text-xs file:font-extrabold file:text-accent-ink"
        />
        {envoi && <span className="text-xs text-ink-muted">Envoi…</span>}
      </div>
      {erreur && <p className="mt-1 text-xs text-danger">{erreur}</p>}
      {pieces.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {pieces.map((p) => (
            <li key={p.id} className="text-xs text-ink-muted">
              ✓ {p.filename ?? 'copie'} déposée
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
