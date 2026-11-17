---
description: Hygiène de branche, de PR et de garde-fous tirée de la rétro PL-4 (porte 8, #358)
alwaysApply: true
---

# Hygiène du mesh — ce que la rétro PL-4 a appris

Chaque règle ci-dessous vient d'un défaut réellement échappé sur #364/#365
(`docs/mesh/lecons/2026-11-pl4.md`). Elle s'applique à tout agent qui construit, vérifie
ou livre, et à l'humain qui pilote une session.

## Avant chaque push (constructeurs B1–B5, et toute session)

Lancer en local, depuis la racine, et coller la sortie dans la PR :

```bash
for f in scripts/mesh/__tests__/*.test.mjs; do node --test "$f" || exit 1; done
node scripts/mesh/route-budget.mjs --base origin/develop
node scripts/mesh/check-numerotation.mjs --base origin/develop --open-prs
```

- Les tests du mesh lancés **fichier par fichier** : un échec désigne le fichier.
- `route-budget` dès qu'une route est créée, supprimée, ou n'est atteinte **que par
  redirection** (la déclarer dans `attendus.horsNavigation` de `mesh/routes/tasks.json`).
- Après `git merge origin/develop`, relancer ces trois commandes : une branche verte seule
  peut être rouge une fois assemblée.

## Numéros d'ADR et de migrations

- Le numéro d'un ADR (`docs/adr/NNNN-…`) ou d'une migration (`V<n>__…`) est **réservé dans
  l'issue** (plan technique, B1 ; consigné par P3) **avant** d'écrire le fichier, après
  `check-numerotation --open-prs`. « Le numéro suivant » sur sa branche n'est pas une réservation.
- Une migration n'est jamais en dessous de la plus haute version de `develop` (Flyway la
  refuse) ; l'ordre de merge de deux PR à migrations est écrit dans les deux PR.

## Pull request

- Le corps contient `Closes #<issue>` — **en anglais** : GitHub ne reconnaît ni « Ferme »
  ni « Corrige ». Vérifier après création :
  `gh pr view <n> --json closingIssuesReferences` ne doit pas être vide.
- Formater **les fichiers modifiés seulement** (`pnpm exec prettier --write <fichiers>`),
  jamais un glob : un reformatage hors sujet pollue le diff et la revue.
- Un merge de `develop` dans la branche garde le message par défaut de git
  (`Merge remote-tracking branch …`) ; le hook `commit-msg` l'accepte.

## Ce que l'écran promet

- Chaque phrase d'un écran qui affirme un fait (durée, usage unique, qui fait quoi, ce qui
  est conservé) cite **le fichier et la ligne** qui la rendent vraie, dès la spec (porte 2).
  Sans source, la phrase est retirée ou le backend est construit d'abord. Un lien vers un
  flux existant est vérifié pour ce qu'il **fait** (crée-t-il un compte ? un code
  multi-usage ?), pas pour son nom.

## Garde-fous du mesh

- Un job, script ou réglage du mesh n'est **livré** qu'après une exécution réelle sur un cas
  qui le déclenche (lien vers le run, ou sortie locale avec la même version d'outil que la CI).
  « Valide en YAML » ne suffit pas : un job conditionné par des chemins doit être déclenché
  exprès une fois.

## Tests instables

- Un test relancé jusqu'au vert n'est jamais silencieux : ticket `mesh:inbox` avec le nom du
  test, le run, le nombre d'échecs observés. Jamais `retries` relevé ni `.skip` (V3).

## Branche protégée

- « Aucun push sur `develop` » n'est tenu aujourd'hui que par `.githooks/pre-push`, local et
  contournable (`--no-verify`, clone sans `scripts/setup.sh`). Ne jamais le contourner ;
  la protection côté GitHub est une décision humaine (N3).
