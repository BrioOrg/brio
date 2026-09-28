/** Per-session request cap for the chapter tutor when TUTEUR_REQUEST_CAP is unset. */
export const DEFAULT_TUTOR_REQUEST_CAP = 20

/**
 * The tutor's per-session request cap, read on the server at request time so it can
 * change with a restart rather than a rebuild (ADR 0024 §4). Pages pass it down to
 * the client through ChapterInteractionProvider.
 */
export function tutorRequestCap(): number {
  return Number(process.env.TUTEUR_REQUEST_CAP) || DEFAULT_TUTOR_REQUEST_CAP
}
