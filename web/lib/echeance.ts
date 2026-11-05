// Paris time, so the date a student reads doesn't depend on their device's time zone.
const DATE_ECHEANCE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
})

/** A homework's due date as a student reads it ("3 octobre"); the raw value if unparseable. */
export function formatEcheance(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE_ECHEANCE.format(date)
}
