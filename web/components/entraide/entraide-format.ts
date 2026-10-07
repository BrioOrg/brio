import { EntraideError } from '@brio/api-client'

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "7 oct., 10:00" — when a thread or a message was written. */
export function dateCourte(iso: string): string {
  return FORMAT_DATE.format(new Date(iso))
}

/** The French copy to show for a failed entraide call. */
export function messageErreur(e: unknown, repli: string): string {
  return e instanceof EntraideError ? e.message : repli
}
