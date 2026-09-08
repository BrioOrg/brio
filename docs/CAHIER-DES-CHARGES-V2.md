# Brio — Cahier des charges v2

**De la plateforme de contenu à la plateforme de classe**

Établi le 31 août 2026 · prolonge la feuille de route technique du 19 août 2026
(E1 → E10), qui reste valable pour tout ce qu'elle couvre.

---

## 0. Comment lire ce document

Les estimations sont en **jours**, dans la même unité que la feuille de route :
1 j ≈ une session de 5 h, relecture comprise.

Chaque chantier est numéroté **F0 → F7**. La numérotation encode **l'ordre de
dépendance**, pas un ordre de préférence : F0 ne peut pas être doublé, F6 ne peut
pas être avancé.

Trois types d'encadrés :

- **Décision à acter** — un ADR à écrire avant d'ouvrir un éditeur. Il y en a huit.
- **Ne pas accepter sans comprendre** — ce qu'une IA de codage te proposera un jour
  et que tu ne dois pas merger tel quel.
- **À comprendre** — l'invariant qu'il faut tenir pour garder le contrôle du produit.

Ce document ne réécrit pas la feuille de route d'août. Il part de là où elle
s'arrête, et il constate que les fonctionnalités demandées déplacent la nature du
produit — ce qui change l'ordre, pas les principes.

---

## 1. État des lieux au 31 août 2026

### 1.1 Ce qui existe

| Module | État | Détail |
|---|---|---|
| `contenu` | **solide** | Schéma v1 (9 types de blocs), ingestion idempotente (ADR 0010), référentiel de 205 compétences (116 cycle 3, 89 cycle 4), catalogue niveaux → matières → chapitres, URLs sémantiques (ADR 0011) |
| `exercices` | **partiel** | Soumissions + 3 évaluateurs (`numeric`, `multiple-choice`, `short-answer`). `free-text` et le travail « sur feuille » n'ont **aucun** évaluateur |
| `ia` | **solide** | Tuteur v1 plein-chapitre, citations vérifiées côté serveur, refus, harnais d'éval (40 cas, 5 chapitres, 4 familles), règle « pas de changement de prompt sans éval » inscrite dans `CLAUDE.md` |
| `web` | **solide** | Next.js App Router, 4 routes de catalogue + chapitre, KaTeX, figures déclaratives SVG, panneau tuteur, kit Arcade, thèmes clair/sombre |
| design | **solide** | `tokens.css` opposable, lint de dérive + contrôle de contraste en CI, `/design`, `PRINCIPLES.md`, `BACKLOG.md` |
| `identite` | **vide** | Un `package-info.java`. Basic auth `dev/dev`. `student_ref VARCHAR(256)` non contraint |
| `progression` | **vide** | Un `package-info.java` |
| `social` | **vide** | Un `package-info.java` |
| déploiement | **inexistant** | Rien de déployé. Aucun élève réel n'a jamais ouvert Brio |

### 1.2 Le stock de contenu

5 chapitres publiés, 57 exercices, **1 matière**, **2 niveaux sur 4** :

| Niveau | Chapitres | Exercices |
|---|---|---|
| 6e | 4 (thème 1 complet : numération, comparaison, opérations, fractions) | 52 |
| 3e | 1 (théorème de Pythagore) | 5 |

Le pipeline de contenu est prouvé de bout en bout. **Le stock ne l'est pas.**
L'étape E5 de la feuille de route (« premier lot de 8–12 chapitres ») est à
mi-chemin, et c'est aujourd'hui ce qui sépare Brio d'un produit qu'on peut
ouvrir à quelqu'un.

### 1.3 Le diagnostic honnête

Trois choses sont vraies en même temps, et la troisième est celle qu'on oublie :

1. **L'infrastructure éditoriale est meilleure que la moyenne.** Contenu-as-code,
   ingestion idempotente, référentiel officiel, éval du tuteur : ce sont des actifs
   que la plupart des projets à ce stade n'ont pas.
2. **Le produit n'a pas d'utilisateurs, et rien dans le code ne sait ce qu'est un
   utilisateur.** Les trois modules qui restent vides sont exactement les trois dont
   dépendent les cinq fonctionnalités demandées.
3. **Le `BACKLOG.md` du design est un journal de dette produit, pas un journal de
   design.** L'atlas, les verrous, l'XP, la série, les pourcentages : cinq éléments
   de l'identité visuelle sont bloqués par un seul module absent, `progression`.
   La règle « ne jamais afficher une donnée que le back n'a pas » tient — mais elle
   tient au prix d'un produit visuellement amputé de sa propre direction artistique.

---

## 2. Ce que les fonctionnalités demandées changent

Les cinq fonctionnalités ne sont pas cinq features de plus dans une file. Quatre
sur cinq supposent qu'on sache **qui est l'élève, dans quelle classe, avec quel
enseignant** :

| Demande | Ce qu'elle suppose |
|---|---|
| Chat élèves / enseignants | Comptes, classes, rôles, modération, responsabilité éditoriale |
| Cours créés par l'enseignant | Comptes enseignants, rattachement des élèves, contenu créé **hors de git** |
| Annales et entraînement | Rien de nouveau — c'est du contenu, voie indépendante |
| Import de copie corrigée par l'IA ou l'enseignant | Comptes, stockage de fichiers de mineurs, lien élève ↔ correcteur |
| XP, dont XP d'entraide | Comptes, et un espace d'entraide où « aider » soit observable |

Brio cesse d'être **un produit de contenu consulté par un élève anonyme** pour
devenir **une plateforme de classe**. Trois conséquences immédiates :

1. `identite` n'est plus l'étape E7 d'une file : c'est le socle, et il passe devant
   tout le reste. La feuille de route d'août avait raison de le repousser — à
   l'époque, rien n'en avait besoin. Ce n'est plus vrai.
2. Le RGPD cesse d'être un chantier de conformité de fin de parcours et devient un
   **paramètre de conception**. Copies manuscrites de mineurs, messages entre
   mineurs, données scolaires rattachées à un établissement : chacun de ces trois
   ajoute une obligation qui se décide au moment du schéma, pas après.
