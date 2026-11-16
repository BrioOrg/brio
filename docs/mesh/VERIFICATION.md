# Porte 5 — Vérification (Phase 3 du mesh)

> Épic #358 · plan de référence : [`PLAN-AGENT-MESH.md`](PLAN-AGENT-MESH.md).
> **Preuve que c'est fait** (plan, Phase 3) : *une revue consolidée par PR, mutation et
> contrats en CI.*

Ce document décrit comment les six gardiens (V1–V6) et l'ingénieur de tests (B5) rendent
**un seul verdict par PR**, et comment la CI y ajoute trois contrôles déterministes : la
**mutation**, les **tests affaiblis** et la **dérive des contrats**.

## Vue d'ensemble

```
PR ouverte / mise à jour (base : develop)
  │
  ├─ contracts ........ check-contract-drift.mjs ............ verdict-V2.json
  ├─ weakened-tests ... detect-weakened-tests.mjs ........... verdict-V3-weak.json
  ├─ mutation ......... PIT (backend) + Stryker (web) ....... verdict-V3-mutation.json
  ├─ agents (éteints) . V1 · V4 · V5 · V6 (claude-code-action) verdict-V1/V4/V5/V6.json
  │
  └─ consolidate ...... aggregate-verdicts.mjs  →  UN commentaire de PR (mis à jour à chaque push)
                       + step summary · échec du check seulement si un gardien d'autonomie ≥ 2 a un veto
```

Fichiers :

| Fichier | Rôle |
|---|---|
| `.claude/agents/V1…V6-*.md`, `B5-ingenieur-tests.md` | fiches des 7 agents |
| `.github/workflows/mesh-verification.yml` | orchestration + commentaire consolidé |
| `.github/workflows/mesh-mutation.yml` | PIT + Stryker sur les fichiers modifiés (appelé par le précédent) |
| `scripts/mesh/verification/aggregate-verdicts.mjs` | agrège les verdicts en un commentaire |
| `scripts/mesh/verification/check-contract-drift.mjs` | dérive des contrats (V2) |
| `scripts/mesh/verification/detect-weakened-tests.mjs` | alerte « test affaibli » sur le diff (V3) |
| `scripts/mesh/verification/mutation-to-verdict.mjs` | rapports PIT/Stryker → verdict V3 |
| `scripts/mesh/verification/changed-java-classes.sh` | classes Java modifiées → cibles PIT |
| `scripts/mesh/verification/__tests__/*.test.mjs` | tests des scripts (`node --test scripts/mesh/verification/__tests__/*.test.mjs`) |
| `mesh/verification/verdict.schema.json` | contrat « Rapport de vérification » |
| `mesh/verification/config.json` | autonomie par gardien, seuils et références de mutation (**décision humaine**) |
| `mesh/verification/contract-allowlist.json` | exceptions motivées du contrôle de contrats |
| `mesh/mutation/stryker.web.config.mjs` | configuration Stryker |
| `backend/pom.xml` (profil `mutation`) | PIT, hors build par défaut |

## Le contrat « Rapport de vérification »

Chaque gardien écrit `verdict-<ID>.json` (schéma : `mesh/verification/verdict.schema.json`) :

```json
{
  "guardian": "V2",
  "name": "Gardien des contrats",
  "verdict": "veto",
  "summary": "1 dérive bloquante.",
  "findings": [
    {
      "severity": "blocking",
      "file": "packages/api-client/src/salons.ts",
      "line": 88,
      "rule": "frontend.md · contrat OpenAPI",
      "message": "Le client appelle `/api/salles`, route absente de docs/api/openapi.json.",
      "fix": "Aligner le client sur le backend, ou régénérer la spec (`pnpm api:refresh`)."
    }
  ]
}
```

- **Gravité** : `blocking` (le motif de veto du gardien) > `important` > `suggestion`.
- **Verdict** : `veto` ⇔ au moins un `blocking`, `advisory` s'il n'y a que des constats moins
  graves, `pass` sinon. L'agrégateur **recalcule** le verdict : un rapport incohérent est signalé.
