'use client'

import { createContext, useContext } from 'react'

import { champEnErreur, type Probleme } from '@/lib/cours-editeur'

// Les problèmes de publication d'un bloc, mis à disposition de ses champs sans les faire passer
// par chaque sous-éditeur. Seuls les problèmes bloquants marquent un champ ; un avertissement se
// lit dans le message du bloc. Hors validation (avant « Publier »), la liste est vide.

type ProblemesDuBloc = { problemes: Probleme[]; descriptionId?: string }

const Contexte = createContext<ProblemesDuBloc>({ problemes: [] })

export const ProblemesDuBlocProvider = Contexte.Provider

/** Attributs posés sur un champ de saisie : repère pour « aller au problème », état d'erreur. */
export type ChampProps = {
  'data-champ': string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

/** Attributs posés sur un groupe (liste de choix, d'étiquettes…) en erreur dans son ensemble. */
export type GroupeProps = { 'data-champ': string; 'data-invalide'?: 'true' }

/**
 * `champ(nom)` pour un champ de saisie (en erreur si lui ou un sous-champ l'est) ;
 * `groupe(nom)` pour un conteneur, en erreur seulement si le problème porte sur lui-même
 * (« coche une bonne réponse »), pas sur l'une de ses lignes.
 */
export function useChamp(): {
  champ: (nom: string) => ChampProps
  groupe: (nom: string) => GroupeProps
} {
  const { problemes, descriptionId } = useContext(Contexte)
  const bloquants = problemes.filter((p) => p.gravite === 'bloquant')
  return {
    champ: (nom) =>
      champEnErreur(bloquants, nom)
        ? { 'data-champ': nom, 'aria-invalid': true, 'aria-describedby': descriptionId }
        : { 'data-champ': nom },
    groupe: (nom) =>
      bloquants.some((p) => p.champ === nom)
        ? { 'data-champ': nom, 'data-invalide': 'true' }
        : { 'data-champ': nom },
  }
}

/** Marque visuelle d'un champ en erreur (à ajouter à sa classe). */
export const marqueChamp =
  'aria-[invalid=true]:rounded-sm aria-[invalid=true]:bg-danger/10 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'

/** Marque visuelle d'un groupe en erreur. */
export const marqueGroupe =
  'data-[invalide=true]:rounded-md data-[invalide=true]:ring-2 data-[invalide=true]:ring-danger'