3. Le contenu a désormais **deux origines** : le catalogue Brio (git, ADR 0008) et
   les cours d'enseignant (créés dans l'application). C'est une contradiction
   frontale avec l'ADR 0008, et elle doit être tranchée explicitement plutôt que
   contournée dans un coin du code.

> **À COMPRENDRE**
>
> La question n'est pas « comment ajouter un éditeur ». Elle est : *où vit la
> vérité éditoriale quand il y a deux auteurs de nature différente ?* Tant que
> cette question n'a pas de réponse écrite, chaque session de code inventera la
> sienne, et elles ne seront pas compatibles.

---

## 3. Ordre d'exécution priorisé

### 3.1 Deux voies parallèles

Le travail se sépare en deux voies qui ne se bloquent pas :

- **Voie produit** (F0 → F6) : séquentielle, chaque chantier dépend du précédent.
- **Voie contenu** : finir E5 (chapitres 6e → 3e), puis les annales (F7). Aucune
  dépendance au code, aucune dépendance à l'identité. **C'est la voie qui décide si
  le produit vaut la peine d'être ouvert**, et elle peut avancer un soir où la voie
  produit est bloquée.

### 3.2 La voie produit

| # | Chantier | Ce que ça débloque | Dépend de | Estim. |
|---|---|---|---|---|
| **F0** | **Identité, classes, rattachement scolaire** | Tout. Rien d'autre ne commence avant | — | **14–21 j** |
| **F1** | **Déploiement et exploitation** | Des élèves réels peuvent ouvrir le produit ; sans ça F0 est théorique | F0 | **5–8 j** |
| **F2** | **Progression et XP** | La boucle d'apprentissage se ferme ; 5 entrées du `BACKLOG.md` design se débloquent | F0 | **10–15 j** |
| **F3** | **Éditeur de cours enseignant** | Le différenciateur produit. Un enseignant devient auteur | F0 | **19–27 j** |
| **F4** | **Devoirs, échéances, rendus** | Le scénario complet « ma classe, mon cours, mes devoirs » | F3 | **8–12 j** |
| **F5** | **Import de copie et correction** | Le travail sur papier entre dans le produit | F4 | **7–10 j** |
| **F6a** | **Entraide (fils de discussion sur un chapitre)** | L'XP d'entraide devient possible ; 80 % de la valeur du « chat » | F2, F1 | **6–9 j** |
| **F6b** | **Messagerie de classe** | Le canal conversationnel complet | F6a | **10–15 j** |

**Total voie produit : 79 à 117 jours**, soit **4,5 à 7 mois calendaires** à ton
rythme. La voie contenu s'y ajoute sans s'y additionner : compte 1 à 1,5 j par
chapitre et 1 à 1,5 j par sujet d'annales.

### 3.3 Les trois choix d'ordre qui méritent une justification

**Le déploiement (F1) passe devant tout sauf l'identité.** Tant que rien n'est
déployé, le module `identite` est une abstraction : on ne sait pas si le parcours
de consentement fonctionne, si les cookies de session survivent au proxy, si un
collégien sur un téléphone 4G arrive à créer son compte. Un module d'authentification
non déployé n'est pas un module d'authentification, c'est un test d'intégration.

**Le chat arrive en dernier, et il est coupé en deux.** C'est la seule fonctionnalité
dont le mode d'échec n'est pas un bug mais un incident impliquant un mineur. Elle a
besoin de tout ce que les chantiers précédents construisent : rôles, classes,
enseignant identifié comme modérateur, conditions d'utilisation, journalisation.
Mais **l'essentiel de sa valeur n'a pas besoin d'attendre** : un fil de discussion
attaché à un chapitre — asynchrone, visible de toute la classe, modéré par
l'enseignant, sans messages privés — livre l'entraide, alimente l'XP d'entraide, et
porte une fraction du risque de la messagerie complète. C'est F6a, et il peut
arriver juste après l'XP.

**L'XP (F2) passe devant l'éditeur (F3) alors que l'éditeur est le différenciateur.**
Raison : F2 coûte trois fois moins cher, débloque cinq entrées du backlog design, et
transforme l'impression du produit dès la première session. F3 est le plus gros
chantier du document et il n'a pas de version courte. **Si le pilote enseignant est
la priorité commerciale, inverse F2 et F3** — c'est le seul endroit de cette liste
où l'ordre est un arbitrage et pas une contrainte.

---

## 4. Décisions à acter en ADR avant d'écrire du code

Chacune suit le template existant (`docs/adr/template.md`). Les trois premières
conditionnent tout le reste.

| ADR | Décision à acter | Alternatives à peser | À trancher avant |
|---|---|---|---|
| **0016** | **Double origine du contenu** : la base reste une projection re-dérivable pour l'origine `catalogue`, et devient **source de vérité** pour l'origine `enseignant` | Cours d'enseignant écrits dans git via l'API GitHub ; second schéma et second moteur de rendu ; CMS tiers | F0 — tout F3 en découle |
| **0017** | **Modèle scolaire** : établissement / classe / rôles, création des comptes élèves par l'enseignant, code d'invitation, pseudonyme sans e-mail élève, consentement du titulaire légal < 15 ans | Comptes élèves auto-créés avec e-mail ; SSO ENT/GAR dès le départ ; Keycloak auto-hébergé | F0 |
| **0018** | **Sessions cookie + Spring Security**, CSRF réactivé, basic auth interdite hors profil `local` (fail-fast au démarrage) | JWT ; auth déléguée SaaS | F0 |
| **0019** | **Éditeur par blocs** : l'enseignant compose une structure, jamais un style. Nouveaux types de blocs additifs, aucun HTML libre, aucune couleur, aucune police | Éditeur riche type WYSIWYG ; Markdown libre ; import de PDF | F3 |
| **0020** | **Devoirs** : module `devoirs` séparé, référence les autres modules par identifiant, écoute les événements de soumission | Étendre `exercices` ; étendre `contenu` | F4 |
| **0021** | **Import et correction de copie** : stockage objet en UE, correction par l'enseignant en v1, transcription IA en v2 sous validation humaine, aucune note sommative produite par l'IA seule | OCR maison ; service tiers de reconnaissance d'écriture dès la v1 | F5 |
| **0022** | **XP et maîtrise** : XP idempotent par `(élève, source, motif)`, plafond quotidien, pas de classement public entre élèves, maîtrise par compétence dérivée des soumissions | Classement de classe ; XP par message ; niveaux calculés côté client | F2 |
| **0023** | **Messagerie scolaire** : périmètre, rétention, chaîne de modération, obligations LCEN/DSA, protocole en cas de signal de détresse | Messages privés élève ↔ élève dès la v1 ; temps réel WebSocket ; hébergement d'images | F6a |

