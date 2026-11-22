# 0048 — Stryker en devDependency de web/, lancé depuis la racine

- **Status**: Accepted
- **Date**: 2026-11-22
- **Deciders**: l'humaine (demande explicite de réparer le job, #372), Claude

## Context

Le job `mutation / web` (`.github/workflows/mesh-mutation.yml`, phase 3 du mesh, #358) n'a jamais
abouti : il échouait sur toute PR touchant `web/lib` ou `packages/api-client`. Stryker passait par
`pnpm dlx` pour éviter d'ajouter une bibliothèque avant validation (`docs/mesh/VERIFICATION.md`).
Trois défauts, reproduits en local (#372) :

1. `dlx` installe le **dernier** Vitest (5.x, Vite 8), qui ne fait pas tourner la suite du dépôt
   (Vitest 2.1) : « Failed to start threads worker ».
2. Lancé depuis `web/`, Stryker ne voit aucun fichier hors de `web/` : **0 mutant** pour
   `packages/api-client`, qui n'a pas de tests à lui et est couvert par la suite web via l'alias
   `@brio/api-client` (`../packages/...`).
3. Le bac à sable de Stryker copie `web/` ailleurs : l'alias `../packages/...` n'y pointe plus sur
   rien, et les tests qui importent `@brio/api-client` échouent dès le premier passage.

## Decision

Nous installons `@stryker-mutator/core` et `@stryker-mutator/vitest-runner` **9.4.0** (version déjà
documentée ; pair `vitest >=2.0.0`) en **devDependencies de `web/`**, et nous lançons Stryker
**depuis la racine, en place** (`inPlace: true`), projet restreint à `web/` et `packages/`.
`web/vitest.config.ts` fixe `root: __dirname` pour que la suite tourne pareil quel que soit le
répertoire de lancement.

## Consequences

### Positive
- Stryker pilote le Vitest **du dépôt** : la version suit le lockfile, plus de dérive.
- `web/lib` et `packages/api-client` sont mutés tous les deux ; les constats portent les vrais
  chemins du dépôt (`packages/api-client/src/session.ts:91`).
- Vérifié en local : `web/lib/revoir.ts` + `packages/api-client/src/session.ts` → 98 mutants, score
  70,4 %, verdict V3 produit par `mutation-to-verdict.mjs`.

### Negative / trade-offs
- `pnpm-lock.yaml` grossit (~1 000 lignes, outillage de dev seulement, rien dans le bundle).
- `vitest.related: false` : depuis la racine, Vitest ne relie pas les fichiers mutés à leurs tests ;
  le passage initial prend toute la suite web (~40 s), la couverture `perTest` resserre ensuite
  chaque mutant sur ses tests. Un run de deux fichiers dure ~4 min.
- En place, Stryker modifie le checkout pendant le run et le restaure à la fin : à lancer sur un
  arbre propre, en local.

### Follow-ups
- Fixer `baseline` dans `mesh/verification/config.json` à partir des premières mesures réelles
  (décision humaine, `VERIFICATION.md` §Mutation).

## Alternatives considered

- **Garder `dlx` en épinglant Vitest** (`--package=vitest@2.1.x`) — `dlx` installe un arbre à part :
  Vitest y tournerait sans les plugins ni la config résolus du dépôt, et les défauts 2 et 3 restent.
- **Une config Stryker dans `packages/api-client`** — le paquet n'a ni Vitest ni tests propres ; il
  faudrait dupliquer la suite web ou lui en écrire une.
- **`continue-on-error` sur le job** — cache le rouge sans rien mesurer ; V3 n'aurait toujours aucun
  verdict web.
