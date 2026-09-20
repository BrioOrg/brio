# 0022 — XP, maîtrise et progression

- **Status**: Proposed
- **Date**: 2026-09-18
- **Deciders**: Pierce Broudin (proposition rédigée en amont pour relecture)

## Context

Le chantier **F2** (cahier des charges v2, §7) ferme la boucle d'apprentissage :
les soumissions d'exercices doivent alimenter une **maîtrise par compétence**
(la couche utile, qui rend enfin exploitable le référentiel de compétences —
ADR 0009) et une **XP** (la couche visible, qui motive). Cinq entrées de
`docs/design/BACKLOG.md` — atlas et verrous, badge de niveau, compteur d'XP,
flamme de série, pourcentage de complétion — nomment le module `progression`
comme **unique dépendance** ; aucune ne peut sortir tant que ce modèle n'existe
pas, car la règle produit interdit d'afficher une valeur que le back n'a pas
réellement (produit destiné à des mineurs).

Les forces en présence :

- **Anti-triche** : refaire un exercice ne doit pas rapporter d'XP en boucle.
  Toute heuristique de détection est contournable ; il faut un dispositif
  **structurel**, dans la lignée de l'anti-divulgation du tuteur (T0) et de
  l'ingestion idempotente (ADR 0010).
- **Frontières de modules** (Spring Modulith) : `progression` ne doit pas
  appeler `exercices`, `contenu`, etc. — sinon on recrée un couplage que le
  reste de l'archi évite (ADR 0001, 0007).
- **Recalculabilité** : la maîtrise doit pouvoir être reconstruite entièrement
  depuis l'historique des soumissions ; c'est une projection, pas une donnée
  saisie (même esprit que la normalisation déterministe, ADR 0012).
- **Mineurs / bien-être** : pas de comparaison publique entre élèves, pas de
  culpabilisation à la rupture de série (`PRINCIPLES.md`).

Faits vérifiés dans le code au moment de la rédaction :

- Il n'existe **aucun** événement applicatif publié aujourd'hui — les événements
  ci-dessous sont donc à créer par leurs modules émetteurs.
- `exercices.domain.Soumission` **porte déjà** la liste `competencies` et un
  `score` : la dérivation de la maîtrise depuis les soumissions est faisable
  sans changement de contrat côté `exercices`.
- Spring Modulith fournit la table `event_publication` (registre d'événements),
  qui permet un rejeu de l'historique.

## Decision

Nous introduisons un module **`progression`** avec son propre schéma Postgres
(ADR 0007), alimenté **uniquement par des événements applicatifs** — il n'appelle
aucun autre module.

### 1. Schéma `progression`

```
progression.evenements_xp (
  id           UUID PRIMARY KEY,
  eleve_id     UUID NOT NULL,             -- identite.comptes (par ID, ADR 0007)
  source_type  VARCHAR(30) NOT NULL,      -- 'exercice' | 'section' | 'chapitre' | 'devoir' | 'entraide'
  source_ref   VARCHAR(100) NOT NULL,     -- ID de l'objet source
  motif        VARCHAR(40) NOT NULL,      -- 'reussi_1er_coup' | 'reussi_apres_erreur' | ...
  points       SMALLINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (eleve_id, source_type, source_ref, motif)
)
progression.soldes  (eleve_id PK, xp_total INT, niveau SMALLINT, calcule_at TIMESTAMPTZ)
progression.series  (eleve_id PK, jours_consecutifs SMALLINT, dernier_jour_actif DATE,
                     gels_restants SMALLINT)
progression.maitrise (eleve_id, competence_code, niveau SMALLINT, echantillon INT, maj_at,
                      PRIMARY KEY (eleve_id, competence_code))
```

> **Précisions #96 (2026-09-20, mise en œuvre de la maîtrise).**
> - **Une projection de soumissions par compétence est ajoutée** :
>   `progression.soumissions_competences (id, eleve_id, soumission_id, competence_code,
>   correct, score, premiere_tentative, submitted_at, UNIQUE(soumission_id, competence_code))`.
>   C'est *elle*, et non `exercices.soumissions`, qui est la source recalculable :
>   `progression` ne peut pas lire `exercices` sans l'appel sortant que §3 interdit — même
>   raison qui a fait naître `progression.exercices_reussis` en #94. Le §6 « recalculable
>   intégralement depuis `exercices.soumissions` » se lit donc : *depuis la copie que
>   `progression` en tient, alimentée par l'événement*. Le registre Modulith
>   `event_publication` n'est **pas** une source de rejeu (log de (re)délivraison, non
>   requêtable, purgé selon le mode de complétion) — le test de recalcul s'appuie sur la
>   projection ci-dessus.
> - **`maitrise.niveau` est NULLABLE** : `null` tant que l'échantillon est sous le seuil
>   d'honnêteté (voir §6). L'`api` renvoie alors `niveau: null` plutôt qu'une valeur inventée.