> **NE PAS ACCEPTER SANS COMPRENDRE**
>
> Une session de vibe coding te proposera de faire vivre les cours d'enseignant
> dans `content/` avec un commit automatique à chaque enregistrement. C'est
> séduisant — « une seule source de vérité » — et c'est faux. Cela met le dépôt
> dans le chemin critique d'une action utilisateur, fait de chaque brouillon
> d'enseignant un commit, et transforme un conflit de merge en erreur 500 pendant
> un cours. La bonne réponse est d'assumer deux origines dans un seul schéma
> (ADR 0016), pas d'en nier une.

---

## 5. F0 — Identité, classes, rattachement scolaire

**Estimation : 14–21 j.** Dépend de : rien. Bloque : tout le reste.

### Objectif

Un enseignant crée un compte, crée une classe, obtient un code d'invitation, et ses
élèves rejoignent la classe. À partir de là, chaque soumission, chaque message,
chaque XP est rattaché à une personne connue et à un contexte scolaire.

### Périmètre

1. **Modèle** (schéma `identite`) :

```
identite.etablissements  (id, nom, uai, type[college|lycee], created_at)
identite.comptes         (id, role[eleve|enseignant|admin_etab|admin_brio],
                          pseudonyme, email, email_titulaire_legal, mot_de_passe_hash,
                          etablissement_id, statut[actif|en_attente_consentement|suspendu|clos],
                          created_at, dernier_acces_at)
identite.classes         (id, etablissement_id, niveau_code, libelle, annee_scolaire,
                          enseignant_principal_id, statut)
identite.inscriptions    (classe_id, compte_id, role_dans_classe, depuis, jusqua)
identite.invitations     (code, classe_id, cree_par, expire_at, usages_max, usages)
identite.consentements   (compte_id, type, donne_par_email, donne_at, preuve, revoque_at)
identite.sessions        (id, compte_id, cree_at, expire_at, ip_tronquee, user_agent_hash)
```

2. **Minimisation des données élève** : pseudonyme + niveau + e-mail du titulaire
   légal. **Pas** de nom, pas de prénom obligatoire, pas de date de naissance
   complète (mois/année suffisent pour la règle des 15 ans), pas de photo de profil.
   L'enseignant voit ses élèves sous le prénom qu'il a saisi dans **sa** liste de
   classe, stockée comme un alias local à la classe — pas comme une identité globale.
3. **Parcours de consentement < 15 ans** (art. 45 loi Informatique et Libertés) :
   l'élève crée son compte avec le code de classe → statut
   `en_attente_consentement` → e-mail au titulaire légal → validation → compte actif.
   Un compte en attente peut **lire** le catalogue public et rien d'autre.
4. **Authentification** : sessions cookie `HttpOnly` `Secure` `SameSite=Lax`,
   Spring Security, CSRF réactivé (et `CorsConfig` mis en cohérence — la note dans
   `SecurityConfig` le prévoit déjà). Basic auth conservée sur le profil `local`
   uniquement, avec **échec au démarrage** si elle est active hors `local`.
5. **Migration `student_ref`** : `exercices.soumissions.student_ref VARCHAR(256)` →
   `eleve_id UUID NOT NULL`. Pas de FK inter-schémas (ADR 0007) : la référence est
   un identifiant, l'intégrité est applicative. Les soumissions existantes en dev
   sont jetées, pas migrées.
6. **UI** : connexion, création de compte enseignant, création de classe, écran de
   code d'invitation, entrée élève par code, page « ma classe » minimale.

### Hors périmètre

SSO ENT/GAR (à trancher plus tard, voir §13), import d'une liste de classe depuis
un fichier, administration multi-établissements, réinitialisation de mot de passe
par SMS, comptes parents (F2 les introduira en lecture seule).

### Contraintes

- Aucune donnée personnelle d'élève ne sort du périmètre UE.
- Registre des traitements écrit **en même temps** que les migrations, pas après.
- Le mot de passe d'un collégien sera faible : verrouillage progressif après échecs,
  et pas de règle de complexité absurde qui poussera à l'écrire sur la trousse.

### Vérification exigée

Tests d'intégration : un élève d'une classe ne peut pas lire les soumissions d'une
autre ; un compte `en_attente_consentement` ne peut pas soumettre ; un code
d'invitation expiré est refusé ; le profil `prod` refuse de démarrer si la basic
auth est active. Test de bout en bout : enseignant → classe → code → élève → première
soumission attribuée.

### Définition de fini

Un enseignant et cinq élèves peuvent aller de l'inscription à une soumission
d'exercice attribuée, sur l'environnement déployé, sans intervention manuelle en
base. La politique de confidentialité et le registre sont écrits.

---

## 6. F1 — Déploiement et exploitation

**Estimation : 5–8 j.** Dépend de : F0. Reprend et étend E9 de la feuille de route.

### Périmètre

Hébergement en UE (Scaleway, Clever Cloud ou OVH — un VPS + Docker Compose +
reverse proxy TLS suffit ; pas de Kubernetes). PostgreSQL managé ou conteneurisé
avec **sauvegardes vérifiées par restauration réelle**, pas seulement programmées.
Secrets hors du dépôt. Déploiement automatique au merge sur `develop` vers un
environnement de recette, promotion manuelle vers la production. Journaux
applicatifs avec rétention bornée et **IP tronquées**. Supervision minimale :
disponibilité, erreurs 5xx, taux d'échec du tuteur, coût quotidien de l'API modèle.

### Contraintes

Le sous-traitant du modèle (Anthropic) doit être couvert par un DPA avec
non-conservation des prompts, et mentionné dans la politique de confidentialité —
les questions posées au tuteur sont des données personnelles de mineurs.

