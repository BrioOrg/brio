'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Icon } from '@/components/ui/icon'
import {
  enregistrerBrouillon,
  listerBrouillons,
  nouveauBrouillon,
  resumeBrouillon,
  supprimerBrouillon,
  type Brouillon,
} from '@/lib/cours-editeur'

// Accueil de l'espace enseignant : la liste des cours (en brouillon local pour l'instant),
// du plus récent au plus ancien, et le bouton « Nouveau cours » qui ouvre l'éditeur (piste 4).

export function MesCours() {
  const router = useRouter()
  const [cours, setCours] = useState<Brouillon[] | null>(null)

  useEffect(() => {
    setCours(listerBrouillons())
  }, [])

  function nouveauCours() {
    const b = nouveauBrouillon()
    enregistrerBrouillon(b)
    router.push(`/prof/cours/${b.id}`)
  }

  function supprimer(id: string, titre: string) {
    if (!window.confirm(`Supprimer « ${titre || 'Cours sans titre'} » ? C’est définitif.`)) return
    supprimerBrouillon(id)
    setCours(listerBrouillons())
  }

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="border-b border-line bg-surface-panel">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
              Brio · Espace enseignant
            </p>
            <h1 className="font-display text-2xl font-black tracking-tight text-ink">Mes cours</h1>
          </div>
          <button
            type="button"
            onClick={nouveauCours}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-surface-panel [box-shadow:var(--shadow-arcade)] hover:-translate-y-0.5"
          >
            <span aria-hidden="true">＋</span> Nouveau cours
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {cours === null ? (
          <p className="font-prose text-ink-muted">Chargement…</p>
        ) : cours.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface-panel px-6 py-14 text-center">
            <p className="font-display text-lg font-extrabold text-ink">Aucun cours pour l’instant</p>
            <p className="mx-auto mt-1 max-w-md font-prose text-sm text-ink-muted">
              Crée ton premier cours : un titre, des parties, et des blocs (texte, formule, exemple
              en étapes, exercice…). Tu verras en direct ce que verra l’élève.
            </p>
            <button
              type="button"
              onClick={nouveauCours}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-display text-base font-extrabold text-surface-panel [box-shadow:var(--shadow-arcade)] hover:-translate-y-0.5"
            >
              <span aria-hidden="true">＋</span> Créer mon premier cours
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cours.map((c) => (
              <li key={c.id}>
                <CarteCours cours={c} onSupprimer={() => supprimer(c.id, c.title)} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function CarteCours({ cours, onSupprimer }: { cours: Brouillon; onSupprimer: () => void }) {
  const { parties, blocs } = resumeBrouillon(cours)
  return (
    <div className="group relative flex h-full flex-col rounded-xl border border-line bg-surface-panel p-5 transition-colors hover:border-accent-edge">
      <Link href={`/prof/cours/${cours.id}`} className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 py-0.5 font-display text-[11px] font-extrabold text-accent-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-xp" aria-hidden="true" />
          Brouillon
        </span>
        <p className="mt-2 font-display text-lg font-extrabold text-ink">
          {cours.title.trim() || 'Cours sans titre'}
        </p>
        <p className="mt-1 font-prose text-sm text-ink-muted">
          {parties} partie{parties > 1 ? 's' : ''} · {blocs} bloc{blocs > 1 ? 's' : ''}
          {cours.misAJour ? ` · modifié le ${dateCourte(cours.misAJour)}` : ''}
        </p>
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <Link
          href={`/prof/cours/${cours.id}`}
          className="inline-flex items-center gap-1.5 font-display text-sm font-extrabold text-accent-ink"
        >
          Continuer <Icon name="arrow-right" size={14} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Supprimer ${cours.title.trim() || 'ce cours'}`}
          title="Supprimer"
          className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-muted hover:border-danger hover:text-danger"
        >
          <Icon name="x" size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function dateCourte(epoch: number): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(epoch))
  } catch {
    return ''
  }
}
