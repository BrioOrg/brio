<!-- mesh:contrat=decision-conseil v1 -->
# 0046 — Les annales dans la navigation principale, barre du bas élève plafonnée à 6 emplacements

- **Status**: Proposed
- **Date**: 2026-11-18
- **Deciders**: Conseil N2 du mesh — P2 (stratège produit) · B1 (architecte technique) · V6 (gardien
  du design, avis à recueillir en porte 5) · U1 (cartographe des parcours, consulté pour le budget) —
  arbitrage humain (Gabrielle, 2026-11-18, porte 1, réponses (a)(a)(a)) — ticket PL-5 (#395).
  Brouillon de B1, consigné par P3 (greffier), qui ne ratifie pas.

> **Numérotation.** Numéro réservé par la fiche besoin #395 et vérifié libre le 2026-11-18 après
> `git fetch origin` : `develop` porte 0036, 0037, 0040, 0042 et 0045 ; les PR ouvertes réclament
> 0038 (#394), 0039 (#390), 0041 (#393), 0043 (#376) et 0044 (#357) ; aucune branche ne porte 0046.
>
> **Statut.** L'humaine a tranché les trois questions de fond en porte 1. L'ADR passe en `Accepted`
> au merge de la PR de PL-5, une fois l'avis de V6 consigné ci-dessous.

## Context

**Signal.** Ticket PL-5 du premier lot (`docs/mesh/PREMIER-LOT.md` l. 46), issue #395, épopée #358.
Tâche clé `eleve-annales` « S'entraîner sur une annale » (`mesh/routes/tasks.json`) mesurée à
**2 clics pour une cible de 1**, état « enfoui » : `/` → Explorer → carte « Annales »
(`web/app/(app)/explorer/page.tsx:111-128`), seul lien vers `/annales` dans `web/`.

**Constat (base `2f186c6`).**

- La navigation principale du shell élève est une liste de données, `APP_SECTIONS`
  (`web/lib/app-sections.ts:51-69`) : Accueil, Ma classe, Explorer, Profil. La Communauté s'insère
  avant Profil quand son réglage serveur est actif, sinon elle reste un onglet désactivé de la barre
  mobile (ADR 0035 §10, `navigationEleve`).
- Cette liste alimente deux composants : la barre du bas mobile (`web/components/bottom-nav.tsx`,
  < 640 px, icônes seules) et la colonne latérale (`web/components/section-sidebar.tsx`, ≥ 640 px).
  La barre du bas compte aujourd'hui **5 emplacements** dans les deux cas (4 liens + 1 bouton
  désactivé, ou 5 liens). Aucun document ne fixait de plafond ; le visuel gelé
  `docs/design/visuels/2-parcours-atlas.html` dessine 5 onglets.
- Sur `/annales`, la section active est Explorer (repli `routes: ['/']`) et le fil d'Ariane
  « Explorer › Annales ». Un sujet s'ouvre sur la route chapitre `/{niveau}/{matiere}/{id}`
  (`web/components/annales-eleve.tsx:92,121,130`), URL sémantique du catalogue (ADR 0011).
- Un onglet de la barre mesure `p-2` + icône 26 px = **42 × 42 px**, sous la cible tactile de 44 px
  exigée par la fiche (critère 2).
- Le moteur de budget (`scripts/mesh/route-budget.mjs`) attribue un lien porté par la navigation à
  `lib/app-sections.ts`, importé par `web/app/(app)/layout.tsx` : une entrée de navigation compte pour
  **1 clic depuis tous les écrans du shell**.

**Pourquoi un conseil N2.** Nouvel élément de la navigation principale, présent sur tous les écrans
du shell élève, y compris ceux des 7 routes chaudes ; il consomme une place de la barre mobile,
ressource partagée par toute section future. Pas N3 : aucune nouvelle donnée de mineur, ni tuteur,
ni mesure d'usage, ni coût ; changement réversible.

## Options

### A. Plafond de la barre du bas mobile

1. **Plafond relevé à 6 emplacements, écrit.** Conséquences : l'entrée Annales tient sans déplacer
   aucune section ; à 360 px, environ 57 px par emplacement, au-dessus des 44 px ; largeur minimale
   sans débordement 6 × 44 + 16 = 280 px. Toute section élève suivante exige un nouvel ADR.
2. **Plafond maintenu à 5** (borne usuelle de Material). Conséquences : il faut retirer ou regrouper
   une section existante (menu « Plus », fusion) pour faire place, ce qui déplace au moins une section
   dont partent des routes chaudes (critère 4 de la fiche) ou ajoute un geste.
3. **Critère mobile relâché à 2 taps** (ordinateur seul à 1 clic). Conséquences : la barre reste à 5,
   mais la tâche n'atteint pas la cible du lot sur téléphone, support principal des 11-15 ans.

### B. Emplacement de l'entrée

1. **Entre Explorer et Profil** (Accueil · Ma classe · Explorer · Annales · Communauté · Profil).
   Conséquences : Accueil, Ma classe, Explorer gardent leur rang (1, 2, 3) ; Communauté reste juste
   avant Profil sans code nouveau (`APP_UPCOMING_TABS.before = 'profil'`) ; les trois sections
   « travail » restent groupées.
2. **En 2ᵉ position**, avant Ma classe. Conséquences : décale l'onglet de trois routes chaudes
   (devoirs, cours du prof, salon) ; mémoire musculaire cassée.
3. **Après Communauté.** Conséquences : une section sociale sépare deux sections « travail ».

### C. État actif d'un sujet ouvert depuis les annales

1. **Le sujet reste dans Explorer.** Conséquences : `activeSectionKey` ne lit que le chemin ; aucun
   appel réseau dans le layout ; fil d'Ariane de la page chapitre (« Explorer › … ») cohérent avec la
   section active. La surbrillance glisse d'Annales à Explorer en ouvrant un sujet.
2. **Le sujet active Annales.** Conséquences : distinguer une annale d'un chapitre exige de lire
   `GET /api/annales` dans le shell à chaque page, ou de coder un identifiant en dur (interdit par la
   fiche) ; le fil d'Ariane de la page chapitre deviendrait incohérent.

## Decision

**A1, B1, C1.**

1. **La barre du bas élève (mobile) compte au plus 6 emplacements**, liens et onglets désactivés
   confondus (`navigationEleve(...).sections` + `.upcoming`). Ce plafond s'applique quel que soit le
   réglage de la Communauté. Toute section élève supplémentaire, ou tout onglet à venir de plus,
   passe par un nouvel ADR qui retire, regroupe ou relève explicitement ce plafond. La colonne
   latérale d'ordinateur suit la même liste. La barre enseignante (`PROF_SECTIONS`, 5 liens) n'est
   pas visée par ce plafond.
2. **Nouvelle section `annales`** dans `APP_SECTIONS`, entre Explorer et Profil :
   `{ key: 'annales', label: 'Annales', icon: 'barbell', href: '/annales', routes: ['/annales'] }`.
   Le `href` reste une chaîne littérale (seule forme vue par le moteur de budget, ADR 0045). Elle est
   visible par **tous les élèves**, sans condition (aucun appel réseau ajouté au layout).
3. **Cible tactile** : chaque emplacement de la barre du bas mesure 44 × 44 px (`p-2` → `size-11`
   dans `bottom-nav.tsx`). Le composant étant partagé, la barre enseignante en bénéficie aussi.
4. **État actif** : `/annales` et toute sous-route `/annales/…` activent Annales ; un sujet ouvert
   (`/{niveau}/{matiere}/{id}`) reste dans Explorer. Le fil d'Ariane de `/annales` devient
   « Annales » seul.
5. **Budget** : `eleve-annales` passe de 2/2 à **1/1** dans `mesh/routes/tasks.json` et reste
   `chaude: false` (resserrement, décision U1).

**Raison.** La barre est le seul élément persistant à 1 tap sur mobile : A1 est la seule option qui
atteint la cible sans déplacer une section dont partent des routes chaudes. Écrire le plafond évite
que la barre s'allonge section après section sans décision. B1 et C1 ne changent le rang d'aucune
section existante et n'ajoutent aucune lecture réseau au shell. Simulation sur copie de `2f186c6` :
`route-budget.mjs --explain eleve-annales` rend `1 clic(s), budget 1 · / → /annales (lien dans
lib/app-sections.ts)` et « Aucune violation » ; les 7 tâches chaudes élève gardent leur profondeur.

Décisions associées, prises en porte 1 par l'humaine (#395) : PL-5 se joue maintenant, et U5
réécrit les deux sous-titres « De vrais sujets d'examen » (`annales-eleve.tsx:52`,
`explorer/page.tsx:122`), faux tant que le seul sujet servi est une démonstration. La carte
« Annales » d'Explorer est gardée (décision N1 de U3).

