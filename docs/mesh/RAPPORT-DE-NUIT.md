# Le rapport de nuit

> Mesh · Phase 2 · boucle « le produit, chaque nuit » du plan. Agents : **S2** joue les
> personas, **S3** sabote, **S4** assemble. Squelette : l'orchestration (cron, staging remis à
> zéro, pilotage du navigateur) est construite avec les phases suivantes ; ce qui existe ici,
> c'est le **format**, le **barème** et l'**assembleur**.

## Le déroulé d'une nuit

```
1. staging remis à zéro (snapshot connu)         ← L2 / scripts/env
2. S2 : chaque persona de mesh/personas/ joue ses tâches (arbre d'accessibilité)   → runs
3. S3 : le saboteur rejoue les tâches clés avec une attaque                        → runs
4. S4 : node scripts/mesh/nightly-report.mjs     → rapport.json + rapport.md
5. comparaison avec la nuit précédente
   ├─ rouge : régression → la PR fautive est rouverte, signal `mesh:inbox`
   └─ vert/orange : le résumé est joint à l'artefact CI
```

Garde-fou n°1 : **staging et CI seulement, jamais sur des données d'élèves réels.** Un run dont
`env` n'est pas `staging` ou `ci`, ou qui contient une adresse e-mail, est refusé.

## Entrée : le run

Un fichier JSON par (persona ou attaque) × tâche — [`mesh/nuit/run.schema.json`](../../mesh/nuit/run.schema.json).
Les `tache` sont celles de [`mesh/routes/tasks.json`](../../mesh/routes/tasks.json) et chaque run
embarque le `budget` de la tâche au moment du jeu.

| | S2 · persona (`kind: persona`) | S3 · saboteur (`kind: sabotage`) |
|---|---|---|
| `resultat` | `reussi` · `echec` · `abandon` | `tenu` (l'appli résiste) · `casse` |
| `attaque` | — | `retour-arriere` · `double-clic` · `session-expiree` · `triche` · `saisie-hostile` · `connexion-lente` |
| `clics` | requis si `reussi` | — |
| `etapes[]` | ce que l'acteur a fait, dans l'ordre, nommé comme l'arbre d'accessibilité | idem |
| `frictions[]` | `impasse` · `triche-acceptee` · `erreur` · `a11y` · `ambigu` · `detour` · `lent` + `route` + `detail` | idem |

Les `etapes` servent à deux choses : c'est la **reproduction** du ticket que S4 ouvre, et c'est
ce qui permet à U1/S1 de comprendre *où* l'acteur s'est perdu.

## Sortie : le rapport

`scripts/mesh/nightly-report.mjs --runs <dossier> [--previous rapport-veille.json] [--tasks mesh/routes/tasks.json]`
produit `rapport.json` (machine) et `rapport.md` (humain). Structure du Markdown :

1. **Verdict** 🟢 vert · 🟠 orange · 🔴 rouge, commit, environnement, score de friction, écart avec la veille.
2. **Tâches clés** : réussite, clics médians vs budget, runs hors budget, sabotages cassés, score.
3. **Tâches non jouées** (présentes dans `tasks.json`, absentes de la nuit) et **taux de réussite en baisse**.
4. **Frictions** : une ligne par friction distincte (clé `type|route|tâche`), 🆕 si absente la veille.
5. **Tickets à ouvrir** : une section par friction nouvelle ou bloquante, avec les étapes pour la reproduire.

Exemple rendu : [`mesh/nuit/exemple/rapport.md`](../../mesh/nuit/exemple/rapport.md), calculé
sur des runs **synthétiques** (`"synthetique": true`) qui n'ont aucune valeur de mesure.

## Le barème

Score d'un run (plus bas = mieux) :

| Événement | Points |
|---|---:|
| tâche en `echec` / sabotage `casse` | 10 |
| tâche en `abandon` | 8 |
| chaque clic au-delà du budget (tâche réussie) | 2 |
| friction `triche-acceptee` | 6 |
| friction `impasse` | 5 |
| friction `erreur` | 4 |
| friction `a11y` | 3 |
| friction `ambigu` | 2 |
| friction `detour`, `lent` | 1 |

Le **score global** est la moyenne des runs. Les poids vivent dans `scripts/mesh/lib/nightly-report.mjs`
(`FRICTION_WEIGHTS`) : les changer est une décision N2 (le score se compare d'une nuit à l'autre).

## Les règles de verdict

- **🔴 rouge** si : une `impasse` ou une `triche-acceptee` est relevée, un sabotage `casse`,
  *ou* il y a **régression** par rapport à la veille.
- **Régression** = score global en hausse de plus de **0,5** (marge de bruit), *ou* une nouvelle
  impasse / triche acceptée, *ou* le taux de réussite d'une tâche qui baisse.
- **🟠 orange** si des frictions mineures subsistent sans régression ; **🟢 vert** sinon.
- Le script sort en code **1** quand le verdict est rouge, **2** quand les runs sont invalides.

> Le rouge sans régression (une impasse déjà connue) ne rouvre pas de PR : il reste visible
> chaque nuit jusqu'à correction. Seule la **hausse** rouvre la PR (plan, boucle « le produit »).

## Ce qui reste à construire

- L'orchestration de nuit (cron, remise à zéro de staging, lancement de S2/S3) et son workflow `mesh-nuit.yml`.
- Le pilote S2 : un agent par persona, qui joue via l'arbre d'accessibilité et écrit ses runs.
- La conservation du `rapport.json` de la veille (artefact CI ou `mesh/nuit/rapports/`).
- L'ouverture automatique des tickets `mesh:inbox` depuis la section « Tickets à ouvrir ».
