'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import {
  CoursApiError,
  genererCodeClasse,
  getCodeClasse,
  listerInscrits,
  listerMesClasses,
  renommerEleve,
  type ClasseInfo,
  type CodeClasseInfo,
  type InscriptionInfo,
} from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { TextInput } from '@/components/ui/text-input'
import { apiBaseUrl } from '@/lib/api-base-url'

// Une classe de l'enseignant : son code, à transmettre aux élèves, et la liste des élèves qui
// l'ont rejointe (ADR 0029). Le code est stocké haché côté serveur : il n'est lisible qu'au
// moment où il est généré, jamais ensuite (ADR 0018 §6).

const NOM_AFFICHE_MAX = 30

function message(e: unknown, defaut: string): string {
  return e instanceof CoursApiError ? e.message : defaut
}

function dateLongue(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Twelve characters read better off a whiteboard in groups of four; the join form ignores dashes. */
function enGroupes(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

export function ClasseDetail({ classeId }: { classeId: string }) {
  // undefined: loading · null: not one of the teacher's classes
  const [classe, setClasse] = useState<ClasseInfo | null | undefined>(undefined)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const classes = await listerMesClasses(apiBaseUrl())
        setClasse(classes.find((c) => c.id === classeId) ?? null)
      } catch (e) {
        setErreur(message(e, 'Impossible de charger cette classe pour le moment.'))
      }
    })()
  }, [classeId])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof/classes"
          aria-label="Retour à mes classes"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-lg font-extrabold text-ink">
          {classe ? classe.libelle : 'Classe'}
          {classe && (
            <span className="ml-2 font-prose text-sm font-normal text-ink-muted">
              {classe.niveauCode} · {classe.anneeScolaire}
            </span>
          )}
        </h1>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {erreur && (
          <p
            role="alert"
            className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger"
          >
            {erreur}
          </p>
        )}
        {classe === undefined && !erreur && <p className="text-ink-muted">Chargement…</p>}
        {classe === null && <p className="text-ink-muted">Cette classe est introuvable.</p>}
        {classe && (
          <>
            <CodeDeClasse classeId={classeId} />
            <Eleves classeId={classeId} />
          </>
        )}
      </main>
    </div>
  )
}

function CodeDeClasse({ classeId }: { classeId: string }) {
  // undefined: loading · null: no active code
  const [actif, setActif] = useState<CodeClasseInfo | null | undefined>(undefined)
  // The raw code, only known right after generating it.
  const [codeGenere, setCodeGenere] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        setActif(await getCodeClasse(apiBaseUrl(), classeId))
      } catch (e) {
        setActif(null)
        setErreur(message(e, 'Impossible de charger le code de la classe.'))
      }
    })()
  }, [classeId])

  async function generer() {
    if (
      actif &&
      !window.confirm(
        'Le code actuel cessera de fonctionner. Les élèves déjà inscrits restent dans la classe. Générer un nouveau code ?'
      )
    ) {
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      const cree = await genererCodeClasse(apiBaseUrl(), classeId)
      setCodeGenere(cree.code)
      setActif({
        id: cree.id,
        expireAt: cree.expireAt,
        usages: cree.usages,
        usagesMax: cree.usagesMax,
      })
    } catch (e) {
      setErreur(message(e, 'La génération du code a échoué. Réessayez.'))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section
      aria-label="Code de classe"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-panel p-6"
    >
      <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
        Code de classe
      </h2>

      {codeGenere && (
        <div className="rounded-lg border-2 border-accent bg-accent-soft p-4">
          <p
            data-testid="code-genere"
            className="font-display text-2xl font-black tracking-widest text-ink"
          >
            {enGroupes(codeGenere)}
          </p>
          <p className="mt-2 font-prose text-sm text-ink">
            Notez-le maintenant : il ne sera plus affiché. Vos élèves le saisissent sur la page
            «&nbsp;J’ai un code de classe&nbsp;» de Brio.
          </p>
        </div>
      )}

      {actif === undefined ? (
        <p className="font-prose text-sm text-ink-muted">Chargement…</p>
      ) : actif === null ? (
        <p className="font-prose text-sm text-ink-muted">
          Cette classe n’a pas de code actif. Générez-en un pour que vos élèves puissent la
          rejoindre.
        </p>
      ) : (
        <p className="font-prose text-sm text-ink-muted">
          {codeGenere ? 'Ce code' : 'Un code est actif : il'} expire le {dateLongue(actif.expireAt)}
          {' · '}
          {actif.usages} utilisation{actif.usages > 1 ? 's' : ''} sur {actif.usagesMax}.
          {!codeGenere &&
            ' Il n’est pas réaffichable : si vous l’avez perdu, générez-en un nouveau.'}
        </p>
      )}

      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}

      {actif !== undefined && (
        <div>
          <Button
            size="sm"
            variant={actif ? 'secondary' : 'primary'}
            loading={enCours}
            onClick={generer}
          >
            {actif ? 'Générer un nouveau code' : 'Générer un code'}
          </Button>
        </div>
      )}
    </section>
  )
}

