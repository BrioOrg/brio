# 0043 — Résoudre « compétence → leçon » à la volée sur le contenu publié

- **Status**: Accepted — signé par l’humain (Gabrielle) le 2026-11-17, porte 3 de #371
- **Date**: 2026-11-17
- **Deciders**: P2 Stratège produit, B1 Architecte technique, V2 Gardien des contrats, U1 Cartographe des parcours
- **Issue**: #371 (PL-2, épic #358)

## Context
#371 (PL-2) : la carte « À revoir » de l'Accueil mène à `/explorer` (≥ 4 clics, impasse sur une route chaude). Cible U1 : 1 clic vers `/{niveau}/{matiere}/{slug}?diapo=<sectionId>`. Aucun endpoint ne relie un code de compétence à un chapitre officiel et à une section ; `progression` ne sait pas où une compétence a été travaillée. Contrainte : élèves mineurs → ne pas créer de donnée par élève (ce serait N3).

## Decision
Ajouter `GET /api/referentiel/lecon?competence=&niveau=` dans `contenu`, calculé à chaque appel : exercices non retirés portant le code → chapitres publiés hors annales → priorité au niveau de l'élève, puis ordre du catalogue → première section `lesson` (ordre du document) dont un bloc `exercise` porte le code. Réponse 200 `LeconCompetence` ou 204 (le web masque alors le bloc). Aucune migration.

## Consequences
### Positive
- Aucune donnée nouvelle par élève ; réversible ; `sectionId` garanti présent dans le chapitre publié.
### Negative / trade-offs
- La règle existe en double (Java + faux backend e2e) ; un appel en série de plus sur l'Accueil.
- Si la compétence la plus faible n'est rattachable à aucune leçon, le bloc est masqué même si une autre compétence faible l'est (`competenceARevoir` hors périmètre).
### Follow-ups
- Viser l'exercice raté précis : ticket séparé, N3.
- Index GIN sur `exercices.competencies` si le catalogue change d'échelle.

## Alternatives considered
- **Table de projection `contenu.competence_lecons` remplie à l'ingestion (migration V45+)** — rejetée : état dupliqué ; le chemin SKIPPED de l'ingestion (hash inchangé) ne la remplirait pas sans backfill ; migration à ordonner après V43/V44 pour un volume (≈ 640 exercices) qui n'en a pas besoin.
- **Calcul côté web (catalogue + N chapitres lus par l'Accueil)** — rejeté : jusqu'à 45 lectures de chapitre par affichage, règle hors du backend, non réutilisable par Expo.
- **Requête jsonb pure (`jsonb_path` + `WITH ORDINALITY`)** — écartée : correcte mais plus dure à lire, tester et reproduire dans le faux backend.
- **Niveau déduit côté serveur (`identite.api`)** — écarté : le paramètre garde l'endpoint comme fonction pure du contenu, et l'Accueil lit déjà `CompteInfo.niveau`.

## Avis du conseil
- **P2** : accord. Tient les critères 1 à 5 ; reste N2 (lecture du contenu publié seulement) ; masquage conforme à la décision humaine du 17/11.
- **B1** : accord. Option la plus simple qui tient les critères, sans état à maintenir.
- **V2 Gardien des contrats** : accord sous conditions — openapi commité = sortie du backend ; clés Zod présentes dans la spec ; route du faux backend présente dans la spec ; 204 documenté (`@Content` vide) ; le faux backend ne renvoie rien de plus que le vrai ; exception `sectionId` de l'allowlist retirée ou re-justifiée.
- **U1** : accord. Budget 1 clic ; destination = id de section ; retour en 1 geste (Link + replaceState) ; routes voisines inchangées. Condition : e2e à 360 et 1280 px, titre de section visible, retour vers l'Accueil.