### Définition de fini

Une URL publique, un certificat valide, une restauration de sauvegarde testée et
datée, un déploiement déclenché par un merge, et un tableau de bord qui montre le
coût de la veille.

---

## 7. F2 — Progression, XP et maîtrise

**Estimation : 10–15 j.** Dépend de : F0. Débloque 5 entrées de `docs/design/BACKLOG.md`.

### Objectif

Fermer la boucle d'apprentissage : les soumissions alimentent une maîtrise par
compétence, et cette maîtrise rend enfin utile le référentiel construit en E1.
L'XP est la couche visible ; la maîtrise est la couche utile.

### Modèle (schéma `progression`)

```
progression.evenements_xp (id, eleve_id, source_type, source_ref, motif, points, created_at,
                           UNIQUE (eleve_id, source_type, source_ref, motif))
progression.soldes        (eleve_id PK, xp_total, niveau, calcule_at)
progression.series        (eleve_id PK, jours_consecutifs, dernier_jour_actif, gels_restants)
progression.maitrise      (eleve_id, competence_code, niveau SMALLINT, echantillon INT, maj_at,
                           PRIMARY KEY (eleve_id, competence_code))
```

> **À COMPRENDRE**
>
> La contrainte `UNIQUE (eleve_id, source_type, source_ref, motif)` **est** le
> dispositif anti-abus. Elle rend l'attribution d'XP idempotente : refaire dix fois
> le même exercice ne rapporte pas dix fois. Tout mécanisme anti-triche construit
> ailleurs (compteurs, heuristiques, détection) sera contournable ; celui-là est
> structurel, comme l'est déjà l'anti-divulgation du tuteur.

### Alimentation

`progression` **n'appelle personne** : il écoute des événements applicatifs
(Spring Modulith, table `event_publication` déjà en place) —
`SoumissionEnregistree`, `SectionTerminee`, `ChapitreTermine`, `RenduDepose`,
`ReponseUtileValidee`. C'est ce qui garde les frontières de modules propres et ce
qui permettra de recalculer l'historique.

### Barème proposé

| Événement | XP | Règle |
|---|---|---|
| Exercice réussi du premier coup | 10 | Une fois par exercice |
| Exercice réussi après erreur | 6 | Une fois par exercice — l'erreur ne coûte rien, elle rapporte moins |
| Section de leçon terminée | 2 | Une fois par section |
| Chapitre terminé (toutes sections + ≥ 80 % des exercices) | 50 | Une fois par chapitre |
| Devoir rendu avant l'échéance | 20 | Une fois par devoir |
| Réponse d'entraide marquée utile | 15 | Plafond 3/jour, révocable par un modérateur (F6a) |
| Série de jours | 0 | La série **ne s'achète pas** : elle se montre |

Plafond quotidien : 200 XP. Seuils de niveau quadratiques. Série avec un « gel »
hebdomadaire (idée du carnet, 25/08) et rupture sans culpabilisation, conformément
à `PRINCIPLES.md`.

### Maîtrise par compétence

Niveau 0 à 4 dérivé des `N` dernières soumissions portant la compétence, avec
pondération par la difficulté de l'exercice. Recalculable intégralement depuis
`exercices.soumissions` : c'est une projection, jamais une donnée saisie.

### Ce que ça débloque côté design

L'atlas et les verrous de chapitre, le badge de niveau, le compteur d'XP de la
barre supérieure, la flamme de série, le pourcentage de complétion sur les cartes
de chapitre. Les cinq entrées de `BACKLOG.md` nommaient `progression` comme unique
dépendance ; elles peuvent être construites dans le même lot, à partir des maquettes
gelées `2-parcours-atlas.html` et `1-connexion-matiere-parcours.html`.

### Hors périmètre

Classement entre élèves (voir §14), badges cosmétiques, boutique, notifications
push.

---

## 8. F3 — Éditeur de cours enseignant

**Estimation : 19–27 j.** Dépend de : F0. **C'est le différenciateur produit et le
plus gros chantier du document.**

### Objectif

Un enseignant compose son propre cours **avec les composants de Brio**, et le
résultat est indiscernable, en qualité de rendu, d'un chapitre du catalogue. Il
choisit la structure ; il ne choisit jamais le style. C'est ce qui fait que tous
les cours de la plateforme ont la même tenue — et c'est exactement l'inverse de
ce que produit un éditeur de texte riche.

### 8.1 Le principe architectural

**Un seul schéma, un seul moteur de rendu, deux origines.**

```
                    course-content.schema.json  (v2, additif)
                              │
              ┌───────────────┴───────────────┐
     origine = catalogue                origine = enseignant
     source : git /content              source : base (contenu.cours_versions)
     ingestion idempotente (ADR 0010)   écriture applicative, versionnée
              └───────────────┬───────────────┘
                              ▼
                    ChapitreContentApi  →  <ChapterView />
                    (le tuteur, les exercices, les figures : inchangés)
```

Conséquence à écrire noir sur blanc dans l'ADR 0016 : le job CI « base vierge +
ré-ingestion complète » ne doit purger **que** les lignes d'origine `catalogue`.
Le jour où un script de reconstruction efface le cours qu'un enseignant a écrit
la veille, la confiance ne revient pas.

### 8.2 Schéma v2 — les blocs à ajouter

Tous **additifs** : pas de bump de `schemaVersion` (règle 1 du §6 de la feuille
de route). Les blocs existants — `prose`, `heading`, `formula`, `image`, `figure`,
`callout`, `code`, `exercise` — restent disponibles à l'enseignant.

| Nouveau bloc | Rôle | Champs |
|---|---|---|
| `reference` | Citation d'une ressource, interne ou externe | `scope: internal\|external`, `url` ou `cible {niveau, matiere, slug, ancre}`, `titre`, `source`, `consulteLe` |
| `table` | Tableau de données (numérique, de variation, de conversion) | `entetes[]`, `lignes[][]`, `legende` |
| `steps` | Méthode en étapes numérotées — le format le plus demandé en maths | `titre`, `etapes[] {texte, formule?}` |
| `objectifs` | Objectifs du chapitre, adossés au référentiel | `competences[]` (validées contre `contenu.competences`) |

