<!-- mesh:contrat=decision-conseil v1 -->
# 0050 — Progression des cours d'enseignant : lecture, réussites et « Reprendre »

- **Status**: Accepted — signé par Gabrielle (humaine, N3) le 2026-11-23, points 1 à 7 tels que
  recommandés
- **Date**: 2026-11-23
- **Deciders**: Conseil N2 du mesh, P2 (stratège produit), B1 (architecte technique) et V5
  (gardien des données de mineurs), **puis signature de l'humaine (N3)**. Ticket PL-6b (#400),
  fiche besoin #398. Consigné par P3 (greffier), qui ne ratifie pas.

> **Numérotation.** Le brouillon du 2026-11-18 portait le numéro 0047, pris depuis sur `develop`
> par `0047-annales-navigation-principale.md`. Le 2026-11-23, `develop` (`8b3c450`) porte les ADR
> jusqu'à **0048** et les migrations jusqu'à **V44** ; la seule PR ouverte qui réclame un numéro
> est #427 (ADR **0049**). `node scripts/mesh/check-numerotation.mjs --base origin/develop
> --open-prs` → OK. Numéros réservés dans #400 : ADR **0050**, migration **V45**.
>
> **Statut.** Décision **N3** : nouveau traitement de données de lecture de mineurs (ADR 0018,
> 0022). Proposée le 2026-11-23, **signée par Gabrielle le 2026-11-23** (« Je signe tout » : les
> sept points ci-dessous, avec les recommandations de B1 et V5).
>
> **Amende** : ADR 0022 §3 (une exception de lecture, bornée, §2 ci-dessous) et ADR 0032
> l.271-272 (le mode interactif s'étend aux cours, §6).
>
> **Révision du 2026-11-23.** Texte revérifié contre `develop` @ `8b3c450` (120 commits depuis le
> brouillon) et corrigé selon les réserves du rapport V5 du 18/11 (I1-I4, S1-S6), citées une à une
> dans la section « Réserves de V5 et leur traitement ».

## Context

Un élève lit sur `/cours/[coursId]` un cours que son enseignant a publié et porté à sa classe
(ADR 0019, 0029). Le contenu est servi depuis `contenu.cours_versions` (versions immuables),
avec le même `<ChapterView>` qu'un chapitre. Pourtant, rien n'est enregistré :

- Le signal « section lue » n'existe que pour les chapitres :
  `POST /api/chapitres/{id}/sections/{sectionId}/lu` → `ContenuService.marquerSectionLue`
  (l.152-169), qui cherche un chapitre et renvoie donc **404** pour un cours.
- `progression` ne projette que les chapitres (`ChapitrePublie`, `ProgressionService.java:116-122`).
  `CoursEditionService.publier` (l.98-123) n'émet aucun événement.
- Les exercices d'un cours rapportent déjà de l'XP, mais ne comptent dans aucune jauge
  (`ProgressionService.java:146` : la complétion exige `chapitreId != null`). De plus, chaque
  republication crée de **nouveaux UUID d'exercices** (`V26__contenu_cours_editeur.sql:77-84`).
  Le même exercice republié devient donc une source neuve d'XP (`ProgressionService.java:142`).
- « Reprendre » (`ProgressionService.reprendre`, l.294-318 ; Accueil
  `web/app/(app)/page.tsx:142-161`) ne connaît que les chapitres et construit un lien
  `/{niveau}/{matiere}/{id}` (l.153).
- `progression` « écoute, n'appelle personne » (ADR 0022 §3). Or la visibilité d'un cours
  (publié, porté à une classe de l'élève) se décide dans `contenu`
  (`CoursLectureService.estVisiblePour`, l.63-70), à partir des classes de l'élève détenues par
  `identite` (`InscriptionsQuery`), et `identite` n'émet aucun événement d'inscription.

**Décisions de l'humaine, porte 1 (2026-11-18)** : enregistrer la lecture des cours **à
l'identique des chapitres** (jauge et « Reprendre ») ; **XP de section (+2) et d'exercice, sans
bonus de complétion de 50 XP** ; entraide hors périmètre ; données lisibles par l'élève seul ;
un cours dépublié, archivé ou retiré de la portée de la classe ne sort **jamais** dans « Reprendre ».

Faits vérifiés au SHA `8b3c450` :

- Les ids de section et de bloc de l'éditeur sont créés une seule fois par `genId()`
  (`web/lib/cours-editeur.ts:267`, appelé l.289-297 à la création d'un bloc), gardés dans le
  brouillon et repris tels quels à la publication. L'id d'un bloc d'exercice devient le `slug` de
  `contenu.exercices` (`ExerciceExtractor.java:60`), unique par version
  (`uq_exercices_cours_slug`, V26 l.108-110). **Ces ids sont stables d'une version à l'autre**,
  contrairement aux UUID d'exercice. Ils sont bornés par le schéma de publication :
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 128 caractères au plus
  (`docs/schema/course-content.schema.json:46-48`, appliqué par `PublicationValidator`).
- Il n'existe aucun chemin d'archivage ni de dépublication d'un cours (`STATUT_ARCHIVE` est
  déclaré, `Cours.java:27`, jamais écrit). Le retrait de portée passe par
  `CoursEditionService.definirPortees` (l.80-90).
- Le titre affiché en tête de `/cours/[coursId]` est celui de la **version publiée**
  (`cours.title`, `web/app/(app)/cours/[coursId]/page.tsx:81`). La colonne `contenu.cours.titre`,
  elle, suit le brouillon (`Cours.modifierBrouillon`, `Cours.java:88`).
- Un exercice `paper` n'a pas d'évaluateur (`EvaluatorDispatcher.java:25`) : il ne peut jamais
  être réussi.
- Un **devoir** peut viser un cours (`sourceType = 'cours'`, `DevoirEleveVue.java:9`) ; il s'ouvre
  sur `/cours/{id}?devoir=…` (`web/lib/lien-devoir.ts`), donc derrière le même contrôle de portée
  que la page. `devoirs` ne dépend pas de `contenu` et ne vérifie pas la portée à la création
  (`DevoirService.creerDevoir`, l.73-91).
- Graphe des modules : `progression → {exercices, contenu, social}::api`,
  `exercices → contenu::api`, `devoirs → {exercices, identite}::api`, `contenu → identite::api`
  (`CoursController`), `identite → ∅`. `contenu :: api` est déjà dans les `allowedDependencies`
  de `progression`.
- Depuis le brouillon : PL-3 est mergé (ADR 0046, `mode-context.tsx` réécrit) ; `social` a une
  purge de rétention à 12 mois qui anonymise ses contenus (ADR 0023 §6, `PurgeRetention.java`) et
  `progression` coupe déjà les références d'XP d'entraide correspondantes
  (`ContenusAnonymisesListener`). **Rien de tel n'existe pour les données de progression.**

## Options

### A. Projection par événements et contrôle d'accès à la lecture (retenue)

`contenu` émet un `CoursPublie` structurel et un `SectionCoursLue` par élève ; `progression`
projette et enregistre par **ids stables**. Pour « Reprendre », la couche web de `progression`
interroge `CoursAccesApi` en lecture (un appel par lot) pour écarter un cours devenu invisible.

- **+** C11 est garanti par **le même prédicat** que la page du cours : dépublication, archivage,
  retrait de portée, et même la sortie de l'élève de sa classe. Aucun événement de plus, aucun
  état projeté qui pourrait diverger ou arriver en retard.
- **+** Aucune classe n'est stockée dans `progression` (minimisation).
- **−** L'ADR 0022 §3 est amendé (une lecture synchrone). L'exception est bornée et testée.

### B. Tout par événements : projeter aussi les portées et les inscriptions

`contenu` émet en plus `CoursPorteesModifiees` et (plus tard) `CoursArchive` ; `identite` émet
`EleveInscrit` / `EleveRetireDeClasse` ; `progression` projette cours ↔ classes et élève ↔ classes.

- **+** ADR 0022 §3 reste intact.
- **−** Quatre événements, dont deux dans `identite`, qui n'en émet aucun aujourd'hui.
- **−** `progression` stockerait l'appartenance des élèves aux classes : une copie de donnée
  personnelle de plus, contraire à C12.
- **−** La fenêtre entre retrait et traitement asynchrone laisse passer une impasse.

### C. Filtrer dans le front (BFF Next.js)

`/reprendre` renvoie une liste de candidats ; l'Accueil la croise avec `GET /api/cours`.

- **+** Aucun changement de frontière backend.
- **−** La garantie C11 vit dans le client : le futur client Expo devrait la refaire.
- **−** L'API expose à l'élève les ids et titres de cours qui lui ont été retirés.

## Decision

Nous retenons **l'option A**.

### 1. Événements (émis par `contenu`, contrats dans `contenu.api`)

- `CoursPublie(UUID coursId, int version, List<String> sectionIds, List<String> exerciceCles)`,
  structurel. Il est émis dans la transaction de `publier`, et réémis pour chaque cours publié au
  démarrage par une amorce idempotente (rattrapage des cours déjà publiés). `exerciceCles` ne
  contient que les blocs d'exercice **corrigeables** (`exerciseType ≠ 'paper'`). Le message ne
  porte ni titre, ni statut, ni classe.
- `SectionCoursLue(UUID eleveId, UUID coursId, String sectionId, Instant survenuLe)`. Il est émis
  par `POST /api/cours/{coursId}/sections/{sectionId}/lu` après contrôle de portée (404 si non
  publié, 403 si hors portée, mêmes règles que `GET /api/cours/{id}`, `CoursController.java:80-87`)
  et d'existence de la section dans la version publiée courante (404 sinon). Il est distinct de
  `SectionTerminee`, dont le contrat ne change pas.
- `SoumissionEnregistree` et `ExerciceDefinition` gagnent `coursId` et `exerciceCle` (additifs,
  en fin de record, nuls pour un chapitre et pour un événement ancien rejoué).

### 2. Amendement de l'ADR 0022 §3 : une exception de lecture, bornée

Les **écritures** de `progression` (projection, lectures, réussites, XP, complétion) restent
**exclusivement** alimentées par des événements. Une seule exception est admise : la couche
`fr.brio.progression.web` peut appeler
`CoursAccesApi.titresVisiblesPourEleve(UUID eleveId, Set<UUID> coursIds) → Map<UUID, String>`,
en lecture seule, pour filtrer ce qu'elle **affiche** dans « Reprendre ». Le service et les
listeners n'en dépendent pas. Un test ArchUnit le garantit : seul `progression.web` dépend de
`CoursAccesApi`, et `progression` ne dépend jamais de `identite`. L'appel ne crée aucun cycle,
car `contenu` ne dépend pas de `progression`. Les `allowedDependencies` ne changent pas.

L'implémentation dans `contenu` résout elle-même les classes (`InscriptionsQuery`) et applique
**la même méthode** que `estVisiblePour`, sans recopier la règle (S3). Le titre renvoyé est celui
de la **version publiée**, c'est-à-dire celui que la page affiche (S1). La javadoc de
`CoursAccesApi` (« classes résolues par l'appelant ») est mise à jour.

### 3. Contrôle de portée à la soumission d'un exercice de cours (I3)

`ExercicesService.soumettre` ne contrôle aujourd'hui aucune portée (l.43-60). Pour un exercice
dont `coursId ≠ null`, `exercices` vérifie la visibilité **avant d'évaluer**, par une nouvelle
méthode de `contenu.api` qui résout elle-même les classes et applique le même prédicat
(`exercices → contenu :: api` est déjà autorisé). Cours non publié → 404 ; hors portée → 403 ;
dans les deux cas, ni soumission, ni événement, ni XP. Un exercice d'une version antérieure d'un
cours **encore visible** reste soumettable (un devoir peut épingler une version,
`Devoir.sourceVersion`). Un devoir posé sur un cours non porté à la classe est déjà une impasse
aujourd'hui (la page `/cours/{id}` répond 403) : le contrôle ne crée aucun cas nouveau.

### 4. Schéma : migration V45, additive, schéma `progression`

`progression.cours (cours_id PK, version, maj_at)` et
`progression.cours_elements (cours_id, nature ∈ {section, exercice}, cle, PK)` portent la
projection ; l'upsert est gardé par `version <` pour tolérer le désordre et la concurrence.
`progression.cours_suivis (eleve_id, cours_id, termine_at NULL, PK)` sert de verrou de
sérialisation (`SELECT … FOR UPDATE`) et porte la complétion collante.
`progression.cours_sections_lues (…, UNIQUE (eleve_id, cours_id, section_id))` et
`progression.cours_exercices_reussis (…, UNIQUE (eleve_id, cours_id, exercice_cle))` enregistrent
les faits. Les tables des chapitres (V20) ne changent pas.

L'idempotence est structurelle : les insertions passent par `INSERT … ON CONFLICT DO NOTHING`,
et **l'XP n'est attribuée que si l'insertion a créé la ligne**. La projection (`CoursPublie`, y
compris réémis par l'amorce) **ne touche jamais** aux faits d'un élève : ni `cours_sections_lues`,
ni `cours_exercices_reussis`, ni `cours_suivis.termine_at`, ni `evenements_xp` (S2, figé par un test).

### 5. Règles

- **Complétion** (ADR 0022 inchangé) : toutes les sections **courantes** lues et ≥ 80 % des
  exercices **courants** réussis, comptés par intersection avec `cours_elements`. Une fois
  atteinte, elle est collante (`termine_at`, jamais remise à NULL).
- **XP** (Q2 → B) : `cours_section` / `{coursId}/{sectionId}` +2 ; `cours_exercice` /
  `{coursId}/{cle}` +10 / +6 ; **aucun bonus** de fin de cours. Les deux comptent dans le
  plafond quotidien de 200. Pour les sections, c'est un écart volontaire avec les chapitres
  (exemptés, ADR 0022 §4) : le nombre de sections d'un cours dépend de l'enseignant. La clé stable
  ferme la boucle d'XP « republier = rejouer » ouverte en V26.
- **« Reprendre »** : le contenu le plus récemment lu et non terminé l'emporte, chapitre ou cours.
  Un cours n'est proposé que s'il passe le contrôle du §2 ; son titre (version publiée) est lu au
  même moment. La réponse devient une union discriminée par `type` (`chapitre` | `cours`). La
  variante chapitre garde exactement ses champs : le schéma actuel
  (`packages/api-client/src/progression.ts:110-118`, non strict) ignore la clé en trop, et une
  réponse « cours » lue par un front ancien échoue au parse, ce que `lire()`
  (`web/lib/espace-eleve.ts:21-37`) traduit en « pas de bloc ». Le front construit le lien
  `/cours/{coursId}`.
- **Jauge** : `GET /api/progression/cours/{coursId}` → `{coursId, pourcentage, termine,
  sectionsLues, sectionsTotal}`. **204** si le cours n'est pas projeté **ou si l'élève de la
  session n'a aucune ligne** (`cours_suivis` ou `cours_sections_lues`) pour ce cours (I4) : la
  route ne révèle rien d'un cours que l'élève n'a jamais ouvert. Elle ne lit que les lignes de
  l'élève de la session et ne fait aucun appel sortant.

### 6. C9 (republication sans recul) : tenu pour les corrections, reformulé pour le reste

Grâce aux ids stables, une republication qui **ne change pas la liste** des sections et des
exercices (coquille, énoncé, réponse attendue, ordre, titre) laisse la jauge **identique**, et
un cours terminé reste terminé. En revanche, l'**ajout** d'une section ou d'un exercice fait
baisser le pourcentage (2/4 → 2/5), et la **suppression puis recréation** ou la **duplication**
d'un bloc (`dupliquerBloc`, `editeur-cours.tsx:407`) donne un nouvel exercice. Promettre le
non-recul dans ces cas obligerait à afficher un plancher fictif, en contradiction avec
`sectionsLues/sectionsTotal` affiché à côté et avec la règle « jamais une valeur que le back n'a
pas ». C9 est reformulé (porte 1) :

> *Given une jauge à X %, When l'enseignant republie sans ajouter, supprimer ni recréer de
> section ou d'exercice, Then la jauge reste à X % ; And un cours terminé reste terminé quelle
> que soit la republication ; And le nombre de sections lues d'un élève ne baisse jamais à la
> suite d'un ajout.*

### 7. Mode interactif sur les cours (amende l'ADR 0032 l.271-272)

`ModeChapitreProvider` reçoit une cible discriminée (`chapitre` | `cours`). Pour un cours, le
signal « section lue » vise l'endpoint du §1, le bilan lit la jauge du §5, et la diapo de fin
n'a pas de « suivant » : elle renvoie à la liste des cours (aucun ordre entre cours). Ses libellés
disent « cours » et non « chapitre » (« Fin du cours », « Cours terminé »,
`fin-de-chapitre.tsx`), sans annoncer de bonus (S4). La logique d'historique de l'ADR 0046 (PL-3,
mergé) n'est pas touchée. La page `/cours/[coursId]` est modifiée **après** le merge de PL-6a
(#398), qui la réécrit.

## Données de mineurs (ADR 0018)

- **Finalité** : permettre à l'élève de suivre **sa propre** progression dans les cours que son
  enseignant lui a donnés (jauge, « Reprendre », XP). Même finalité que pour les chapitres
  (ADR 0022). Aucune finalité d'évaluation ni de classement.
- **Personnes concernées** : élèves de 11 à 15 ans inscrits dans une classe à laquelle un cours
  publié est porté. Grâce aux contrôles des §1 et §3, aucune ligne ne peut être créée pour un
  élève hors portée au moment de l'action (I3). Un élève retiré ensuite garde sa propre trace
  (voir « Retrait d'accès »).
- **Catégories de données** : identifiant de compte de l'élève (UUID pseudonyme) ; identifiant
  du cours ; identifiant de section ou clé d'exercice ; horodatages de lecture, de réussite et
  de fin ; lignes d'XP (type, référence, points, date). **Aucune** classe, aucun nom, aucun
  contenu de réponse : les réponses restent dans `exercices.soumissions`, traitement existant.
  Copie transitoire : `SectionCoursLue` porte l'`eleveId` et est sérialisé dans
  `system.event_publication`, supprimé à la complétion (`application.properties:85`,
  `completion-mode=delete`) mais conservé si le listener échoue, comme `SectionTerminee`
  aujourd'hui (S6). Les tables structurelles (`progression.cours`, `cours_elements`) ne sont pas
  des données personnelles.
- **Qui peut lire** : l'élève seul, par les endpoints `progression` dont l'identité vient de la
  session (`/api/progression/cours/{id}`, `/reprendre`, `/moi`). **Aucun** endpoint enseignant,
  établissement ou administrateur. La vue enseignant de la progression de ses élèves est hors
  périmètre : ce serait un nouveau traitement N3, distinct.
- **Base légale** : celle du compte de l'élève (ADR 0018 §1, voie A ou B), sans changement.
  ADR 0018 §3 reste la porte d'activation pour un établissement réel.
- **Durée de conservation (I1)** : **aucune durée n'est définie aujourd'hui ; la conservation est
  illimitée de fait** tant qu'aucune règle commune n'est posée. Ni les chapitres (V19-V20) ni les
  cours (V45) ne sont couverts par une purge : la seule purge existante est celle de `social`
  (ADR 0023 §6), et aucun chemin de suppression de compte n'existe. **Décision de l'humaine
  (2026-11-23)** : durée provisoire = **vie du compte** ; le ticket transverse **#435**
  (propriétaire : Gabrielle) fixe une durée concrète, l'effacement à la suppression d'un compte et
  la purge anticipée des lignes d'un cours qui n'est plus visible (I1c). **#435 doit être fermé
  avant** qu'un établissement réel active la voie A (ADR 0018 §3) ou qu'un compte voie B réel soit
  ouvert.
- **Retrait d'accès** : un cours retiré ou dépublié n'efface pas l'historique de l'élève (sa
  propre trace), mais ne lui est plus jamais proposé ni décompté hors de la page (jauge en 204
  si aucune ligne, « Reprendre » filtré). Ces lignes ne servant plus la finalité, la règle de
  conservation prévoit leur purge anticipée (I1c).
- **Registre des traitements (I2)** : aucune entrée n'existe ; ADR 0016, 0017 et 0018 renvoient
  à un registre futur, et `CAHIER-DES-CHARGES-V2.md:258` exige qu'il soit écrit **en même temps**
  que les migrations. Lieu (décision de l'humaine, 2026-11-23) : **dans le dépôt**,
  `docs/rgpd/registre-des-traitements.md`, créé par PL-6b avec V45. Entrée **complète**
  proposée, pour les chapitres **et** les cours :

  > **Suivi de progression de l'élève**
  > - *Finalité* : afficher à l'élève seul sa progression (XP, niveau, série, maîtrise par
  >   compétence, jauge et point de reprise des chapitres et des cours de son enseignant).
  > - *Personnes concernées* : élèves inscrits (11-15 ans) ; pour les cours, ceux des classes
  >   auxquelles le cours est porté.
  > - *Catégories* : identifiant pseudonyme du compte ; identifiants de chapitre, de cours, de
  >   section, d'exercice (UUID ou clé) et de compétence ; horodatages de lecture, de réussite,
  >   d'activité et de fin ; lignes d'XP (type, référence, points, date) ; solde et niveau ;
  >   série (jours actifs, gels) ; maîtrise (niveau, échantillon) et projection des soumissions
  >   par compétence (correct, score, première tentative, difficulté) ; copie transitoire de
  >   l'identifiant dans `system.event_publication` pour un événement non abouti.
  > - *Destinataires* : l'élève seul. Aucun accès enseignant, établissement ou administrateur.
  > - *Base légale* : celle du compte de l'élève (ADR 0018 §1, voie A ou B).
  > - *Durée* : vie du compte, à titre provisoire ; durée concrète et effacement à fixer par #435,
  >   avant toute activation réelle (ADR 0018 §3).
  > - *Mesures* : pseudonymat (UUID, aucun nom ni classe dans le schéma `progression`), identité
  >   tirée de la session sur toutes les routes, aucune donnée hors UE, XP sans boucle pilotable
  >   par l'élève (unicité des clés, plafond quotidien).

## Réserves de V5 et leur traitement

| Réserve (rapport V5, 2026-11-18, tour 1) | Traitement dans ce texte |
|---|---|
| **I1** — « La durée de conservation est présentée comme alignée sur les chapitres, alors qu'elle est en fait illimitée. » | (a) formule remplacée par « aucune durée définie ; conservation illimitée de fait » ; (b) durée signée (point n° 2, #435) ; (c) purge anticipée des lignes d'un cours qui n'est plus visible incluse dans la règle. Fait nouveau : la purge `social` (ADR 0023 §6) existe et sert de modèle, mais ne couvre pas `progression`. |
| **I2** — « Le texte du registre étend une entrée qui n'existe pas. » | Entrée **complète** « Suivi de progression de l'élève » (chapitres et cours, `evenements_xp`, série, maîtrise, `event_publication`) ; lieu du registre signé (point n° 3). |
| **I3** — « Un exercice de cours peut être soumis hors portée. » | Option (a) retenue au §3 (point n° 4) : contrôle dans `exercices` avant évaluation, 403/404, ni soumission ni événement. Section « Personnes concernées » rendue exacte. Interaction avec les devoirs vérifiée (aucun cas nouveau). |
| **I4** — « La jauge répond sans contrôle de portée. » | 204 si l'élève n'a aucune ligne pour ce cours (§5, point n° 5). Test C12 étendu : élève B sans lecture → 204. |
| **S1** — titre de brouillon dans « Reprendre » | Le titre renvoyé est celui de la version publiée, celui de la page (§2). |
| **S2** — l'amorce ne touche jamais aux faits d'un élève | Règle écrite au §4 et figée par un test. |
| **S3** — une seule implémentation du prédicat | §2 : même méthode que `estVisiblePour`, test de parité « 200 sur `GET /api/cours/{id}` ⇔ présent dans `titresVisiblesPourEleve` », javadoc de `CoursAccesApi` mise à jour. |
| **S4** — libellés de la diapo de fin | §7 : « Fin du cours », « Cours terminé », aucun bonus annoncé. |
| **S5** — citations du plan | Lignes recitées au SHA `8b3c450` (`CoursController.java:80-87`) ; la borne à 128 est prouvée par un test, sans code nouveau. |
| **S6** — `event_publication` | Cité dans les catégories et dans l'entrée du registre ; inclus dans la règle de conservation. |

## Points signés par l'humaine (N3, 2026-11-23)

1. Le traitement (option A), avec la section « Données de mineurs », et l'amendement de
   l'ADR 0022 §3 (§2). *Avis V5 : favorable une fois I1-I3 corrigés ; l'exception filtre et
   n'élargit rien.*
2. La **durée de conservation** des données de progression (chapitres et cours) : vie du compte,
   provisoire, et ticket #435 à fermer avant toute activation réelle.
3. Le **lieu du registre** des traitements (`docs/rgpd/registre-des-traitements.md`) et l'entrée
   « Suivi de progression de l'élève ».
4. Le **contrôle de portée à la soumission** d'un exercice de cours dans PL-6b (§3).
5. La **jauge en 204** pour un cours sans ligne de l'élève (§5).
6. Les écarts de barème : sections de cours **comptées** dans le plafond ; exercices `paper`
   **exclus** du total d'un cours. *Avis V5 : favorable aux deux.*
7. La reformulation de **C9** (§6). *Avis V5 : favorable.*

## Consequences

### Positive
- Un cours du prof a une jauge, entre dans « Reprendre » et ouvre le mode interactif, comme un
  chapitre.
- La boucle d'XP par republication (V26 l.77-84) est fermée.
- C11 est garanti par construction, y compris pour un élève sorti de sa classe.
- Plus aucune réussite de cours ne peut être écrite hors portée (§3).
- L'idempotence est structurelle et les paires concurrentes sont couvertes par des tests à
  contre-épreuve (plan technique #400 §7).
- `progression` ne stocke aucune donnée de classe.

### Negative / trade-offs
- ADR 0022 §3 n'est plus absolu : une lecture synchrone depuis `progression.web`.
- Les réussites d'exercices de cours antérieures à la livraison ne comptent pas dans la jauge
  (jamais enregistrées ; les reprendre exigerait une lecture inter-schéma interdite par l'ADR 0007).
- Transition XP : un exercice déjà réussi sur une **autre** version peut rapporter une fois de plus.
- L'ajout de contenu par l'enseignant fait baisser le pourcentage. C'est honnête, mais visible.
- L'amorce réémet un événement par cours publié à chaque démarrage, soit à chaque déploiement.
- Une soumission sur un cours retiré renvoie désormais 403 (l'onglet resté ouvert ne marque plus).

### Follow-ups
- Signal P1 : `ChapitrePublie` compte les exercices `paper` dans le total des chapitres.
- #435 : conservation et effacement des données `progression` (chapitres et cours), avant toute
  activation réelle.
- Signal P1 : la liste « Mes cours » (`CoursLectureService.coursVisiblesPour`, l.90) affiche le
  titre du brouillon, pas celui de la version publiée (même incohérence que S1, hors périmètre).
- Notes « amendé par 0050 » sous ADR 0022 §3 et ADR 0032 (cours d'enseignant), posées par P3.

## Alternatives considered

- **Option B, tout par événements** : rejetée (quatre événements dont deux dans `identite`, copie
  de l'appartenance aux classes, fenêtre d'impasse asynchrone).
- **Option C, filtrage dans le front** : rejetée (C11 porté par chaque client, cours retirés exposés).
- **Élargir `SectionTerminee`** avec un discriminant : rejeté (changerait la sémantique d'un
  contrat existant et mélangerait les clés d'XP).
- **Réutiliser les tables V20** avec un type : rejeté (indexées sur l'UUID d'exercice, `ordre`
  NOT NULL, `parcours()` lirait des lignes étrangères à une piste).
- **Plancher de pourcentage** pour tenir C9 à la lettre : rejeté (chiffre fictif).
- **Projeter le titre dans `CoursPublie`** : écarté. Le titre de version est immuable, mais la
  visibilité doit de toute façon être lue fraîche (§2) ; renvoyer le titre au même appel évite une
  colonne de plus.
- **Contrôle de portée à la soumission dans un ticket séparé (I3b)** : écarté, il laisserait
  écrire des réussites de cours hors portée dès la livraison.
- **Bonus de complétion de 50 XP** : écarté par l'humaine (Q2 → B).
- **Lire les réussites passées dans `exercices.soumissions`** par une migration : rejeté (ADR 0007).

## Liens

- Issues #400 (PL-6b), #398 (PL-6a, fiche besoin), #435 (conservation), épopée #358 ; PL-3 #396
  (ADR 0046).
- ADR 0007, 0018, 0019, 0022, 0023 §6, 0029, 0032, 0046.
- `docs/mesh/CONTRATS.md` §5 et §6.
