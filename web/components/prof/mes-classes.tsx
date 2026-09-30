'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import {
  CoursApiError,
  creerMaClasse,
  listerEtablissements,
  listerMesClasses,
  listerMesEtablissements,
  rattacherEtablissement,
  type ClasseInfo,
  type EtablissementPublic,
} from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { SelectInput } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { getCatalogue, type Catalogue } from '@/lib/api'
import { apiBaseUrl } from '@/lib/api-base-url'

// Les classes de l'enseignant, par établissement (ADR 0029). Il crée ses classes lui-même, dans
// un établissement auquel il est rattaché ; il ne crée jamais d'établissement, il en choisit un
// parmi ceux qui existent. Les niveaux proposés viennent du catalogue réel.

type Donnees = {
  classes: ClasseInfo[]
  mesEtablissements: EtablissementPublic[]
  tousEtablissements: EtablissementPublic[]
  niveaux: Catalogue
}

function message(e: unknown, defaut: string): string {
  return e instanceof CoursApiError ? e.message : defaut
}

export function MesClasses() {
  const router = useRouter()
  const [donnees, setDonnees] = useState<Donnees | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)

  const charger = useCallback(async () => {
    try {
      const base = apiBaseUrl()
      const [classes, mesEtablissements, tousEtablissements, niveaux] = await Promise.all([
        listerMesClasses(base),
        listerMesEtablissements(base),
        // The two lists below only feed pick-lists: without them the page still works.
        listerEtablissements(base).catch(() => []),
        getCatalogue().catch(() => []),
      ])
      setDonnees({ classes, mesEtablissements, tousEtablissements, niveaux })
      setErreur(null)
    } catch (e) {
      setErreur(message(e, 'Impossible de charger vos classes pour le moment.'))
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof"
          aria-label="Retour à l'espace enseignant"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-lg font-extrabold text-ink">Mes classes</h1>
        {donnees && donnees.classes.length > 0 && !creation && (
          <Button size="sm" onClick={() => setCreation(true)}>
            <span aria-hidden="true">＋</span> Nouvelle classe
          </Button>
        )}
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-6">
        {erreur && (
          <p
            role="alert"
            className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger"
          >
            {erreur}
          </p>
        )}
        {!donnees && !erreur && <p className="text-ink-muted">Chargement…</p>}

        {donnees && creation && (
          <NouvelleClasse
            etablissements={donnees.mesEtablissements}
            niveaux={donnees.niveaux}
            onAnnuler={() => setCreation(false)}
            onCreee={(classe) => router.push(`/prof/classes/${classe.id}`)}
          />
        )}

        {donnees && donnees.classes.length === 0 && !creation && (
          <div className="rounded-xl border border-dashed border-line bg-surface-panel px-6 py-14 text-center">
            <p className="font-display text-lg font-extrabold text-ink">
              Vous n’avez pas encore de classe
            </p>
            <p className="mx-auto mt-1 max-w-md font-prose text-sm text-ink-muted">
              Créez votre classe, puis donnez son code à vos élèves : ils la rejoignent en le
              saisissant sur Brio. Vous pourrez ensuite leur publier un cours ou un devoir.
            </p>
            <Button className="mt-5" onClick={() => setCreation(true)}>
              <span aria-hidden="true">＋</span> Créer ma première classe
            </Button>
          </div>
        )}

        {donnees &&
          donnees.mesEtablissements.map((etab) => {
            const classes = donnees.classes.filter((c) => c.etablissementId === etab.id)
            if (classes.length === 0) return null
            return (
              <section key={etab.id} aria-label={etab.nom}>
                <h2 className="mb-2 font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
                  {etab.nom}
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {classes.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/prof/classes/${c.id}`}
                        className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface-panel p-5 transition-colors hover:border-accent-edge"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-lg font-extrabold text-ink">
                            {c.libelle}
                          </span>
                          <span className="mt-1 block font-prose text-sm text-ink-muted">
                            {c.niveauCode} · {c.anneeScolaire}
                          </span>
                        </span>
                        <Icon
                          name="arrow-right"
                          size={16}
                          className="shrink-0 text-ink-muted"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

        {donnees && (
          <MesEtablissements
            miens={donnees.mesEtablissements}
            tous={donnees.tousEtablissements}
            onAjoute={charger}
          />
        )}
      </main>
    </div>
  )
}

function NouvelleClasse({
  etablissements,
  niveaux,
  onAnnuler,
  onCreee,
}: {
  etablissements: EtablissementPublic[]
  niveaux: Catalogue
  onAnnuler: () => void
  onCreee: (classe: ClasseInfo) => void
}) {
  // A single établissement needs no choosing.
  const [etablissementId, setEtablissementId] = useState(
    etablissements.length === 1 ? etablissements[0].id : ''
  )
  const [niveauCode, setNiveauCode] = useState('')
  const [libelle, setLibelle] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enCours) return
    if (!etablissementId || !niveauCode || !libelle.trim()) {
      setErreur('Indiquez l’établissement, le niveau et le nom de la classe.')
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      onCreee(
        await creerMaClasse(apiBaseUrl(), { etablissementId, niveauCode, libelle: libelle.trim() })
      )
    } catch (e) {
      setErreur(message(e, 'La création de la classe a échoué. Réessayez.'))
      setEnCours(false)
    }
  }

  return (
    <form
      onSubmit={soumettre}
      noValidate
      aria-label="Nouvelle classe"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface-panel p-6"
    >
      <h2 className="font-display text-lg font-extrabold text-ink">Nouvelle classe</h2>

      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}

      {etablissements.length === 0 ? (
        <p className="font-prose text-sm text-ink-muted">
          Vous n’êtes rattaché à aucun établissement. Ajoutez-en un ci-dessous pour créer une
          classe.
        </p>
      ) : (
        <>
          {etablissements.length > 1 && (
            <SelectInput
              label="Établissement"
              value={etablissementId}
              onChange={(e) => setEtablissementId(e.target.value)}
            >
              <option value="">Choisir…</option>
              {etablissements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </SelectInput>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectInput
              label="Niveau"
              value={niveauCode}
              onChange={(e) => setNiveauCode(e.target.value)}
            >
              <option value="">Choisir…</option>
              {niveaux.map((n) => (
                <option key={n.niveauCode} value={n.niveauCode}>
                  {n.niveauLibelle}
                </option>
              ))}
            </SelectInput>
            <TextInput
              label="Nom de la classe"
              placeholder="4e B"
              maxLength={100}
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onAnnuler}>
          Annuler
        </Button>
        {etablissements.length > 0 && (
          <Button type="submit" size="sm" loading={enCours}>
            Créer la classe
          </Button>
        )}
      </div>
    </form>
  )
}

function MesEtablissements({
  miens,
  tous,
  onAjoute,
}: {
  miens: EtablissementPublic[]
  tous: EtablissementPublic[]
  onAjoute: () => Promise<void>
}) {
  const autres = tous.filter((e) => !miens.some((m) => m.id === e.id))
  const [choix, setChoix] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function ajouter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!choix || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      await rattacherEtablissement(apiBaseUrl(), choix)
      setChoix('')
      await onAjoute()
    } catch (e) {
      setErreur(message(e, "Impossible d'ajouter cet établissement."))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section
      aria-label="Mes établissements"
      className="rounded-xl border border-line bg-surface-panel p-6"
    >
      <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
        Mes établissements
      </h2>
      {miens.length === 0 ? (
        <p className="mt-2 font-prose text-sm text-ink-muted">
          Aucun établissement pour l’instant.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 font-prose text-sm text-ink">
          {miens.map((e) => (
            <li key={e.id}>{e.nom}</li>
          ))}
        </ul>
      )}

      {autres.length > 0 && (
        <form onSubmit={ajouter} className="mt-4 flex flex-wrap items-end gap-3">
          <SelectInput
            label="Vous enseignez aussi ailleurs ?"
            className="min-w-0 flex-1"
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
          >
            <option value="">Choisir un établissement…</option>
            {autres.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </SelectInput>
          <Button type="submit" variant="secondary" size="sm" disabled={!choix} loading={enCours}>
            Ajouter
          </Button>
        </form>
      )}
      {erreur && (
        <p role="alert" className="mt-2 font-prose text-sm text-danger">
          {erreur}
        </p>
      )}
    </section>
  )
}