**Le bloc `reference` est la réponse à « citations vers des ressources externes ou
internes ».** En `scope: internal`, la cible est validée à l'enregistrement : un
lien vers un chapitre inexistant empêche la publication, exactement comme
`check-competencies.mjs` empêche un code inconnu. En `scope: external`, l'URL doit
être en `https`, le titre est saisi par l'enseignant, et le rendu réutilise le
composant `CitationChip` déjà écrit pour le tuteur — la citation d'un enseignant
et la citation du tuteur se ressemblent parce que ce sont la même chose.

> **NE PAS ACCEPTER SANS COMPRENDRE**
>
> Pas de bloc `video` avec intégration YouTube en v1. Une iframe YouTube dépose des
> cookies tiers et transfère l'adresse IP d'un mineur hors UE avant tout
> consentement. Un lien `reference` qui s'ouvre dans un nouvel onglet fait 90 % du
> travail pour 0 % du problème. Si la vidéo devient indispensable : PeerTube
> auto-hébergé ou fichier déposé, décidé dans son propre ADR.

### 8.3 Modèle de données

```
contenu.cours           (id, auteur_id, etablissement_id, titre, niveau_code, matiere_code,
                         statut[brouillon|publie|archive], version_publiee, created_at, updated_at)
contenu.cours_versions  (cours_id, version, content JSONB, publie_at,
                         PRIMARY KEY (cours_id, version))       -- immuables
contenu.cours_portees   (cours_id, classe_id)                    -- qui y a accès
contenu.assets          (id, proprietaire_id, mime, taille, sha256, cle_stockage, created_at)
```

Les **versions publiées sont immuables**. Un devoir (F4) référence
`(cours_id, version)` : un enseignant qui corrige une faute de frappe après avoir
donné le devoir ne doit pas modifier le sujet sous les pieds des élèves qui l'ont
déjà commencé. C'est le pendant exact de la préservation des UUID d'exercices de
l'ADR 0010.

**Exercices d'un cours d'enseignant** : ne pas créer une seconde table. Rendre
`contenu.exercices.chapitre_id` nullable, ajouter `cours_version` nullable, et une
contrainte `CHECK` exigeant exactement l'une des deux. Changement additif, les
soumissions et les évaluateurs existants continuent de fonctionner sans savoir
d'où vient l'exercice.

### 8.4 L'éditeur (web)

- **Colonne d'édition + aperçu réel**, pas un aperçu approximatif : l'aperçu utilise
  `<ChapterView />`, le composant de rendu de production. Ce qu'on voit est ce qui
  sera servi.
- **Palette de blocs** : on insère un bloc, on remplit ses champs. Aucun champ de
  style. Aucune couleur, aucune taille, aucun alignement — le lint de tokens en CI
  n'a rien à surveiller parce qu'il n'y a rien à saisir.
- **Formules** : champ LaTeX avec rendu KaTeX en direct et un clavier maths
  (√, x², xⁿ, fractions, π, ×, ÷, ≤, ∈) — le clavier prévu dans le carnet d'idées
  du 26/08, qui resservira à l'élève en F5.
- **Exercices** : un formulaire par type parmi les cinq du schéma. Les champs de
  correction (`answer`, `tolerance`, `acceptedAnswers`, `referenceAnswer`, `rubric`)
  sont saisis ici et **ne quittent jamais le serveur** vers un client élève — la
  garantie structurelle du §5.3 de la feuille de route s'applique au contenu
  d'enseignant sans une ligne de code de plus.
- **Brouillon → publication** : `Enregistrer` écrit un brouillon, `Publier` crée une
  version immuable et la rend visible aux classes portées. Le flux
  brouillon → relecture → publication existe déjà pour le catalogue sous forme de
  PR ; ici c'est la même chose avec une UI.
- **Validation à la publication** : schéma JSON, existence des cibles internes,
  existence des codes de compétence si renseignés, présence d'un `alt` sur chaque
  image et figure (règle d'accessibilité déjà non négociable côté catalogue).

### 8.5 Hors périmètre

Import de PDF ou de Word, édition collaborative simultanée, partage d'un cours
entre enseignants ou vers le catalogue public, marketplace de cours, thèmes ou
personnalisation visuelle, génération de cours par IA.

### 8.6 Vérification exigée

Un cours créé dans l'éditeur, servi par l'API, doit produire **exactement le même
HTML** qu'un chapitre de catalogue équivalent (test de rendu comparatif). Le job de
reconstruction de base ne détruit pas les cours d'enseignant (test d'intégration).
Une version publiée ne peut pas être modifiée (test). Un lien interne cassé bloque
la publication (test).

### 8.7 Définition de fini

Un enseignant compose un chapitre complet — texte, formules, figure, tableau,
méthode en étapes, citations, cinq exercices de types différents —, le publie à sa
classe, et un élève le lit, le fait, et pose une question au tuteur dessus.

---

## 9. F4 — Devoirs, échéances et rendus

**Estimation : 8–12 j.** Dépend de : F3.

### Objectif

Le scénario complet décrit dans la demande : « l'enseignant s'inscrit avec ses
élèves, dépose son cours, avec des dates, des exercices, des rendus, des devoirs
maison ».

### Modèle (nouveau schéma `devoirs`)

```
devoirs.devoirs      (id, classe_id, auteur_id, titre, consigne,
                      type[entrainement|devoir_maison|controle],
                      source_type[cours|chapitre|annale], source_ref, source_version,
                      ouvre_at, echeance_at, retard_tolere, correction_visible_at,
                      bareme JSONB, statut)
devoirs.rendus       (id, devoir_id, eleve_id, statut[non_rendu|brouillon|rendu|corrige],
                      rendu_at, note NUMERIC, appreciation, corrige_par, corrige_at)
devoirs.rendu_pieces (id, rendu_id, asset_id, ordre)
```

Un module à part, qui référence `identite`, `contenu` et `exercices` **par
identifiant** et écoute leurs événements (ADR 0007 et règles Modulith). Le test de
frontières `ModularityTests` doit rester vert sans exception ajoutée.

### Périmètre