function Eleves({ classeId }: { classeId: string }) {
  const [eleves, setEleves] = useState<InscriptionInfo[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enEdition, setEnEdition] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      setEleves(await listerInscrits(apiBaseUrl(), classeId))
      setErreur(null)
    } catch (e) {
      setEleves([])
      setErreur(message(e, 'Impossible de charger les élèves de la classe.'))
    }
  }, [classeId])

  useEffect(() => {
    void charger()
  }, [charger])

  return (
    <section
      aria-label="Élèves"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-panel p-6"
    >
      <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
        Élèves{eleves && eleves.length > 0 ? ` (${eleves.length})` : ''}
      </h2>

      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}
      {eleves === null && <p className="font-prose text-sm text-ink-muted">Chargement…</p>}
      {eleves?.length === 0 && !erreur && (
        <p className="font-prose text-sm text-ink-muted">
          Aucun élève n’a encore rejoint cette classe.
        </p>
      )}

      {eleves && eleves.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {eleves.map((eleve) => (
            <li key={eleve.compteId} className="py-3">
              {enEdition === eleve.compteId ? (
                <Renommer
                  classeId={classeId}
                  eleve={eleve}
                  onAnnuler={() => setEnEdition(null)}
                  onRenomme={async () => {
                    setEnEdition(null)
                    // Reload the whole list: a rename can create or clear a homonym elsewhere.
                    await charger()
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-extrabold text-ink">
                      {eleve.nomAffiche}
                    </p>
                    <p className="font-prose text-xs text-ink-muted">
                      Dans la classe depuis le {dateLongue(eleve.depuis)}
                    </p>
                    {eleve.homonyme && (
                      <p className="mt-1 font-prose text-xs text-ink">
                        Un autre élève de la classe porte ce nom — vous pourriez ajouter une
                        initiale, par exemple «&nbsp;{eleve.nomAffiche} B.&nbsp;».
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Renommer ${eleve.nomAffiche}`}
                    onClick={() => setEnEdition(eleve.compteId)}
                  >
                    Renommer
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Renommer({
  classeId,
  eleve,
  onAnnuler,
  onRenomme,
}: {
  classeId: string
  eleve: InscriptionInfo
  onAnnuler: () => void
  onRenomme: () => Promise<void>
}) {
  const [nom, setNom] = useState(eleve.nomAffiche)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enCours) return
    if (!nom.trim()) {
      setErreur('Indiquez un nom.')
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      await renommerEleve(apiBaseUrl(), classeId, eleve.compteId, nom.trim())
      await onRenomme()
    } catch (e) {
      setErreur(message(e, 'Impossible de renommer cet élève.'))
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-wrap items-end gap-3">
      <TextInput
        label={`Nom affiché de ${eleve.nomAffiche}`}
        className="min-w-0 flex-1"
        maxLength={NOM_AFFICHE_MAX}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        error={erreur ?? undefined}
        autoFocus
      />
      <Button type="button" variant="ghost" size="sm" onClick={onAnnuler}>
        Annuler
      </Button>
      <Button type="submit" size="sm" loading={enCours}>
        Enregistrer
      </Button>
    </form>
  )
}