## Avis des membres du conseil

- **P2 (stratège produit) — accord.** Auteur de la fiche besoin #395 ; recommandait (a) aux trois
  questions : entrée pour tous les élèves, **plafond relevé à 6 et écrit dans l'ADR**, PL-5 joué
  maintenant avec réécriture des deux phrases. Classe le ticket « normale, première des entrées
  enfouies », et garde `eleve-annales` non chaude pour laisser l'entrée réversible si l'usage ne suit
  pas.
- **B1 (architecte technique) — accord.** Aucun module backend, contrat d'API, migration, faux
  backend ni bibliothèque touché : pas d'ADR technique distinct, cet ADR suffit. Le plafond doit être
  **vérifiable** : un test unitaire (`web/lib/__tests__/app-sections.test.ts`) échoue si
  `sections + upcoming` dépasse 6, pour les deux valeurs du réglage. Réserve : C1 laisse la
  surbrillance glisser vers Explorer à l'ouverture d'un sujet ; acceptée, car C2 coûterait un appel
  réseau par page pour un seul sujet servi. Signale que le passage à 44 px touche aussi la barre
  enseignante (amélioration) et un conflit de rebase attendu sur `tasks.json` / `CARTE-ROUTES.md`
  avec les PR #376 et #357 (carte à régénérer, pas à fusionner).
