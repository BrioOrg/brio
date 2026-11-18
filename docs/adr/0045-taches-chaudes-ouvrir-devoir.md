<!-- mesh:contrat=decision-conseil v1 -->
# 0045 — Deux tâches chaudes pour ouvrir le contenu d'un devoir depuis l'Accueil

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Conseil N2 du mesh — P2 (stratège produit) · B1 (architecte technique) · U1
  (cartographe des parcours, gardien des routes chaudes) — arbitrage humain (Gabrielle,
  2026-11-17) — ticket PL-1 (#370). Consigné par P3 (greffier), qui ne ratifie pas.

> **Numérotation.** Déposé d'abord sous 0038, renuméroté **0045** le 2026-11-18 pour éviter
> une collision : au 2026-11-18, `develop` porte 0036, 0037, 0040 et 0042 ; les PR ouvertes
> réclament 0038 (#394), 0039 (#390), 0041 (#393), 0043 (#376) et 0044 (#357).
>
> **Statut.** Le conseil N2 a tranché avec l'accord de l'humaine ; l'ADR passe en `Accepted`
> au merge de la PR de PL-1 qui porte les deux lignes de `mesh/routes/tasks.json`.

## Context

**Signal.** Ticket PL-1 du premier lot (`docs/mesh/PREMIER-LOT.md`, doctrine « impasses
d'abord »), issue #370, sous l'épopée #358. Tâche clé « Ouvrir le devoir du jour » mesurée
« 2 à ∞ » clics pour une cible de 1, état **impasse**.

**Constat (base `b747a2f`).**

- Sur l'Accueil `/`, chaque carte du bloc « Pour ta classe » (au plus 3 devoirs ni rendus ni
  corrigés) pointe vers `/ma-classe`, quel que soit le devoir (`web/app/(app)/page.tsx:107`).
- Deux sources de devoir seulement : `cours` et `chapitre` (`V28__devoirs_schema.sql`).
  L'interface prof ne crée que des devoirs `cours` (`web/components/prof/creer-devoir.tsx:113`) :
  c'est le cas majoritaire en usage réel.
- Dans Ma classe › À faire, un devoir `cours` n'a **aucun lien** vers son contenu
  (`web/components/devoirs-eleve.tsx:54`), alors que `/cours/[coursId]` existe. Chemin réel :
  3 clics par l'onglet « Cours du prof », et **impasse** si le cours n'est pas porté à la classe.
- Un devoir `chapitre` s'ouvre en 2 clics (carte → Ma classe → « Ouvrir le chapitre »).

**Contrainte : le budget de clics.** `mesh/routes/tasks.json` (propriétaire U1) déclare les
tâches clés ; le moteur `node scripts/mesh/route-budget.mjs --base origin/develop` vérifie en
CI qu'une tâche `chaude: true` tient son budget, et qu'un budget chaud n'est jamais relevé sans
décision U1 + humain. Aucune tâche ne couvrait « ouvrir le contenu de mon devoir » : rien
n'empêchait l'impasse de revenir. Déclarer une tâche chaude relève d'un **conseil N2**
(fiche besoin P2 et spec de parcours U1 sur #370). Pas de N3 : aucune donnée de mineur
nouvelle, aucun backend, aucun coût.

**Limite du moteur statique.** `linksIn` (`scripts/mesh/lib/route-graph.mjs`) ne compte comme
arête qu'une **chaîne littérale commençant par `/`** dans la clôture d'imports d'une page. Un
`href={variable}`, une concaténation ou un gabarit qui commence par `${…}` sont invisibles.

## Options

1. **Deux tâches chaudes, budget 1** (une par arrivée : `/cours/[coursId]` et
   `/[niveau]/[matiere]/[slug]`). Conséquences : la tâche cours échoue aujourd'hui (2 > 1) et
   devient un cliquet CI dès que le lien littéral existe ; la tâche chapitre est déjà à 1 pour
   le moteur (arête fournie par « Continuer ») et ne distingue rien. Les deux lignes doivent
   entrer dans la **même PR que le code**, sinon la CI rougit.
2. **Deux tâches `chaude: false`** (N1, repli proposé par U1 et B1). Conséquences : la
   tâche figure dans la carte des routes, mais une régression du lien de la carte ne bloque
   pas la CI ; l'impasse peut revenir sans alerte.
3. **Ne rien ajouter à `tasks.json`.** Conséquences : PL-1 se prouve par Vitest et e2e
   seulement ; aucune protection durable du budget de 1 clic ; la tâche clé du premier lot
   reste absente de la carte des routes.

## Decision

Option 1. Les deux lignes suivantes sont ajoutées à `mesh/routes/tasks.json`, juste après
`eleve-cours-du-prof`, **dans la PR de PL-1** (avec le code qui crée le lien) :

```json
{ "id": "eleve-ouvrir-devoir-cours", "label": "Ouvrir le cours de mon devoir", "persona": "eleve", "chaude": true, "arrivee": "/cours/[coursId]", "budget": 1, "cible": 1 },
{ "id": "eleve-ouvrir-devoir-chapitre", "label": "Ouvrir le chapitre de mon devoir", "persona": "eleve", "chaude": true, "arrivee": "/[niveau]/[matiere]/[slug]", "budget": 1, "cible": 1 }
```

Aucun budget existant n'est relâché. Raison : la tâche cours couvre l'impasse réelle (cas
majoritaire) et la verrouille en CI ; la tâche chapitre déclare la tâche clé pour l'autre
source, sa preuve étant portée par les tests unitaires.

Décisions associées, tranchées au même conseil (#370, commentaire « Décision · conseil N2 ») :

- **Critère 1 (devoir `chapitre`) prouvé par Vitest**, pas en e2e : le faux backend
  (`web/e2e/fake-backend.mjs`) ne sert pas `/api/catalogue`.
- **Séquencement** : PL-1 (#370) avant PL-2 (#371), qui touchent les mêmes fichiers
  (`web/app/(app)/page.tsx` et son test, `tasks.json`, `fake-backend.mjs`).
- Décision N1 de U4 retenue : « Ouvrir le cours » aussi sur les devoirs terminés.

## Avis des membres du conseil

- **P2 (stratège produit) — accord.** La fiche besoin (#370) classe le ticket « Haute,
  impasse sur une route chaude » et **propose à U1** une tâche chaude « Ouvrir le contenu de
  mon devoir » à budget 1, avec une arrivée par source. N'a pas refusé la tâche chapitre
  prouvée par Vitest seul (condition du repli `chaude: false` posée par B1).
- **B1 (architecte technique) — accord, avec réserve sur la tâche chapitre.** Tâche cours :
  corrige l'impasse réelle, « cliquet voulu ». Tâche chapitre : non discriminante pour le
  moteur, sa preuve est Vitest ; repli `chaude: false` si P2 refuse une tâche chaude prouvée
  par Vitest seul. Pas d'ADR technique (aucun module, API ni migration touchés). Signale le
  risque de cliquet si un futur refactor écrit le `href` en variable, et l'absence du
  catalogue dans le faux backend (critère 1 non prouvable en e2e).
- **U1 (cartographe, gardien des routes chaudes) — accord, pas de veto.** Auteur des deux
  lignes. Simulation sur copie : aucune route chaude voisine allongée
  (`eleve-devoirs-a-faire` 1/1, `eleve-cours-du-prof` 2/2, `eleve-reprendre-chapitre` 1/1,
  `eleve-ouvrir-chapitre` 2/2) ; `eleve-ouvrir-devoir-cours` passe de 2 à 1. Maintient le N2
  pour la déclaration de deux tâches `chaude: true` ; repli `chaude: false` jugé déconseillé.

**Arbitrage humain (Gabrielle, 2026-11-17)** : option 1 validée, avec la preuve du critère 1
par Vitest, un ticket `chore` séparé pour le catalogue du faux backend, et PL-1 avant PL-2.

## Consequences

### Positive
- L'impasse des devoirs `cours` est fermée et **gardée par un cliquet CI** :
  `eleve-ouvrir-devoir-cours` échoue dès que le lien de la carte n'atteint plus
  `/cours/[coursId]` en 1 clic.
- La tâche clé « ouvrir le devoir du jour » du premier lot entre dans la carte des routes
  (`docs/mesh/CARTE-ROUTES.md`, régénérée par `--write-doc`).
- Aucun budget existant relâché ; aucune route chaude voisine allongée.

### Negative / trade-offs
- **`eleve-ouvrir-devoir-chapitre` est documentaire** : le moteur la voit déjà à 1 clic par
  une autre arête (« Continuer »), elle ne peut donc pas échouer sur une régression de la
  carte. Sa preuve est Vitest (`web/lib/__tests__/lien-devoir.test.ts`,
  `web/app/(app)/__tests__/page.test.tsx`), pas le moteur ni l'e2e.
- **Règle d'écriture imposée par le moteur statique** : les liens de devoir s'écrivent en
  **gabarit littéral commençant par `/`** dans un helper importé par `web/app/(app)/page.tsx`
  (`web/lib/lien-devoir.ts`), par exemple `` `/cours/${…}?devoir=${…}` `` et
  `` `/${niveauCode}/${matiereCode}/${slug}` ``. Un `href={variable}`, une concaténation ou
  `` `${chemin}?devoir=…` `` sont invisibles pour `scripts/mesh/lib/route-graph.mjs` et
  feraient échouer le cliquet. Un commentaire dans le helper le rappelle.
- Le critère 1 n'a pas de preuve e2e tant que le faux backend ne sert pas le catalogue.

### Follow-ups
- **#373** — `chore(web)` : le faux backend e2e sert `/api/catalogue`, **avant PL-2 (#371)**,
  pour prouver le critère 1 en e2e.
- PL-2 (#371) se rebase sur PL-1 (fichiers communs).
- Passage de cet ADR en `Accepted` au merge de la PR de PL-1 (P3).
- Renumérotation de l'ADR de la PR #357 en 0037 (hors de cet ADR).

## Alternatives considered

- **Tâches `chaude: false`** (N1) — rejetée : une régression du lien de la carte ne
  bloquerait pas la CI ; U1 la juge déconseillée, B1 la garde comme repli seulement si P2
  refuse, ce qu'il n'a pas fait.
- **Ne rien ajouter à `tasks.json`** — rejetée : aucune protection durable du budget de
  1 clic ; l'impasse corrigée par PL-1 pourrait revenir sans alerte.

## Liens

- Issue #370 (PL-1) : fiche besoin P2, spec de parcours U1, spec UI U4/U5, plan technique B1,
  décision du conseil N2.
- Épopée #358 (mesh d'agents).
- `docs/mesh/PREMIER-LOT.md` (ticket PL-1, budget de clics des tâches clés).
- `docs/mesh/CONTRATS.md` §6 (contrat « Décision conseil »).
- `mesh/routes/tasks.json`, `scripts/mesh/route-budget.mjs`, `scripts/mesh/lib/route-graph.mjs`.
