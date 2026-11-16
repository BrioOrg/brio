'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CoursApiError,
  creerSalon,
  genererCodeClasse,
  getCodeClasse,
  listerInscrits,
  listerMesClasses,
  listerSalons,
  reinitialiserAccesEleve,
  renommerEleve,
  type ClasseInfo,
  type CodeClasseInfo,
  type InscriptionInfo,
  type ReinitialisationAcces,
  type SalonVue,
} from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { TextInput } from '@/components/ui/text-input'
import { messageErreur } from '@/components/messagerie/messagerie-format'
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

function dateEtHeure(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
    <div className="min-h-screen bg-surface-page font-prose text-ink">
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
            <SalonDeClasse classeId={classeId} libelle={classe.libelle} />
            <Eleves classeId={classeId} />
          </>
        )}
      </main>
    </div>
  )
}

function SalonDeClasse({ classeId, libelle }: { classeId: string; libelle: string }) {
  // undefined: loading · null: no salon yet · SalonVue: open
  const [salon, setSalon] = useState<SalonVue | null | undefined>(undefined)
  const [ouvre, setOuvre] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const salons = await listerSalons(apiBaseUrl())
      setSalon(salons.find((s) => s.classeId === classeId) ?? null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger le salon de la classe.'))
    }
  }, [classeId])

  useEffect(() => {
    void charger()
  }, [charger])

  async function ouvrir() {
    setOuvre(true)
    setErreur(null)
    try {
      await creerSalon(apiBaseUrl(), { classeId, titre: `Salon de ${libelle}` })
      await charger()
    } catch (e) {
      setErreur(messageErreur(e, "L'ouverture du salon a échoué. Réessayez."))
    } finally {
      setOuvre(false)
    }
  }

  return (
    <section
      aria-label="Salon de la classe"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-panel p-6"
    >
      <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
        Salon de la classe
      </h2>

      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}

      {salon === undefined && !erreur && <p className="text-ink-muted">Chargement…</p>}

      {salon && (
        <p className="text-sm text-ink-muted">
          Le salon <span className="font-semibold text-ink">{salon.titre}</span> est ouvert. Tes
          élèves le retrouvent dans « Ma classe ». Les messages signalés arrivent dans{' '}
          <span className="text-ink">Signalements du salon</span>.
        </p>
      )}

      {salon === null && (
        <>
          <p className="text-sm text-ink-muted">
            Ouvre un salon de discussion pour la classe : chaque élève et toi pouvez y écrire. Tu
            peux masquer un message signalé à tout moment.
          </p>
          <div>
            <Button size="sm" onClick={() => void ouvrir()} loading={ouvre}>
              <Icon name="chat-circle" size={16} aria-hidden="true" />
              Ouvrir le salon
            </Button>
          </div>
        </>
      )}
    </section>
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
  // The student whose access reset awaits confirmation, and the one-time results (ADR 0036):
  // one per student, so resetting a second one does not wipe what the first one still needs.
  const [aConfirmer, setAConfirmer] = useState<string | null>(null)
  const [acces, setAcces] = useState<Record<string, ReinitialisationAcces>>({})

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
                  <Button
                    id={idDeclencheur(eleve.compteId)}
                    variant="ghost"
                    size="sm"
                    aria-label={`Réinitialiser l’accès de ${eleve.nomAffiche}`}
                    onClick={() => setAConfirmer(eleve.compteId)}
                  >
                    Réinitialiser l’accès
                  </Button>
                </div>
              )}
              {aConfirmer === eleve.compteId && (
                <ConfirmerReinitialisation
                  classeId={classeId}
                  eleve={eleve}
                  onAnnuler={() => {
                    setAConfirmer(null)
                    rendreLeFocus(eleve.compteId)
                  }}
                  onReinitialise={(info) => {
                    setAConfirmer(null)
                    setAcces((avant) => ({ ...avant, [eleve.compteId]: info }))
                  }}
                />
              )}
              {acces[eleve.compteId] && (
                <AccesReinitialise
                  nomAffiche={eleve.nomAffiche}
                  info={acces[eleve.compteId]!}
                  onFermer={() => {
                    setAcces((avant) => {
                      const reste = { ...avant }
                      delete reste[eleve.compteId]
                      return reste
                    })
                    rendreLeFocus(eleve.compteId)
                  }}
                />
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

/** The id of a student's "Réinitialiser l'accès" button, where focus returns when a panel closes. */
function idDeclencheur(compteId: string): string {
  return `reinitialiser-${compteId}`
}

function rendreLeFocus(compteId: string) {
  // After React has removed the panel: the button is then the natural next stop (WCAG 2.4.3).
  requestAnimationFrame(() => document.getElementById(idDeclencheur(compteId))?.focus())
}

function ConfirmerReinitialisation({
  classeId,
  eleve,
  onAnnuler,
  onReinitialise,
}: {
  classeId: string
  eleve: InscriptionInfo
  onAnnuler: () => void
  onReinitialise: (info: ReinitialisationAcces) => void
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const panneau = useRef<HTMLDivElement>(null)

  // Focus moves into the confirmation it opens (WCAG 2.4.3).
  useEffect(() => {
    panneau.current?.focus()
  }, [])

  async function confirmer() {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      onReinitialise(await reinitialiserAccesEleve(apiBaseUrl(), classeId, eleve.compteId))
    } catch (e) {
      setErreur(message(e, 'La réinitialisation a échoué. Réessayez.'))
      setEnCours(false)
    }
  }

  return (
    <div
      ref={panneau}
      tabIndex={-1}
      role="group"
      aria-label={`Confirmer la réinitialisation de l’accès de ${eleve.nomAffiche}`}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <p className="font-prose text-sm text-ink">
        Réinitialiser l’accès de <span className="font-semibold">{eleve.nomAffiche}</span>&nbsp;?
        Son mot de passe actuel cessera de fonctionner et ses sessions seront fermées sur tous ses
        appareils. {eleve.nomAffiche} garde son compte, ses classes et sa progression.
      </p>
      <p className="font-prose text-sm text-ink-muted">
        Vous obtiendrez son identifiant et un mot de passe provisoire, valable 7&nbsp;jours et
        utilisable une seule fois. À sa connexion, l’élève choisira son propre mot de passe.
      </p>
      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button type="button" size="sm" loading={enCours} onClick={() => void confirmer()}>
          Réinitialiser l’accès
        </Button>
      </div>
    </div>
  )
}

/** Groups of four, as visual spacing only: copying or reading it out gives the exact identifier. */
function IdentifiantGroupe({ valeur }: { valeur: string }) {
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {(valeur.match(/.{1,4}/g) ?? [valeur]).map((groupe, i) => (
        <span key={i}>{groupe}</span>
      ))}
    </span>
  )
}

function BoutonCopier({ valeur, quoi }: { valeur: string; quoi: string }) {
  const [etat, setEtat] = useState<'pret' | 'copie' | 'echec'>('pret')

  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur)
      setEtat('copie')
    } catch {
      setEtat('echec')
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={`Copier ${quoi}`}
        onClick={() => void copier()}
      >
        <Icon name="copy" size={16} />
        Copier
      </Button>
      <span aria-live="polite" className="font-prose text-xs text-ink-muted">
        {etat === 'copie' ? 'Copié' : etat === 'echec' ? 'Copie impossible : notez-le.' : ''}
      </span>
    </span>
  )
}