- **V6 (gardien du design) — avis à recueillir en porte 5**, sur les captures listées par U4
  (spec UI #395 §7, dont la barre à 6 emplacements à 320 et 360 px et la barre enseignante à 44 px).
  Écart voulu au visuel gelé (5 onglets, 42 px) à constater, pas un écart au kit.
- **U1 (cartographe, consulté) — accord, pas de veto.** Budget tenu sur les 7 routes chaudes
  (simulation ci-dessus) ; `eleve-annales` 2 → 1, aucun budget chaud relevé ; carte des routes à
  régénérer dans la PR.

**Arbitrage humain (Gabrielle, 2026-11-18, porte 1)** : (a)(a)(a) — entrée visible par tous,
plafond de 6 écrit dans l'ADR, PL-5 maintenant avec réécriture des deux phrases.

## Consequences

### Positive
- Annales à **1 clic de tout écran du shell élève**, sur ordinateur comme sur mobile, gardé en CI par
  le budget 1 de `eleve-annales`.
- La barre du bas a un **plafond écrit et testé** : une 7ᵉ entrée ne peut plus arriver sans décision.
- Cible tactile de 44 × 44 px sur les deux barres (élève et enseignant).
- Plus de promesse de « vrais sujets d'examen » face à un contenu de démonstration.

### Negative / trade-offs
- La barre du bas est **pleine** : la prochaine section élève (ou un nouvel onglet à venir) impose
  de retirer, regrouper ou relever le plafond par un nouvel ADR.
- Écart voulu au visuel gelé `2-parcours-atlas.html` (5 onglets, 42 px), qui n'est pas modifié.
- En ouvrant un sujet, la section active passe d'Annales à Explorer ; à observer par S2/S4.
- Sous 280 px de large, la barre déborderait (aucun appareil cible).

### Follow-ups
- PR de PL-5 : code (B3), tests (B5, accord V3 sur `app-sections.test.ts:14`, `:70-76` et
  `bottom-nav.test.tsx:33-42`), `tasks.json` + `CARTE-ROUTES.md` (U1), puis cet ADR.
- Avis V6 consigné ici en porte 5 ; passage en `Accepted` au merge (P3).
- PL-9 : états vide, chargement, erreur de `/annales` ; route `/api/annales` du faux backend si un
  e2e en a besoin.
- Signal séparé : vue « Par compétence » vide pour un élève (403 sur
  `/api/prof/referentiel/competences`).

## Alternatives considered

- **Plafond maintenu à 5** — rejeté : déplace une section existante ou ajoute un geste ; P2 et
  l'humaine ont choisi 6.
- **Critère mobile à 2 taps** — rejeté : n'atteint pas la cible du lot sur le support principal.
- **Annales en 2ᵉ position ou après Communauté** — rejetés (U3) : rang des routes chaudes décalé, ou
  sections « travail » séparées.
- **Sujet ouvert actif sur Annales** — rejeté : appel réseau dans le layout ou identifiant en dur.
- **Entrée réservée aux élèves de 3e** (Q1 b) ou page filtrée par niveau (Q1 c) — rejetées en
  porte 1 : barre variable d'un élève à l'autre, ou changement de la page hors périmètre (PL-9).

## Liens

- Issue #395 (PL-5) : fiche besoin P2, spec de parcours U3/U1, spec UI U4/U5, plan technique B1.
- Épopée #358 · `docs/mesh/PREMIER-LOT.md` l. 46 · `docs/mesh/CONTRATS.md` §6.
- ADR 0011 (URL sémantiques), ADR 0035 §10 (Communauté), ADR 0045 (forme littérale des liens).
- `web/lib/app-sections.ts`, `web/components/bottom-nav.tsx`, `web/components/section-sidebar.tsx`,
  `mesh/routes/tasks.json`, `scripts/mesh/route-budget.mjs`.