Création d'un devoir à partir d'un cours, d'un chapitre du catalogue ou d'une
annale ; fenêtre d'ouverture et échéance ; visibilité différée de la correction
(essentielle pour un contrôle) ; tableau de bord enseignant : qui a rendu, qui n'a
pas commencé, résultats par exercice **et par compétence** — c'est là que le
référentiel de E1 paie ; vue élève : « à faire », « rendu », « corrigé ».

### Hors périmètre

Notes officielles exportées vers Pronote (voir §13), pondération de moyennes,
absences, emploi du temps. **Brio n'est pas un logiciel de vie scolaire.**

### Contraintes

Un devoir de type `controle` désactive le tuteur pour sa durée, **côté serveur** :
l'endpoint tuteur refuse quand une session de contrôle est ouverte pour cet élève
sur ce contenu. Un garde-fou côté client n'en est pas un.

---

## 10. F5 — Import de copie et correction

**Estimation : 7–10 j** (v1). Dépend de : F4.

### La progression en trois marches

La feuille de route (risque n° 3) et le carnet d'idées (26/08) arrivent à la même
conclusion, par deux chemins différents. Elle est reprise ici telle quelle :

1. **v1 — Auto-évaluation guidée.** L'élève travaille sur papier, l'application
   affiche le corrigé et le barème (`referenceAnswer` + `rubric` : ces champs
   existent déjà dans le schéma), l'élève déclare « j'avais juste / à revoir ».
   Gratuit, instantané, pédagogiquement défendable, aucune donnée de plus.
2. **v1 — Dépôt de copie corrigé par l'enseignant.** L'élève photographie ou scanne
   sa copie et la joint à son rendu ; l'enseignant corrige dans une interface de
   relecture (note, appréciation, commentaire par exercice). **Pas d'OCR, pas d'IA.**
   C'est le vrai gain de valeur, et c'est la marche la moins risquée.
3. **v2 — Transcription IA vérifiable** (chantier séparé, +8–12 j) : le modèle lit
   la copie, **montre ce qu'il a lu**, l'élève corrige un chiffre mal reconnu sans
   tout re-scanner, puis la correction s'applique sur le texte validé. Après trois
   échecs, bascule vers l'auto-évaluation — jamais de blocage.

> **À COMPRENDRE**
>
> La règle qui rend tout le reste tenable : **aucune note sommative n'est produite
> par l'IA sans validation d'un enseignant.** L'IA propose une lecture et un
> retour ; l'humain valide ce qui compte. Cette règle protège l'élève d'une
> correction fausse, l'enseignant de sa responsabilité, et toi d'un coût variable
> non maîtrisé.

### Contraintes de stockage

Stockage objet en UE, URLs signées à durée courte, jamais d'accès public. EXIF
retiré à l'import (une photo de copie contient la géolocalisation du domicile).
Types acceptés : JPEG, PNG, PDF ; taille bornée ; nombre de pièces borné.
Suppression automatique 12 mois après le rendu, et à la fermeture du compte.
Accès : l'élève auteur, l'enseignant du devoir, personne d'autre — testé.

---

## 11. F6 — Entraide et messagerie scolaire

**Estimation : 6–9 j (F6a) + 10–15 j (F6b).** Dépend de : F2 et F1.

### 11.1 Pourquoi en deux temps

La demande décrit « un Discord, fortement modéré, réservé à l'école ». Les deux
moitiés de cette phrase ne coûtent pas la même chose : la messagerie est une
semaine de travail, la modération est le reste. Et les deux usages qui portent la
valeur — poser une question sur un exercice, aider un camarade — ne demandent ni
temps réel, ni salons, ni messages privés.

### 11.2 F6a — Entraide (fils attachés au contenu)

**Modèle** (schéma `social`) :

```
social.fils         (id, portee[chapitre|cours|exercice], portee_ref, classe_id,
                     titre, auteur_id, statut[ouvert|resolu|masque], created_at)
social.messages     (id, fil_id, auteur_id, corps, statut[publie|en_moderation|masque|supprime],
                     marque_utile_at, marque_utile_par, created_at, edite_at)
social.signalements (id, message_id, signale_par, motif, statut, traite_par, traite_at)
social.sanctions    (id, compte_id, type, motif, decidee_par, debut, fin)
```

**Périmètre** : un fil s'ouvre depuis un chapitre ou un exercice, visible de la
classe. L'auteur d'une question peut marquer une réponse comme utile → événement
`ReponseUtileValidee` → 15 XP (F2). Texte seul, pas d'images, pas de fichiers, pas
de messages privés. Asynchrone : REST + rafraîchissement, **pas de WebSocket**.

**Le garde-fou anti-triche** : dans un fil attaché à un exercice, la même règle que
pour le tuteur s'applique — donner la réponse n'aide pas, c'est le raisonnement qui
compte. Concrètement : un message d'un fil d'exercice non résolu est masqué à ceux
qui n'ont pas encore soumis. Simple, structurel, et cohérent avec les quatre
couches du §5.3 de la feuille de route.

### 11.3 F6b — Messagerie de classe

Salons de classe **créés par l'enseignant**, jamais par les élèves. Une conversation
élève → enseignant. **Pas de messages privés élève ↔ élève en v1** : c'est le canal
qui porte le plus de risque (harcèlement, exclusion, contenus) pour le moins de
valeur pédagogique, et il est le plus difficile à modérer parce qu'il est invisible.

### 11.4 La modération, qui est le vrai chantier

Quatre niveaux, dans cet ordre :

1. **Préventif** : limitation de débit à l'écriture, filtre lexical, longueur bornée,
   pas de lien externe cliquable en v1, pas de pièce jointe.
2. **Automatique** : classement des messages signalés et d'un échantillon aléatoire.
   Le tuteur a déjà un client de modèle et une discipline d'éval ; ce classifieur a
   besoin du même jeu d'éval, avec des cas réels.
3. **Humain** : l'enseignant est modérateur de sa classe, avec une file de
   signalements. Signalement en deux clics, accessible depuis chaque message.
   Escalade vers un administrateur d'établissement puis vers Brio.