- **Pas de preuve, pas de constat** : `fichier:ligne` (ou au moins `file`) est attendu ; un rapport
  illisible ou non conforme est affiché comme tel (jamais traité comme un « ok »), et un gardien
  qui n'a pas rendu de rapport apparaît « ⏳ non exécuté » — l'absence de verdict n'est pas un feu vert.

### Motif de veto par gardien

| Gardien | Veto = constat `blocking` quand… |
|---|---|
| V1 Relecteur de code | bug avéré, faille, frontière Modulith violée, règle du dépôt enfreinte |
| V2 Gardien des contrats | un appelant cible une route/un champ que la spec ignore, ou spec ≠ backend réel |
| V3 Contrôleur des tests | un test existant est affaibli, désactivé ou supprimé ; score de mutation sous la référence |
| V4 Correcteur pédagogique | réponse, énoncé ou correction fausse/ambiguë, contenu hors niveau |
| V5 Gardien sûreté et mineurs | risque pour un mineur : donnée inventée/fuitée, modération contournée, tuteur sans éval |
| V6 Contrôleur visuel | écart au kit Arcade : valeur hors tokens, thème sombre cassé, débordement à 360 px |

## Autonomie : un veto ne bloque pas avant d'avoir été mérité

Règle du plan : tout agent démarre à **0 · observateur** — il commente sans bloquer. Donc :

- niveau 0–1 : le veto est **affiché** (« ⛔ veto (consultatif) ») mais le check reste vert ;
- niveau ≥ 2 (`enforceFromAutonomy`) : le veto **fait échouer** le job `consolidate`.

Les niveaux vivent dans `mesh/verification/config.json`. Les changer est une **décision humaine**
(A2 les propose, l'humain merge). Pour que le check puisse devenir *obligatoire* dans GitHub,
l'humain l'ajoute aux checks requis de `develop` (réglage du dépôt, hors de ce lot).

> **Sécurité.** Le job `consolidate` (qui a `pull-requests: write`) exécute les scripts et la
> configuration de la **branche de base**, pas ceux de la PR : une PR ne peut pas relever un seuil
> ou baisser l'autonomie d'un gardien pour se dédouaner. Conséquence : tant que ces fichiers ne sont
> pas sur `develop`, le job saute l'agrégation (la PR qui les introduit n'a pas de commentaire).
> Les PR de forks n'ont pas de jeton d'écriture : leur revue n'apparaît que dans le step summary.

## Mutation testing

*Un test qui ne casse jamais n'est pas une preuve.* La mutation introduit de petits défauts dans le
code (`<` → `<=`, `return x` → `return 0`…) et vérifie que **au moins un test échoue**.

| Pile | Outil | Périmètre | Où |
|---|---|---|---|
| Backend | **PIT** 1.25.9 (+ `pitest-junit5-plugin`) | classes Java modifiées par la PR ; tests unitaires uniquement | profil Maven `mutation` |
| Web | **Stryker** 9.4.0 (runner Vitest) | `web/lib/**` et `packages/api-client/src/**` modifiés ; pas les composants | `mesh/mutation/stryker.web.config.mjs` |

Exécution locale :

```bash
# Backend — une classe
cd backend && ./mvnw -B -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage \
  -Dpit.targetClasses=fr.brio.progression.domain.Niveau -Dpit.targetTests='fr.brio.progression.*'
# rapport : backend/target/pit-reports/index.html (+ mutations.xml)

# Web — un fichier
cd web && pnpm dlx --package @stryker-mutator/core@9.4.0 --package @stryker-mutator/vitest-runner@9.4.0 \
  stryker run ../mesh/mutation/stryker.web.config.mjs --mutate "lib/progression.ts"
# rapport : web/reports/mutation/index.html
```

**Seuil et alerte « test affaibli »** (`mesh/verification/config.json › mutation`), jugés par
`mutation-to-verdict.mjs` — jamais par PIT/Stryker eux-mêmes, pour que la politique reste humaine :

| Situation | Constat |
|---|---|
| chaque mutant survivant ou non couvert | `important`, au `fichier:ligne` du mutant |
| score < `threshold` (50 % au départ) | `important` |
| score < `baseline` − `tolerance` | **`blocking` — alerte « test affaibli »** : la suite détecte moins de défauts qu'avant |