### 2. L'idempotence est la contrainte anti-abus

La contrainte **`UNIQUE (eleve_id, source_type, source_ref, motif)`** *est* le
dispositif anti-triche : l'attribution d'XP est idempotente. Refaire dix fois le
même exercice n'insère qu'une ligne — donc ne rapporte qu'une fois. C'est
structurel, pas heuristique. Une insertion en conflit est ignorée (`ON CONFLICT
DO NOTHING`), pas une erreur.

### 3. Alimentation par événements (jamais d'appel sortant)

`progression` **écoute** ; il n'appelle personne. Événements et **module
émetteur** :

| Événement | Émis par | Disponible |
|---|---|---|
| `SoumissionEnregistree` (+ `chapitreId`) | `exercices` | **F2** (à ajouter) |
| `ChapitrePublie` (structurel, non par-élève) | `contenu` | **F2** (à ajouter) |
| `SectionTerminee` | `contenu` | **F2** (à ajouter) |
| `ChapitreTermine` | `progression` (auto-dérivé) | **F2** (à ajouter) |
| `RenduDepose` | `devoirs` | F4 |
| `ReponseUtileValidee` | `social` | F6a |

En F2 on câble ces événements. La complétion de section/chapitre (issue #94)
est portée par `contenu` pour le **signal** (un endpoint léger « section lue »
émet `SectionTerminee`) et par `progression` pour la **dérivation**.

> **Correction du 2026-09-20 (mise en œuvre #94).** La rédaction initiale
> plaçait `ChapitreTermine` chez `contenu`. C'est impossible sans introduire un
> cycle de modules : `exercices → contenu` existe déjà, et `progression →
> exercices` (écoute des soumissions) aussi ; faire dépendre `contenu` de
> `progression` — ou lui faire écouter `exercices` pour connaître les exercices
> réussis — fermerait la boucle `contenu → progression → exercices → contenu` que
> `ModularityTests` rejette. La règle « toutes sections + ≥ 80 % des exercices »
> ne peut donc être calculée que par `progression`, seul module qui entend déjà
> les soumissions. `contenu` émet un `ChapitrePublie` **structurel** (niveau,
> matière, ordre, statut, nb de sections, nb d'exercices) que `progression`
> projette en interne, plus le `SectionTerminee` par-élève ; `progression` en
> dérive complétion, pourcentage, états de parcours (fait / en cours /
> verrouillé), auto-émet `ChapitreTermine`, et **expose** l'état par chapitre en
> lecture (`GET /api/progression/parcours/{niveau}/{matiere}`). Aucun appel
> sortant : tout arrive par événement (§3 tient).

### 4. Barème et plafond

| Événement | Motif | XP |
|---|---|---|
| Exercice réussi du premier coup | `reussi_1er_coup` | 10 |
| Exercice réussi après erreur | `reussi_apres_erreur` | 6 |
| Section de leçon terminée | `section_terminee` | 2 |
| Chapitre terminé (toutes sections + ≥ 80 % des exercices) | `chapitre_termine` | 50 |
| Devoir rendu avant l'échéance (F4) | `devoir_a_lheure` | 20 |
| Réponse d'entraide utile (F6a) | `entraide_utile` | 15 (plafond 3/j) |

**Plafond quotidien : 200 XP** — appliqué au moment de l'attribution (somme des
`points` du jour pour l'élève ; le surplus n'est pas inséré).

> **Précisions #94 (2026-09-20).**
> - **Les récompenses de complétion (`section_terminee`, `chapitre_termine`) sont
>   exemptées du plafond.** Elles sont idempotentes et bornées (une fois par
>   section / par chapitre via la contrainte d'unicité), donc infarmables ; les
>   soumettre au plafond ferait perdre définitivement les 50 XP d'un chapitre
>   terminé après une grosse journée, sans réessai possible (l'attribution ne se
>   rejoue pas). Seules les récompenses d'exercice restent plafonnées.
> - **La complétion a son propre enregistrement**, distinct du journal `evenements_xp`
>   (`progression.sections_lues`, `progression.exercices_reussis`). On ne peut pas
>   déduire « exercice réussi » d'`evenements_xp` : un exercice réussi au-delà du
>   plafond n'y laisse aucune ligne, ce qui empêcherait la porte des 80 % de
>   s'ouvrir pour un élève productif.
> - **`source_ref` élargi** à `VARCHAR(200)` : les réfs de section valent
>   `chapitreId/sectionId` et dépassent l'ancienne borne de 100.

### 5. Niveau — seuils quadratiques

XP cumulée requise pour **atteindre** le niveau `n` : `seuil(n) = 100 · n²`.
Donc `niveau = floor( sqrt(xp_total / 100) )`. (Niveau 1 à 100 XP, 2 à 400, 3 à
900, 4 à 1600…) Le niveau est **calculé côté back** et stocké dans
`progression.soldes` — jamais calculé côté client. *(Valeur `100` proposée, à
confirmer.)*

### 6. Maîtrise — projection recalculable

Pour chaque `(eleve_id, competence_code)` : niveau **0 à 4** dérivé des `N = 10`
dernières soumissions portant cette compétence, pondéré par la difficulté de
l'exercice. Entièrement recalculable depuis `exercices.soumissions` — c'est une
**projection**, jamais une donnée saisie. *(N et la pondération proposés, à
confirmer.)*

> **Mise en œuvre #96 (2026-09-20).** Le v1 précise et amende ce paragraphe :
> - **Pondération par la difficulté : reportée.** La difficulté existe dans le schéma de
>   contenu (`course-content.schema.json`, énum ouvert) mais **aucune couche back** ne la
>   porte : l'ingesteur la laisse tomber, `contenu.exercices` n'a pas de colonne,
>   `ExerciceDefinition` et `SoumissionEnregistree` ne la transportent pas. La câbler
>   traverserait trois modules (ingesteur + migration + ré-ingestion → `contenu` →
>   `exercices` → `progression`) pour un gain nul aujourd'hui (catalogue : 28
>   *introduction*, 27 *standard*, 2 *approfondissement* — une pondération y est un
>   arrondi sur deux exercices). Reporté à un ticket dédié ; le v1 est **non pondéré**.
> - **Signal binaire, mais `score` capturé.** La maîtrise v1 se calcule du booléen
>   `correct`. On ajoute quand même `score` à l'événement et à la projection dès
>   maintenant : on ne recalcule pas une histoire qu'on n'a jamais captée, et passer au
>   score plus tard ne sera qu'un changement de formule + rebuild.
> - **Anti-« refaire jusqu'à réussir ».** La fenêtre ne compte que les **premières
>   tentatives** (`premiere_tentative`, déjà porté par l'événement) : refaire un exercice
>   ne remplit pas les 10 places de succès. La maîtrise mesure « su faire seul », pas la
>   persévérance.
> - **Formule et seuil.** `niveau = clamp(floor(taux · 5), 0, 4)` avec
>   `taux = réussites / échantillon` (0,8 → 4). En dessous de **3 soumissions** le niveau
>   est **absent** (`null`) : une seule bonne réponse afficherait « maîtrisé » — contraire
>   à la règle produit « ne pas montrer une donnée que le back n'a pas ». Seuil et N
>   restent des constantes ajustables.
> - **API.** `GET /api/progression/maitrise` renvoie, pour l'élève authentifié, la liste
>   `{ competenceCode, niveau (0–4 ou null), echantillon }` — seules les compétences
>   effectivement soumises apparaissent (jamais tout le référentiel).

### 7. Série

`jours_consecutifs` avec un **gel hebdomadaire** (un jour manqué par semaine ne
casse pas la série). La série **ne s'achète pas** : 0 XP, elle se montre
seulement. Sa rupture est annoncée **sans culpabilisation** (`PRINCIPLES.md`).

## Consequences

### Positive
- Anti-triche **structurel** (contrainte d'unicité), impossible à contourner par
  répétition.
- Frontières de modules préservées : `progression` est un pur consommateur
  d'événements ; il peut être ajouté/rejoué sans toucher `exercices`/`contenu`.
- Maîtrise recalculable → on peut faire évoluer le barème/la formule et
  reconstruire l'historique.
- Débloque les 5 entrées de `docs/design/BACKLOG.md` d'un seul lot.

### Negative / trade-offs
- La complétion de section/chapitre demande un **nouveau signal** côté `contenu`
  (endpoint + événement) — ce n'est pas gratuit.
- Le plafond quotidien et le gel de série ajoutent de la logique temporelle
  (fuseau horaire de référence à fixer — proposition : Europe/Paris).
- Les événements `RenduDepose` / `ReponseUtileValidee` arriveront plus tard
  (F4/F6a) : le barème les prévoit mais ils resteront inertes jusque-là.

### Follow-ups (tickets)
- **#93** moteur XP + niveau (schéma, `evenements_xp`, `soldes`, listener
  `SoumissionEnregistree`, barème, plafond).
- **#94** complétion & états de parcours (`contenu` émet
  `SectionTerminee`/`ChapitreTermine`).
- **#95** série (gel hebdo, rupture sans culpabilisation).
- **#96** maîtrise par compétence (projection depuis les soumissions).
- **(à ouvrir)** pondération de la maîtrise par la difficulté : câbler `difficulty`
  ingesteur → `contenu.exercices` (colonne + migration + ré-ingestion) →
  `ExerciceDefinition` → `SoumissionEnregistree` → `progression`, puis passer la formule
  du booléen `correct` au score/à la difficulté (voir mise en œuvre #96 en §6).
- Migrations Flyway `progression` (schéma ci-dessus).
- Côté front (Gabrielle) : #80 (dès #93), #79/#82 (dès #94), #81 (dès #95).

## Alternatives considered

- **Classement public de classe / entre élèves** — rejeté : comparaison sociale
  néfaste pour des mineurs, hors périmètre (cahier §14, `PRINCIPLES.md`).
- **XP par message / par action sociale libre** — rejeté : incite au bruit et se
  farm trivialement ; l'XP récompense l'apprentissage, pas l'activité.
- **Niveaux calculés côté client** — rejeté : non faisant foi, contournable,
  incohérent entre appareils ; le niveau est une donnée serveur.
- **Anti-triche par heuristique/détection** — rejeté : contournable ; on préfère
  l'idempotence structurelle.
- **Maîtrise saisie / stockée comme source de vérité** — rejeté : une projection
  recalculable depuis les soumissions est plus robuste et corrigeable.
