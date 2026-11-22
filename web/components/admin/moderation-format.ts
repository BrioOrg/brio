import { ModerationError } from '@brio/api-client'

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "7 nov., 10:00" — quand un signalement ou une contestation a été écrit. */
export function dateCourte(iso: string): string {
  return FORMAT_DATE.format(new Date(iso))
}

/** Le texte français à montrer pour un appel de modération échoué. */
export function messageErreur(e: unknown, repli: string): string {
  return e instanceof ModerationError ? e.message : repli
}

/** Libellé lisible d'un statut de contenu. */
export function libelleStatut(statut: string | null | undefined): string {
  switch (statut) {
    case 'publie':
      return 'En ligne'
    case 'masque':
      return 'Masqué'
    case 'supprime':
      return 'Supprimé'
    default:
      return statut ?? 'inconnu'
  }
}

/** Libellé lisible d'une action de modération (journal, contestations). */
export function libelleAction(action: string | null | undefined): string {
  switch (action) {
    case 'masquer':
      return 'masqué'
    case 'supprimer':
      return 'supprimé'
    case 'rejeter':
      return 'signalement rejeté'
    case 'restaurer':
      return 'restauré'
    case 'revoquer_xp':
      return 'XP révoquée'
    default:
      return action ?? 'inconnue'
  }
}

/** Ce que la console annonce (role="status") après une décision. */
export function annonceDecision(action: string): string {
  switch (action) {
    case 'masquer':
      return 'Contenu masqué.'
    case 'supprimer':
      return 'Contenu supprimé.'
    case 'rejeter':
      return 'Signalement rejeté : le contenu reste en ligne.'
    case 'restaurer':
      return 'Contenu restauré.'
    case 'revoquer_xp':
      return 'XP révoquée. Le contenu reste dans la file.'
    default:
      return 'Décision enregistrée.'
  }
}
