import { MessagerieError } from '@brio/api-client'

const FORMAT_HORODATAGE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "7 oct., 10:00" — when a message was written. */
export function horodatage(iso: string): string {
  return FORMAT_HORODATAGE.format(new Date(iso))
}

/** The French copy to show for a failed messagerie call. */
export function messageErreur(e: unknown, repli: string): string {
  return e instanceof MessagerieError ? e.message : repli
}