/**
 * The one-time display of a reset: nothing here can be shown again (ADR 0036 §2). The provisional
 * password is masked until the teacher asks for it — a classroom screen is often projected.
 */
function AccesReinitialise({
  nomAffiche,
  info,
  onFermer,
}: {
  nomAffiche: string
  info: ReinitialisationAcces
  onFermer: () => void
}) {
  const [visible, setVisible] = useState(false)
  const titre = useRef<HTMLParagraphElement>(null)

  // Focus moves to the result that replaced the confirmation (WCAG 2.4.3).
  useEffect(() => {
    titre.current?.focus()
  }, [])

  return (
    <div
      role="region"
      aria-label={`Nouvel accès de ${nomAffiche}`}
      className="mt-3 flex flex-col gap-3 rounded-lg border-2 border-accent bg-accent-soft p-4"
    >
      <p
        ref={titre}
        tabIndex={-1}
        className="rounded-sm font-prose text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Accès de {nomAffiche} réinitialisé. Affiché une seule fois&nbsp;: notez-le maintenant et
        remettez-le à l’élève en main propre.
      </p>
      <p className="flex items-start gap-2 font-prose text-sm font-semibold text-ink">
        <Icon name="warning-circle" weight="bold" size={18} className="mt-0.5 shrink-0" />
        <span>N’affichez pas cet écran au tableau.</span>
      </p>
      <dl className="grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr_auto]">
        <dt className="font-prose text-sm text-ink-muted">Identifiant</dt>
        <dd
          data-testid="identifiant-connexion"
          className="font-display text-xl font-black tracking-widest text-ink"
        >
          <IdentifiantGroupe valeur={info.identifiantConnexion} />
        </dd>
        <dd>
          <BoutonCopier valeur={info.identifiantConnexion} quoi="l’identifiant" />
        </dd>
        <dt className="font-prose text-sm text-ink-muted">Mot de passe provisoire</dt>
        <dd className="flex flex-wrap items-center gap-3">
          {visible ? (
            <span
              data-testid="mot-de-passe-provisoire"
              className="font-display text-xl font-black tracking-widest text-ink"
            >
              {info.motDePasseProvisoire}
            </span>
          ) : (
            <span
              aria-label="Mot de passe provisoire masqué"
              className="font-display text-xl font-black tracking-widest text-ink-muted"
            >
              {info.motDePasseProvisoire.replace(/[^-]/g, '•')}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? 'Masquer' : 'Afficher'}
          </Button>
        </dd>
        <dd>
          <BoutonCopier valeur={info.motDePasseProvisoire} quoi="le mot de passe provisoire" />
        </dd>
        <dt className="font-prose text-sm text-ink-muted">Valable jusqu’au</dt>
        <dd className="font-prose text-sm text-ink sm:col-span-2">{dateEtHeure(info.expireLe)}</dd>
      </dl>
      <p className="font-prose text-sm text-ink">
        Le mot de passe provisoire ne sert qu’une fois&nbsp;: à sa première connexion, l’élève
        choisit son propre mot de passe. Il peut le taper sans les tirets. S’il est perdu ou expiré,
        réinitialisez à nouveau.
      </p>
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={onFermer}>
          J’ai noté, fermer
        </Button>
      </div>
    </div>
  )
}
