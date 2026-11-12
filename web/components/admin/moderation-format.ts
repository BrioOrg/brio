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
