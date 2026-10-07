'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listerFils,
  mesClasses,
  ouvrirFil,
  type FilVue,
  type MaClasse,
  type PorteeEntraide,
} from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { SelectInput } from '@/components/ui/select-input'
import { Skeleton } from '@/components/ui/skeleton'
import { TextInput } from '@/components/ui/text-input'
import { FilEntraide } from '@/components/entraide/fil-entraide'
import { dateCourte, messageErreur } from '@/components/entraide/entraide-format'

const TITRE_MAX = 200
const QUESTION_MAX = 2000

type EntraidePanelProps = {
  portee: PorteeEntraide
  /** Chapter slug, or exercise UUID. */
  porteeRef: string
}

/**
 * Class entraide for one chapter or one exercise (F6a, ADR 0023): the threads of the
 * reader's class, a thread view, and a form to ask a question. Asynchronous by design —
 * an "Actualiser" button and a reload after each action, no live updates.
 */
export function EntraidePanel({ portee, porteeRef }: EntraidePanelProps) {
  const [classes, setClasses] = useState<MaClasse[] | null>(null)
  const [classeId, setClasseId] = useState<string | null>(null)
  const [fils, setFils] = useState<FilVue[] | null>(null)
  const [filOuvert, setFilOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [formulaire, setFormulaire] = useState(false)

  useEffect(() => {
    let vivant = true
    mesClasses(apiBaseUrl())
      .then((cs) => {
        if (!vivant) return
        setClasses(cs)
        setClasseId(cs[0]?.id ?? null)
      })
      .catch((e) => {
        if (vivant) setErreur(messageErreur(e, 'Impossible de charger tes classes.'))
      })
    return () => {
      vivant = false
    }
  }, [])

  const chargerFils = useCallback(async () => {
    if (!classeId) return
    try {
      setFils(await listerFils(apiBaseUrl(), portee, porteeRef, classeId))
      setErreur(null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger les questions.'))
    }
  }, [classeId, portee, porteeRef])

  useEffect(() => {
    setFils(null)
    void chargerFils()
  }, [chargerFils])

  if (filOuvert) {
    return (
      <FilEntraide
        filId={filOuvert}
        onRetour={() => {
          setFilOuvert(null)
          void chargerFils()
        }}
      />
    )
  }

  const objet = portee === 'chapitre' ? 'ce chapitre' : 'cet exercice'

  return (
    <section aria-label="Entraide de la classe" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Questions de la classe
        </p>
        {classeId && (
          <Button variant="ghost" size="sm" onClick={() => void chargerFils()}>
            Actualiser
          </Button>
        )}
      </div>

      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}

      {classes === null && !erreur && <Skeleton className="h-16 w-full" />}

      {classes !== null && classes.length === 0 && (
        <p className="rounded-md border border-line bg-surface-raised p-3 font-prose text-sm text-ink-muted">
          L’entraide se fait entre membres d’une même classe. Rejoins ta classe pour poser une
          question ou aider un camarade.
        </p>
      )}

      {classes !== null && classes.length > 1 && (
        <SelectInput
          label="Classe"
          value={classeId ?? ''}
          onChange={(e) => {
            setClasseId(e.target.value)
            setFormulaire(false)
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
            </option>
          ))}
        </SelectInput>
      )}

      {classeId && fils === null && !erreur && <Skeleton className="h-16 w-full" />}

      {classeId && fils !== null && (
        <>
          {fils.length === 0 && !formulaire && (
            <p className="font-prose text-sm text-ink-muted">
              Personne n’a encore posé de question sur {objet}.
            </p>
          )}

          {fils.length > 0 && (
            <ul className="flex flex-col gap-2">
              {fils.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setFilOuvert(f.id)}
                    className="flex w-full flex-col gap-1 rounded-lg border border-line bg-surface-raised p-3 text-left transition-colors duration-[var(--duration-fast)] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="font-prose text-sm font-semibold text-ink">{f.titre}</span>
                    <span className="flex flex-wrap items-center gap-2 font-prose text-xs text-ink-muted">
                      <span>
                        {f.auteurNom} · {dateCourte(f.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="chat-circle" size={12} aria-hidden="true" />
                        {f.nbReponses} réponse{f.nbReponses > 1 ? 's' : ''}
                      </span>
                      {f.resolu && (
                        <Chip variant="status" icon="check" className="text-success">
                          Résolu
                        </Chip>
                      )}
                      {f.statut === 'masque' && (
                        <Chip variant="status" icon="eye-slash">
                          Masqué
                        </Chip>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {formulaire ? (
            <NouvelleQuestion
              portee={portee}
              porteeRef={porteeRef}
              classeId={classeId}
              onAnnuler={() => setFormulaire(false)}
              onOuvert={(id) => {
                setFormulaire(false)
                setFilOuvert(id)
              }}
            />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setFormulaire(true)}>
              <Icon name="chat-circle" size={16} aria-hidden="true" />
              Poser une question
            </Button>
          )}
        </>
      )}
    </section>
  )
}

type NouvelleQuestionProps = {
  portee: PorteeEntraide
  porteeRef: string
  classeId: string
  onAnnuler: () => void
  onOuvert: (filId: string) => void
}

function NouvelleQuestion({
  portee,
  porteeRef,
  classeId,
  onAnnuler,
  onOuvert,
}: NouvelleQuestionProps) {
  const [titre, setTitre] = useState('')
  const [question, setQuestion] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const incomplet = titre.trim() === '' || question.trim() === ''

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (incomplet || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      onOuvert(await ouvrirFil(apiBaseUrl(), { portee, porteeRef, classeId, titre, question }))
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'envoyer ta question."))
      setEnvoi(false)
    }
  }

  return (
    <form
      onSubmit={envoyer}
      aria-label="Nouvelle question"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-panel p-3"
    >
      <TextInput
        label="Ta question en une ligne"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        maxLength={TITRE_MAX}
        placeholder="Ex. : pourquoi on met au même dénominateur ?"
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`question-${porteeRef}`}
          className="font-prose text-sm font-semibold text-ink"
        >
          Explique ce qui te bloque
        </label>
        <textarea
          id={`question-${porteeRef}`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={QUESTION_MAX}
          rows={4}
          className="w-full resize-none rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="font-prose text-xs text-ink-muted">
          Ta classe et ton professeur verront ta question. Pas de lien, pas d’information
          personnelle.
        </p>
      </div>
      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button type="submit" size="sm" loading={envoi} disabled={incomplet}>
          Envoyer
        </Button>
      </div>
    </form>
  )
}