4. **Protocole de détresse** : un message évoquant une souffrance ou une situation
   de danger ne se modère pas comme un spam. Il faut une procédure écrite avant
   l'ouverture — à qui elle remonte, dans quel délai, quelles ressources d'aide
   sont affichées à l'élève, et ce qui est conservé. Ce document se rédige avec
   l'établissement, pas seul.

### 11.5 Obligations

Rétention des messages : 12 mois, puis anonymisation. Conservation des données
d'identification (LCEN) séparée du contenu. Mécanisme de signalement, conditions
d'utilisation et point de contact (DSA). Journal des décisions de modération. Une
**analyse d'impact (AIPD)** est très probablement obligatoire dès qu'on héberge des
échanges entre mineurs : à instruire au moment de l'ADR 0023, pas au lancement.

> **NE PAS ACCEPTER SANS COMPRENDRE**
>
> On te proposera WebSocket, Redis pub/sub, indicateurs de frappe et présence en
> ligne. Pour une classe de trente élèves qui posent trois questions par soir,
> c'est une infrastructure temps réel pour un forum. Refuse en v1 : chaque brique
> temps réel est un endroit où un message peut échapper à la file de modération.

---

## 12. F7 — Annales (voie contenu, sans dépendance)

**Estimation : 5–7 j d'outillage** + 1 à 1,5 j par sujet. **Peut démarrer
immédiatement**, en parallèle de F0.

### Modèle

Une annale est du contenu de catalogue : elle vit dans git, elle passe par
l'ingestion idempotente, elle utilise le même schéma. Rien de nouveau côté moteur.

```
content/annales/dnb/2025/metropole-juin/sujet.json
contenu.annales (id, examen, session, annee, centre, matiere, niveau_code,
                 duree_minutes, source_url, licence, bareme JSONB)
```

Les exercices d'une annale sont des exercices ordinaires, indexés sur le référentiel
de compétences — ce qui donne gratuitement les deux modes d'usage :

- **Entraînement ciblé** : « les exercices d'annales sur le théorème de Thalès »,
  filtrés par compétence, corrigés par les évaluateurs existants.
- **Sujet complet en mode examen** : chronométré, tuteur désactivé côté serveur,
  correction visible après dépôt. Le mode examen est le même mécanisme que le
  `controle` de F4 : à construire une fois, à utiliser deux fois.

### Contrainte juridique (rappel du §3.6 de la feuille de route)

Les sujets d'examen sont des documents administratifs communicables et réutilisables
avec prudence ; **les corrigés commerciaux sont protégés**. La règle de travail :
on réécrit les énoncés, on ne recopie jamais un corrigé d'éditeur, on cite la
session officielle. Même discipline éditoriale que pour les chapitres.

---

## 13. Les fonctionnalités que tu n'as pas listées

Classées par rapport valeur / coût, telles que je les propose. Les quatre premières
me paraissent plus rentables que la messagerie complète (F6b).

| Proposition | Pourquoi | Coût |
|---|---|---|
| **Signalement d'erreur de contenu** | Sur 100 chapitres générés il y aura des erreurs (risque n° 2 de la feuille de route). Un bouton « signaler une erreur » sur chaque bloc, avec l'ancre exacte, transforme 500 élèves en relecteurs | 1–2 j |
| **Tableau de bord enseignant par compétence** | C'est l'argument de vente auprès d'un établissement, et les données existent déjà après F2 et F4 : qui décroche, sur quelle compétence, depuis quand | 4–6 j |
| **Exercices paramétrés** | Un modèle d'exercice avec des variables (`a`, `b` tirés dans un domaine) produit 50 instances vérifiées. Multiplie le stock d'entraînement sans coût de rédaction et sans IA. Additif au schéma | 4–6 j |
| **Révision espacée** | La maîtrise par compétence de F2 dit déjà quoi réviser et quand. Un onglet « à revoir aujourd'hui » est presque gratuit une fois F2 fait | 2–3 j |
| **Export PDF d'un cours** | Un enseignant veut distribuer son cours sur papier. Rendu serveur du même JSON | 2–3 j |
| **Vue parent en lecture seule** | Le titulaire légal a déjà un e-mail dans le système (F0) et un droit d'accès au titre du RGPD. Autant en faire une fonctionnalité | 3–4 j |
| **Mode « dys » et lecture audio** | `PRINCIPLES.md` prévoit déjà le basculement vers Atkinson Hyperlegible en une ligne de token. La synthèse vocale des énoncés est native au navigateur | 2–3 j |
| **PWA / mode dégradé** | Public collège, téléphones anciens, 4G en zone blanche. Le site de contenu est déjà statique : le cache hors ligne est à portée | 3–5 j |
| **Recherche dans le catalogue** | Devient nécessaire au-delà de ~30 chapitres. `tsvector` PostgreSQL, pas de moteur externe | 2–3 j |
| **Ouverture d'une 2e matière** | La grille de choix tient six matières sans redesign (carnet d'idées). Physique-chimie ou français : décision produit, pas technique | voie contenu |
| **Connexion ENT / GAR** | Ouvre les établissements en grand, mais c'est un chantier d'intégration lourd et un engagement contractuel. À trancher **après** un pilote réussi, pas avant | non estimé |

---

## 14. Ce que je déconseille pour cette phase

1. **Le classement entre élèves.** Un tableau des scores de classe est le moyen le
   plus rapide de faire décrocher les cinq derniers, et il contredit
   `PRINCIPLES.md` (« pas de cœurs, pas de sanction »). Si un mécanisme collectif
   est souhaité : un objectif de classe, atteint ensemble.
