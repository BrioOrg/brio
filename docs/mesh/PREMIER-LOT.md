# Le premier lot — ce que le mesh traite en premier

Règle du plan : **les impasses passent avant tout**. Une impasse casse la confiance plus
vite qu'une fonctionnalité absente, et le produit est utilisé par des mineurs. Viennent
ensuite les routes chaudes, puis le contenu, puis le rodage des agents eux-mêmes.

Ce document est la file d'entrée de P1. Chaque ligne devient une issue `mesh:inbox`
(contrat **Signal**, voir [`CONTRATS.md`](CONTRATS.md)) ; **aucune issue n'est encore
ouverte** : ouvrir les issues est un geste de P1 ou de l'humain.

> **Budget de clics.** Les critères de fin qui parlent de clics se mesurent contre le
> tableau « budget de clics » publié par la Phase 2 (U1, carte des routes). Ce fichier ne le
> recopie pas pour ne pas créer une seconde vérité : il le cite par **nom de tâche clé**.
> Tant que ce tableau n'est pas publié, le critère « budget tenu » signifie « pas plus de
> clics qu'aujourd'hui, mesurés avant/après par U1 ». *(Lien à renseigner dès la
> publication du tableau.)*

> Les tickets sont notés `PL-…` (premier lot) pour ne pas les confondre avec les IDs
> d'agents (B1 Architecte technique, L1 Intégrateur…) qui apparaissent dans les chaînes.

## Statut des constats

La colonne « Constat » indique comment chaque ticket a été établi. Aucun n'a encore été
confirmé par U1 ni rejoué par les personas (S2/S3), car ces agents n'existent pas
encore : ce sont des **candidats relevés à la lecture du code** (état du dépôt au
12 novembre 2026). U1 (cartographie) et S3 (saboteur) les **confirment ou les infirment
avant** toute fiche besoin ; un constat infirmé sort du lot.

## A · Impasses (d'abord)

| # | Titre | Chaîne d'agents | Critère de fin | Constat |
|---|---|---|---|---|
| PL-A0 | **Recenser toutes les impasses** de l'app élève et enseignant | U1 (carte) · S3 (parcours en cul-de-sac) · S4 → P1 | Liste exhaustive des écrans sans sortie utile, chacun ouvert en **Signal** `impasse` reproductible ; PL-A1 à PL-A4 confirmés ou retirés | Prérequis de PL-A1 à PL-A4 |
| PL-A1 | Les écrans vides de navigation ne mènent nulle part | P2 → U1, U3 → U4, U5 → B1 → B3 → B5 → V6, U7 → L1 | Aucun état vide du catalogue (`explorer`, `[niveau]`, `[matiere]`) sans lien visible vers une destination peuplée ; budget des tâches « trouver un chapitre » tenu ; test e2e par état vide | `web/app/(app)/explorer/page.tsx`, `[niveau]/page.tsx`, `[niveau]/[matiere]/page.tsx` : « Le catalogue arrive bientôt », « Aucune matière / Aucun chapitre pour l'instant », sans action. Au 12/11 le contenu ne couvre que 6e et 5e (1 chapitre chacun), 4e et 3e vides (`content/chapitres/`) |
| PL-A2 | « Cours indisponible » ne propose aucune sortie | P2 → U1, U5 → B1 → B3 → B5 → V6, U7 → L1 | L'écran d'erreur de `/cours/[coursId]` offre un retour vers l'accueil ou Explorer, au clavier ; message différencié « inaccessible avec ton compte » vs « inexistant » seulement si le backend les distingue | `web/app/(app)/cours/[coursId]/page.tsx` : fil d'Ariane sans lien, aucun bouton |
| PL-A3 | « Aucune annale disponible » sans sortie ni explication | P2 → U1, U5 → B1 → B3 → V6 → L1 | Texte nu remplacé par un état vide conforme au kit Arcade avec destination ; lien clair vers l'entraînement par compétence quand il existe | `web/components/annales-eleve.tsx` : `<p>` simple ; une seule annale démo dans `content/annales/` |
| PL-A4 | Le bouton « Se connecter avec mon établissement » est désactivé | **Conseil N2** (P2 + B1 + U3) → B3 si retrait → V6, U7 → L1 | Décision écrite (ADR ou commentaire « Décision ») : retirer le bouton ou le garder ; si retiré, plus aucun contrôle désactivé sans explication sur `/connexion` | `web/components/login-form.tsx` : bouton `disabled`, « (bientôt) », aucun endpoint back. Choix de produit : le plan ne tranche pas |

Pas dans le lot (volontairement) : l'onglet **Communauté** désactivé dans la barre de
navigation (`web/components/bottom-nav.tsx`). Il est désactivé **à dessein** tant que les
conditions du suivi #338 ne sont pas levées ; c'est une décision N3 humaine, pas une
impasse à corriger.