`baseline` est `null` au démarrage : **la première mesure sert à la fixer** (décision humaine, avec A3
pour l'inscrire). Elle ne se baisse jamais pour « faire passer » une PR.

**En complément, un détecteur de tests affaiblis sur le diff** (`detect-weakened-tests.mjs`, sans
exécuter les tests) : `blocking` pour un test désactivé (`@Disabled`, `.skip`, `xit`, `test.fixme`…),
un fichier de test supprimé, un cas de test en moins, un seuil baissé ; `important` pour des
assertions en moins, une assertion exacte remplacée par une plus faible, une tolérance / un timeout /
des `retries` relevés. C'est une **alerte** : V3 la juge contre les critères d'acceptation (un test
légitimement modifié parce que le critère a changé est accepté par V3, pas par le script).

> **Nouvelle bibliothèque.** Stryker passe par `pnpm dlx` et non en `devDependency`, pour ne pas
> toucher `pnpm-lock.yaml` avant validation (règle du dépôt : toute nouvelle bibliothèque a sa
> justification). Justification : seul moyen automatique de savoir si les tests *détectent* quelque
> chose ; `jacoco`/couverture de lignes ne le dit pas. Quand le premier run est concluant, la promotion
> en `devDependency` + un ADR (N2, nouvelle dépendance → P3) sont à ouvrir par l'humain.

## Dérive des contrats

Quatre représentations d'une même API doivent dire la même chose :

| | Représentation | Sert à |
|---|---|---|
| 1 | `docs/api/openapi.json` | contrat de référence, **régénéré** depuis le backend (`pnpm api:refresh`) |
| 2 | `packages/api-client/src/*.ts` (Zod) et `web/lib/*.ts` | ce que le front croit que l'API fait |
| 3 | `web/e2e/fake-backend.mjs` | ce que les e2e simulent (ne doit renvoyer que ce que le vrai backend renverrait) |
| 4 | vrai backend (`/v3/api-docs`) | la vérité ; déjà gardée par `OpenApiContractTest` |

`check-contract-drift.mjs` (sans dépendance, instantané) détecte :

| Dérive | Gravité |
|---|---|
| le client appelle une route absente de la spec | blocking |
| contrat documenté (`GET /api/x` dans l'en-tête d'un wrapper) dont la méthode manque dans la spec | blocking |
| le faux backend sert une route que la spec ignore | blocking |
| spec committée ≠ sortie réelle du backend (`--actual backend/target/openapi-actual.json`) | blocking |
| clé d'un `z.object()` introuvable dans tout schéma OpenAPI (renommage non répercuté) | important |

Exceptions : `mesh/verification/contract-allowlist.json`, **chaque entrée avec une raison** (sans quoi
elle est refusée). Elle contient aujourd'hui les routes Spring Security (`/api/sessions`) et les corps
de réponse que springdoc ne décrit pas (`{ error }`, `ContentViolation`…) — qui sont aussi des trous
de la spec à combler.

**Limites assumées (ébauche)** : comparaison de **chemins, méthodes et noms de propriétés** seulement ;
pas encore des types, du caractère obligatoire, des codes de statut, ni des formes de réponse du faux
backend. Étape suivante : générer les types depuis la spec (`pnpm generate:api`) et faire échouer
`tsc` sur un wrapper Zod qui diverge ; rejouer les réponses du faux backend contre le schéma.

## À brancher ensuite (hors de ce lot)

- App GitHub Claude sur `BrioOrg` + variable `MESH_AGENTS_ENABLED=true` + secret : allume V1/V4/V5/V6.
- V6 : script Playwright de captures 360/768/1280 px clair/sombre (artefact + comparaison au styleguide).
- V5 : déclenchement conditionnel du run d'éval du tuteur (`-Peval`) — décision de coût, humaine.
- B5 : garde-fou mécanique « ne lit pas l'implémentation » (hook `PreToolUse` sur ses chemins de lecture).
- CODEOWNERS : ajouter `/mesh/verification/**` et `/mesh/mutation/**` (propriété humaine des seuils).
- Checks requis de `develop` : `Mesh · Vérification / consolidate` une fois le premier gardien à l'autonomie 2.