2. **Les messages privés élève ↔ élève en v1.** Voir §11.3.
3. **L'OCR d'écriture manuscrite maison.** Même avec un modèle de vision, la
   fiabilité sur une copie de collégien au crayon est mauvaise et le coût est par
   soumission. La marche 2 de F5 (correction par l'enseignant) capte l'essentiel de
   la valeur.
4. **L'application mobile native.** Le risque n° 9 de la feuille de route reste
   valable : web mobile-first d'abord, natif seulement après une traction avérée.
5. **Le RAG vectoriel pour le tuteur des cours d'enseignant.** Un cours
   d'enseignant tient dans le contexte comme un chapitre du catalogue. La v1 du
   tuteur fonctionne dessus sans une ligne de code de plus. C'est un bénéfice
   direct du choix « un seul schéma ».
6. **Un second système de design pour l'espace enseignant.** Les mêmes tokens, le
   même kit. Un espace enseignant qui ressemble à un back-office est un espace
   enseignant qu'on n'utilise pas.

---

## 15. Les risques de cette phase

1. **L'explosion du périmètre.** Ce document décrit, mis bout à bout, un ENT :
   comptes, classes, cours, devoirs, notes, messagerie. Les produits qui occupent
   déjà ce terrain (Pronote, Moodle, l'ENT régional) sont médiocres mais installés,
   et ils ne se battent pas sur la qualité pédagogique. **Le seul terrain où Brio
   gagne est le contenu et le tuteur.** Chaque jour passé sur F4 ou F6b est un jour
   pas passé sur les 40 chapitres manquants. Garde le ratio en tête.
2. **La qualité du contenu d'enseignant.** L'éditeur garantit la tenue visuelle ; il
   ne garantit rien sur l'exactitude. Un cours d'enseignant faux ressemblera à un
   cours Brio faux. Réponse minimale : marquage visible de l'origine (« cours de
   M. X »), portée limitée à ses classes, et **jamais** de remontée automatique
   vers le catalogue public.
3. **Le droit d'auteur importé par l'enseignant.** Un enseignant collera un exercice
   de manuel scanné dans son cours — c'est certain, et c'est une contrefaçon que
   Brio héberge. Réponse : CGU acceptées à la création du compte, mention à la
   publication, procédure de retrait, et **pas d'import de PDF** (§8.5), qui est le
   vecteur principal.
4. **Le coût variable de la correction IA.** Une classe de 30 élèves × 8 exercices
   rédigés × un appel modèle par soumission, c'est une facture par devoir, pas par
   mois. Quota par classe et par période **avant** la première mise en service,
   pas après la première facture.
5. **La modération est un métier, pas une fonctionnalité.** Un signalement le
   dimanche à 22 h n'attend pas le lundi. Avant d'ouvrir F6b, il faut savoir qui
   répond, dans quel délai, et ce qui se passe si personne ne répond. C'est une
   question d'organisation, pas de code, et elle décidera peut-être de repousser
   F6b entièrement.
6. **La dérive du vibe coding, à une échelle plus grande.** Le risque n° 1 de la
   feuille de route s'aggrave mécaniquement : les modules `identite`, `devoirs` et
   `social` sont des modules à règles (droits, états, transitions), pas des modules
   à CRUD. Une IA de codage écrit très bien un CRUD et très mal une matrice de
   droits. Les tests de frontière (`ModularityTests`) ne voient pas qu'un élève
   peut lire la copie d'un autre : ce sont les tests d'autorisation qu'il faut
   écrire d'abord, et les écrire toi-même.
7. **Le RGPD accumulé.** Chaque chantier ajoute une finalité de traitement :
   scolarité (F0), progression (F2), production pédagogique (F3), copies (F5),
   communications (F6). Tenir le registre au fil de l'eau coûte une heure par
   chantier ; le reconstituer après coup coûte une semaine et un audit. Et la
   qualification exacte de Brio — sous-traitant de l'établissement ou responsable
   de traitement — n'est pas une question rhétorique : elle change les contrats,
   les mentions et les obligations. **Une heure de conseil juridique avant F0, une
   avant F6b.** Je ne suis pas juriste ; les points de droit de ce document sont
   des orientations, pas un avis.

---

## 16. Annexe — Cartographie des endpoints à ajouter

Existant : `GET /api/catalogue`, `GET /api/chapitres/{niveau}/{matiere}/{slug}`,
`POST /api/exercices/{id}/soumissions`,
`POST /api/chapitres/{niveau}/{matiere}/{slug}/tuteur`, `GET /api/ping`.

| Chantier | Endpoints |
|---|---|
| F0 | `POST /api/auth/connexion`, `DELETE /api/auth/session`, `POST /api/comptes/enseignant`, `POST /api/comptes/eleve` (code d'invitation), `GET /api/moi`, `POST /api/classes`, `POST /api/classes/{id}/invitations`, `GET /api/classes/{id}/membres` |
| F2 | `GET /api/progression/moi`, `GET /api/progression/moi/maitrise`, `GET /api/classes/{id}/progression` (enseignant) |
| F3 | `POST /api/cours`, `PUT /api/cours/{id}/brouillon`, `POST /api/cours/{id}/publications`, `GET /api/cours/{id}` (version publiée), `POST /api/assets` |
| F4 | `POST /api/devoirs`, `GET /api/devoirs/{id}`, `GET /api/classes/{id}/devoirs`, `POST /api/devoirs/{id}/rendus`, `PUT /api/rendus/{id}/correction` |
| F5 | `POST /api/rendus/{id}/pieces`, `GET /api/pieces/{id}` (URL signée) |
| F6a | `GET /api/fils?portee=…`, `POST /api/fils`, `POST /api/fils/{id}/messages`, `POST /api/messages/{id}/utile`, `POST /api/messages/{id}/signalements` |

Chaque ajout suit le flux de contrat existant : `OpenApiContractTest` détecte la
dérive, `docs/api/openapi.json` est mis à jour délibérément, le client TypeScript
est régénéré.

---

## 17. Sources

Documents du dépôt : `docs/adr/0001` à `0015`, `docs/schema/course-content.schema.json`,
`docs/schema/DESIGN.md`, `docs/design/PRINCIPLES.md`, `docs/design/BACKLOG.md`,
`docs/design/README.md`, `docs/design/visuels/doc-carnet-idees.html`,
`content/referentiel/mathematiques-college.json`, `.claude/CLAUDE.md`,
migrations `V1` à `V7`, `docs/api/openapi.json`.
Document externe : *Brio — Feuille de route technique*, 19 août 2026.
Références réglementaires citées : art. 45 de la loi Informatique et Libertés
(consentement des mineurs de moins de 15 ans), LCEN (obligations d'hébergeur),
règlement sur les services numériques (mécanisme de signalement), Licence Ouverte
2.0 (réutilisation des programmes officiels). Ces points sont des orientations de
conception, pas un avis juridique.