## B · Routes chaudes

Tâches clés **proposées** — à valider par P2 et U1, qui fixent les valeurs définitives du
tableau « budget de clics ». Ordre = ordre de mesure.

| # | Titre | Chaîne d'agents | Critère de fin | Constat |
|---|---|---|---|---|
| PL-B1 | **Mesurer la profondeur de clics** des cinq tâches clés (reprendre le dernier chapitre · ouvrir un devoir à rendre · trouver un chapitre par niveau→matière→chapitre · poser une question au tuteur · s'entraîner par compétence) | U1 → U2 (mesure anonyme à venir) → P2 | Tableau « budget de clics » publié et validé par l'humain, mobile et ordinateur ; budget par tâche arrêté | Prérequis du budget en CI (Phase 2) |
| PL-B2 | Ramener dans le budget toute tâche clé qui le dépasse | P2 → U1, U3, U4, U5 → B1 → B3 → B5 → V6, U6, U7 → S2 → L1 | Pour chaque tâche : clics ≤ budget mobile **et** ordinateur, mesurés avant/après par U1 puis rejoués par S2 ; aucun veto de U1 | Dépend de PL-B1 ; un ticket par tâche hors budget, ouvert seulement après mesure |
| PL-B3 | Le tuteur et les devoirs depuis l'accueil sans détour | P2 → U1, U3 → … (même chaîne que PL-B2) | Les blocs « à rendre » et « à reprendre » de l'accueil mènent à la destination finale en un clic, sans écran intermédiaire | Illustre le cas du skill `/feature` ; à confirmer par PL-B1 avant ouverture |

## C · Contenu

| # | Titre | Chaîne d'agents | Critère de fin | Constat |
|---|---|---|---|---|
| PL-C1 | Premier chapitre de **4e** (mathématiques), jamais publié sans V4 | P2 → B1 → B4 → V4, V5 → L1 | Chapitre ingéré, exercices recalculés par V4 (aucune erreur disciplinaire), typographie conforme `content.md`, sujet visible dans Explorer **sans** état vide (clôt le constat de PL-A1 pour la 4e) | `content/chapitres/4e/` absent. Issues existantes #234 et #237 (Scratch et assemblages, 4e) à rattacher plutôt que dupliquer |
| PL-C2 | Un deuxième sujet d'**annale** officiel de 3e | P2 → B1 → B4 → V4 → L1 | Sujet de source officielle publique (Licence Ouverte) ingéré, corrigé par V4, accessible depuis « Annales » | Une seule annale de démonstration (`content/annales/3e/mathematiques/brevet-2025-demo`) |

## D · Rodage du mesh

Tickets internes : ils donnent aux agents des portes 7 et 8 un premier cas réel.

| # | Titre | Chaîne d'agents | Critère de fin | Constat |
|---|---|---|---|---|
| PL-D1 | Premier audit des dépendances | L3 → V1 → L1 | Rapport (Maven et pnpm) : vulnérabilités, licences, mises à jour proposées en PR `chore(deps)` groupées, aucune majeure sans notes de migration | Aucun audit automatisé dans le dépôt |
| PL-D2 | Smoke de staging sur les routes chaudes | L2 → P1 | Rejeu des routes de PL-B1 après un déploiement réel, « staging sain 24 h » consigné au journal ; un faux incident volontaire produit bien un Signal et une proposition de retour arrière (snapshot listé, jamais exécuté) | Dépend de PL-B1 et de l'app GitHub Claude sur `BrioOrg` |

## Ordre d'exécution

1. **PL-A0** d'abord, car il confirme ou retire PL-A1 à PL-A4. En parallèle **PL-B1**, qui ne touche pas au code.
2. **PL-A2** et **PL-A3** (petits, un seul écran chacun), puis **PL-A1**, plus large.
3. **PL-A4** en conseil N2 pendant que les autres avancent : c'est une décision, pas du code.
4. **PL-B2** et **PL-B3** une fois le budget publié, un ticket par tâche hors budget.
5. **PL-C1** dès que PL-A1 est livré, puis **PL-C2**. **PL-D1** n'a aucune dépendance et peut partir à tout moment ; **PL-D2** après la première livraison.

## Candidat pour la preuve de la Phase 4

La preuve attendue (« un ticket du premier lot livré sans intervention avant le merge »)
porte sur **PL-A2** : un seul écran, un seul composant, aucune donnée nouvelle, aucun risque
mineur ni route chaude, donc un test honnête de toute la chaîne. Elle suppose les phases
2 (parcours, UI) et 3 (vérification) livrées ; **ce lot n'est pas encore exécuté**.

Chaque ticket livré laisse une ligne dans le journal (`docs/mesh/JOURNAL.md`) et, s'il a
coincé, une **Leçon** (contrat 10).
