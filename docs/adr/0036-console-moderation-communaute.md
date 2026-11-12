# 0036 — Console de modération de la Communauté (v1)

- **Status**: Accepted
- **Date**: 2026-11-12
- **Deciders**: Gabrielle Clamaran
- **Suivi**: #338 (conditions avant d'ouvrir la Communauté), ADR 0035 (Communauté v1), ADR 0023 (socle de modération)

## Context

La Communauté v1 (ADR 0035) s'est construite sans modération, derrière le réglage
`brio.communaute.active` désactivé par défaut. L'ADR 0023 pose qu'aucun canal entre mineurs
ne s'ouvre à de vrais élèves sans file de signalements ni modérateur. L'épic #338 liste,
parmi les conditions d'ouverture, une **console de modération Brio** : aujourd'hui
`admin_brio` ne peut que régénérer un pseudonyme (#325).

L'entraide (ADR 0023) a déjà un socle de modération, mais il est **cloisonné à la classe** et
confié à l'enseignant : il ne convient pas à la Communauté, qui dépasse la classe et dont les
élèves apparaissent sous pseudonyme (#325) — un prof ne doit pas pouvoir agir dessus. Les
tables `communaute_questions`/`communaute_reponses` portent déjà une colonne `statut`
(`publie`/`masque`/`supprime`, V41), prête à accueillir la modération sans migration de rupture.
L'XP « réponse utile » (15 XP, ADR 0022/0035 §6) est attribuée par `progression` à l'écoute de
l'événement `ReponseUtileValidee`, mais rien ne permettait de la révoquer.

## Decision

Nous ajoutons une **console de modération réservée à `admin_brio`**, côté `social` (back) et
`web` (front), couvrant les quatre briques demandées par #338.

1. **Signalement (membre).** Un élève signale une **question** ou une **réponse** (commentaire
   inclus : c'est une réponse avec un parent). Table `social.communaute_signalements`
   (`cible_type ∈ {question, reponse}`, `cible_id`, `signale_par`, `motif`, `statut`), **un
   signalement par (cible, membre)**. Routes `POST /api/communaute/{questions|reponses}/{id}/signalement`
   (sous `brio.communaute.active`, rôle élève). Bouton « Signaler » sur chaque contenu qui n'est
   pas le sien.

2. **Décisions (admin).** `admin_brio` tranche sur une cible : **masquer** (`statut → masque`,
   contenu conservé pour restauration), **supprimer** (`statut → supprime`, corps effacé),
   **rejeter** (contenu laissé en ligne) ou **restaurer**. Chaque décision laisse une trace dans
   `social.communaute_decisions` (journal d'audit). Toute décision clôt les signalements ouverts
   de la cible. Un contenu `masque`/`supprime` disparaît des lectures élèves (réutilise le filtre
   `estVisible` existant).

3. **Contestation avec intervention humaine.** L'**auteur** d'un contenu masqué/supprimé conteste
   la **décision** (table `social.communaute_contestations`, une par décision). Un admin tranche :
   **accepter** restaure le contenu (décision `restaurer`) ou **rejeter** la laisse en place ; dans
   les deux cas une réponse est consignée. La console affiche le fil (contenu, décision, message).

4. **Révocation de l'XP « réponse utile ».** Nouvel événement `ReponseUtileRevoquee`
   (miroir de `ReponseUtileValidee`, même clé `source=entraide`, `source_ref=reponseId`), publié
   par `social` et consommé par `progression`, qui **supprime l'attribution et recadre le solde**,
   **idempotent** (sans attribution correspondante, sans effet). Action admin `revoquer_xp`, offerte
   sur une réponse marquée utile non encore révoquée.

5. **Rôle et gating.** Les routes admin vivent sous `/api/admin/communaute/**`, gardées
   `ADMIN_BRIO` dans `SecurityConfig` (comme `/api/admin/comptes/**`). Elles ne sont **pas**
   conditionnées par `brio.communaute.active` : traiter des signalements doit rester possible
   réglage coupé. L'espace web `/admin` a sa propre garde de rôle (miroir de `/prof`).

6. **Pseudonymat (#325).** La console n'affiche que le **pseudonyme** de l'auteur. Lever le
   pseudonyme (protocole de détresse) est hors v1 (différé par l'ADR 0035).

## Consequences

### Positive
- Les quatre briques « console de modération » de #338 sont livrées, testées, derrière un rôle
  déjà cloisonné — sans ouvrir la Communauté (le gate reste coupé).
- La révocation d'XP réutilise la mécanique d'attribution par événement : frontière Modulith nette,
  pas d'appel transverse synchrone, idempotence par la même clé.
- `masque` conserve le contenu : une décision contestée est réversible ; `supprime` reste définitif.

### Negative / trade-offs
- **Entrée membre de la contestation différée côté UI.** Un contenu masqué/supprimé disparaît des
  lectures de l'élève : l'endpoint de contestation existe et est testé, mais l'écran « mes contenus
  modérés » qui permettrait à l'auteur de le déclencher reste à faire (v2). La console admin, elle,
  affiche et tranche les contestations.
- La cible est **polymorphe** (`cible_type` + `cible_id`, pas de FK) : la cohérence est tenue par le
  service, pas par le schéma (cohérent avec les références cross-module par id, ADR 0007).
- Pas de classifieur IA ni de protocole de détresse : ce sont des conditions distinctes de #338,
  hors de cet ADR.

### Follow-ups (v2)
- Écran membre « contenus modérés » pour déclencher une contestation ; notification à l'auteur
  d'une décision.
- Supervision : audit consultable des décisions, compteurs, tri/priorisation de la file.
- Articuler avec le classifieur IA (pré-filtre → file) et le protocole de détresse (escalade,
  levée de pseudonyme encadrée) quand ces conditions de #338 seront traitées.
- Purge de rétention 12 mois (chantier distinct #338) : les tables de modération portent `created_at`.

## Alternatives considered

- **Réutiliser le socle d'entraide (prof modérateur).** Rejeté : cloisonné à la classe et confié au
  prof, qui ne doit pas agir sous le pseudonyme de la Communauté (#325, déjà écarté par l'ADR 0035).
- **XP révoquée via un drapeau sur la décision** plutôt qu'une action dédiée. Rejeté : une action
  `revoquer_xp` distincte garde le journal d'audit honnête et sépare visibilité du contenu et XP.
- **Suppression dure restaurable.** Rejetée : `supprime` efface le corps (demande de l'auteur,
  ADR 0035 §11) ; seul `masque` est restaurable. Accepter une contestation sur un contenu supprimé
  rouvre le statut mais ne ressuscite pas le corps.
