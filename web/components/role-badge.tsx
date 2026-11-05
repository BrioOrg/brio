/**
 * The role of the logged-in account, shown in the top bar (#285): « Élève », « Enseignant » or,
 * for the administration accounts (#312), « Admin » / « Admin Brio ». It always reflects the
 * `role` the backend returned from /api/moi — the caller passes it in, this component never
 * infers it from the page or the URL. A role it has no wording for (one added later) renders
 * nothing rather than a guess.
 *
 * The visible word is short to fit the mobile bar; screen readers get the full phrase. It is
 * text, not a colour code, on a neutral pill readable in both themes.
 */
const LIBELLES = new Map<string, { court: string; complet: string }>([
  ['eleve', { court: 'Élève', complet: 'Compte élève' }],
  ['enseignant', { court: 'Enseignant', complet: 'Compte enseignant' }],
  ['admin_etab', { court: 'Admin', complet: "Compte administrateur d'établissement" }],
  ['admin_brio', { court: 'Admin Brio', complet: 'Compte administrateur Brio' }],
])

export function RoleBadge({ role }: { role: string }) {
  const libelle = LIBELLES.get(role)
  if (!libelle) return null

  return (
    <span
      data-testid="role-badge"
      className="shrink-0 rounded-full border border-line bg-surface-page px-2 py-0.5 font-display text-xs font-extrabold text-ink"
    >
      <span className="sr-only">{libelle.complet}</span>
      <span aria-hidden="true">{libelle.court}</span>
    </span>
  )
}
