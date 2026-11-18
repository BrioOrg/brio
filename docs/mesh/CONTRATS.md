# Les dix contrats d'échange du mesh

Les agents ne se parlent pas en prose libre : ils s'échangent des **documents au format
fixe**, stockés sur GitHub. Ce fichier est la référence de ces formats. Il appartient à la
Phase 4 ; les fiches d'agents (`.claude/agents/*.md`) et le skill `/feature` s'y réfèrent
sans le dupliquer.

## Règles communes

1. **Un contrat incomplet est renvoyé, jamais complété au jugé.** Le destinataire ne
   « devine » pas un champ manquant : il répond sur le support du contrat par un
   commentaire qui commence par `Contrat incomplet :`, liste les champs absents ou
   invalides, puis remet l'élément au producteur (label d'étape inchangé).
2. **Un renvoi pour incomplétude ne compte pas comme un tour** de la boucle
   construction↔vérification (trois tours au maximum, puis escalade). En revanche,
   un même contrat renvoyé **deux fois** pour les mêmes champs escalade vers P1.
3. **Marqueur d'identification.** Chaque contrat commence par une ligne
   `<!-- mesh:contrat=<nom> v1 -->` (noms : `signal`, `fiche-besoin`, `spec-parcours`,
   `spec-ui`, `plan-technique`, `decision-conseil`, `changement`, `rapport-verification`,
   `rapport-simulation`, `lecon`). Un workflow ou un agent détecte ainsi le type et la
   version sans interpréter la prose. La version ne change que par PR `mesh-tuning` (N3).
4. **Un contrat est factuel et vérifiable.** Pas d'adjectif seul (« fluide », « propre »),
   toujours un nombre, un état observable, un chemin de fichier ou un lien.
5. **Zéro donnée inventée.** Tout contrat qui décrit un écran nomme, pour chaque donnée
   affichée, la source backend. Pas de source = contrat renvoyé. Aucune donnée d'élève
   réel dans un contrat (staging et CI seulement).
6. **Tout contrat porte son niveau de gouvernance** (N0–N3, voir le plan) quand il engage
   une décision, et le SHA ou la version de ce qu'il décrit quand il porte sur du code.
7. **Une ligne de journal** (`docs/mesh/JOURNAL.md`) est laissée par le producteur à
   chaque contrat émis : agent, contrat, élément (issue/PR), coût.

## Tableau de référence

| Contrat | Produit par | Consommé par | Contenu obligatoire | Où il vit |
|---|---|---|---|---|
| Signal | S4, U2, L2, V*, L3, humain | P1 | type, observation, preuve ou reproduction, rôle concerné, gravité | issue `mesh:inbox` |
| Fiche besoin | P2 | U1, U3, B1, B4, B5 | persona, tâche, critères Given/When/Then, priorité justifiée, niveau | corps de l'issue |
| Spec de parcours | U1, U3 | U4, U6, B3, S1 | clics actuels/budget, parcours cible, destination finale, impact routes chaudes | commentaire d'issue |
| Spec UI | U4, U5 | B3, V6, U7 | écrans, composants Arcade, tokens, états, textes FR, source de chaque donnée | commentaire + captures |
| Plan technique | B1 | B2, B3, V1, V2 | modules, contrats d'API, découpage sans chevauchement, ADR oui/non | commentaire d'issue |
| Décision conseil | P2 + B1 + gardien | P3, tous | contexte, options, décision, avis de chaque membre, statut | `docs/adr/` |
| Changement | B2, B3, B4, B5 | V1–V6, U6, U7, S2 | lien issue, critères→tests, preuves, périmètre, ce qui n'est pas fait | pull request |
| Rapport de vérification | V1–V6, U6, U7 | L1, auteur | SHA examiné, verdict, constats numérotés, tour n/3 | revue de PR |
| Rapport de simulation | S2, S3, S4 | P2, U1, L1 | aperçu testé, persona, résultat, clics vs budget, impasses, friction | artefact CI + résumé |
| Leçon | A1 | A2, A3 | incident source, cause racine, garde-fou, comment le mesurer | PR `mesh-tuning` |

Chaque paragraphe ci-dessous donne le **format minimal** : un champ listé ici et absent du
contrat reçu suffit à le renvoyer.

---

## 1. Signal

*Produit par S4, U2, L2, L3, les gardiens V\*, l'humain. Consommé par P1. Vit dans une
issue étiquetée `mesh:inbox`.* Un signal est une **observation**, pas une solution.

Champs minimaux :
- **Type** : `friction` · `bug` · `impasse` · `incident` · `dette` · `idée`.
- **Observation** en une à trois phrases, factuelle (ce qui se passe, pas ce qu'il faudrait).
- **Preuve ou reproduction** : étapes numérotées avec résultat attendu et obtenu, ou lien
  vers un artefact (rapport de nuit, capture, log). Une `idée` peut se passer de
  reproduction mais cite d'où elle vient (persona, mesure, retour).
- **Rôle concerné** : élève, enseignant, parent/tuteur légal, équipe.
- **Route ou écran concerné**, quand il existe.
- **Gravité** : `impasse` (l'utilisateur ne peut pas poursuivre) · `bloquant` ·
  `gênant` · `confort`. Une `impasse` est toujours traitée avant le reste.
- **Source** : agent producteur ou « humain ».

Renvoyé si : aucune preuve pour un bug ; solution proposée à la place de l'observation ;
donnée personnelle d'élève dans la description.

## 2. Fiche besoin

*Produite par P2. Consommée par U1, U3, B1, B4, B5. Vit dans le corps de l'issue.*

Champs minimaux :
- **Persona et tâche** : « En tant que *[persona]*, je veux *[tâche]* ».
- **Contexte** : signal d'origine (lien), route actuelle, ce qui existe déjà dans le code.
- **Critères d'acceptation** : au moins un en **Given / When / Then**, chacun testable
  sans interprétation. Au moins un critère chiffre l'effort (clics, temps) ou nomme un
  état observable.
- **Priorité et justification** : une phrase, avec la règle de la doctrine invoquée
  (impasse, route chaude, mesure, risque pour un mineur).
- **Route chaude ?** oui / non, avec la tâche clé du tableau « budget de clics » si oui.
- **Niveau de gouvernance** N0–N3 et pourquoi.
- **Hors périmètre** : ce que la fiche ne couvre volontairement pas.
- **Questions ouvertes** : 0 à 3 maximum, adressées à l'humain ; la fiche reste en
  `mesh:besoin` tant qu'elles n'ont pas de réponse.

Renvoyée si : un critère n'est pas testable (« intuitif ») ; pas de priorité justifiée ;
plus de trois questions ; une fonctionnalité qui suppose une donnée que le backend n'a pas.

## 3. Spec de parcours

*Produite par U1 et U3. Consommée par U4, U6, B3, S1. Vit en commentaire d'issue.*

Champs minimaux :
- **Tâche clé** servie (nom du tableau « budget de clics »).
- **Parcours actuel** : écrans traversés et nombre de clics, **mobile et ordinateur**.
- **Budget cible** : nombre de clics maximal, mobile et ordinateur, et le critère de
  retour en porte 2 s'il est dépassé.
- **Parcours cible** : suite d'écrans et de gestes, depuis le point d'entrée nommé
  (accueil, barre de navigation, notification…).
- **Destination finale** : l'écran où la tâche aboutit, et la confirmation que **chaque
  étape mène à cette destination** (zéro impasse).
- **Navigation arrière** : comportement du bouton retour et de l'historique à chaque étape.
- **Lexique** : libellés retenus pour les entrées de navigation (U3), avec l'ancien
  libellé s'il change.
- **Impact sur les routes chaudes voisines** : liste, et verdict de U1 (budget tenu /
  allongé → veto).

Renvoyée si : pas de budget chiffré, pas de destination finale, ou une route chaude
allongée sans justification.

## 4. Spec UI

*Produite par U4 (visuel) et U5 (textes). Consommée par B3, V6, U7. Commentaire d'issue
plus captures.*

Champs minimaux :
- **Écrans** : une capture ou maquette par écran, à **360, 768 et 1280 px**, en thème
  clair et sombre.
- **Composants** du kit Arcade utilisés (noms de `web/components/ui/`) ; un composant
  nouveau est signalé comme tel et renvoie au conseil N2.
- **Tokens** : uniquement des tokens **sémantiques** de `web/app/tokens.css` ; toute
  valeur absente est listée comme « token manquant → PR séparée ».
- **États** : vide, chargement, erreur — **les trois, pour chaque écran de données** — avec
  leur texte et leur sortie (jamais un état vide sans lien vers une destination).
- **Textes** en français (tutoiement, 11–15 ans), par U5 ; aucun fragment traduit à
  concaténer.
- **Source de chaque donnée affichée** : champ et endpoint du backend. Une donnée sans
  source n'apparaît pas.
- **Accessibilité** : ordre du focus, nom accessible des contrôles, contraste annoncé.

Renvoyée si : un état manque, une valeur est hors tokens, une donnée n'a pas de source.

## 5. Plan technique

*Produit par B1. Consommé par B2, B3, V1, V2 (et B4/B5 si concernés). Commentaire d'issue.*

Champs minimaux :
- **Modules touchés** (`identite`, `contenu`, `ia`, `exercices`, `progression`, `social`,
  `system`, `shared`, ou `web`/`content`) et, pour chacun, l'API publiée utilisée.
- **Contrats d'API** : endpoints ajoutés ou modifiés, DTO, impact sur `openapi.json`, les
  schémas Zod de `@brio/api-client` et le faux backend (`web/e2e/fake-backend.mjs`).
- **Persistance** : migration Flyway (numéro, objet) ou « aucune ».
- **Découpage du travail** : une ligne par agent (B2, B3, B4, B5) avec **la liste des
  fichiers ou dossiers dont il est propriétaire** ; deux agents ne partagent aucun fichier.
- **Données affichées et source** : reprend la table de la spec UI, champ backend par champ.
- **Risques et réversibilité** : ce qui est difficile à annuler (migration, contenu publié).
- **ADR requis** : oui (avec brouillon `Proposed`) / non, et pourquoi.
- **Niveau de gouvernance** et, si le tuteur est touché, l'éval requise (ADR 0015).

Renvoyé si : deux agents se partagent un fichier, une migration modifie une migration
appliquée, une donnée n'a pas de champ backend.

## 6. Décision conseil

*Produite par P2 + B1 + le gardien concerné (V\*, U\*). Consommée par P3 et tous. Vit dans
`docs/adr/`, copie de `docs/adr/template.md`, numéro suivant.* C'est le contrat des
décisions **N2** ; une décision **N3** reste « Proposed » jusqu'à la signature humaine.

Champs minimaux :
- **Contexte** : le signal, la contrainte, le lien vers l'issue.
- **Options** : au moins **deux**, chacune avec ses conséquences.
- **Décision** retenue et raison.
- **Avis de chaque membre** du conseil (P2, B1, gardien), séparément : accord ou
  désaccord motivé. Le désaccord d'un gardien avec veto est noté comme tel.
- **Statut** : `Proposed` (écrit par P3) → `Accepted` (unanimité en N2 si l'autonomie
  du conseil le permet, sinon signature humaine ; toujours signature humaine en N3).
- **Conséquences** : ce qui change dans le code, les docs, les agents.

Renvoyée si : une seule option présentée, un membre du conseil absent, statut `Accepted`
sans la trace de qui l'a posé.

## 7. Changement

*Produit par B2, B3, B4, B5. Consommé par V1–V6, U6, U7, S2. C'est une pull request
vers `develop`.*

Champs minimaux :
- **Lien vers l'issue** et titre conventionnel `<type>(<scope>): <description> (#<issue>)`.
- **Critères → preuves** : pour chaque critère de la fiche besoin, le test ou l'artefact
  qui le couvre.
- **Périmètre** : fichiers touchés, rattachés à la ligne du plan qui les autorise.
- **Preuves** : CI verte ; pour une UI, captures 360/768/1280 clair et sombre et **nombre
  de clics mesuré** contre le budget ; pour du contenu, la liste des réponses attendues et
  leur calcul ; pour le tuteur, le rapport d'éval lié.
- **Ce qui n'est pas fait** : écarts connus, dette volontaire, suivi à ouvrir.
- **Niveau de gouvernance** et tour courant (n/3) en cas de reprise après vérification.

Renvoyé si : un critère sans preuve, du code hors du périmètre du plan, un test existant
modifié sans l'accord de V3, un commit sans `(#issue)`.

## 8. Rapport de vérification

*Produit par chacun de V1–V6, U6, U7. Consommé par L1 (qui les consolide en un seul
commentaire de PR) et l'auteur. Vit dans la revue de PR.*

Champs minimaux, une section par gardien :
- **Gardien** et **SHA examiné** (un verdict sans SHA est caduc au prochain push).
- **Verdict** : `OK` · `OK avec réserves` (consultatif) · `Constat bloquant` · `Veto`.
  Un veto cite son motif tel qu'il est défini sur la fiche du gardien.
- **Constats numérotés** : pour chacun, gravité, `fichier:ligne` (ou capture), règle ou ADR
  violé, **correction attendue** formulée de façon vérifiable.
- **Tour** : n/3 de la boucle construction↔vérification.
- **Hors périmètre** : ce que ce gardien n'a pas regardé, pour que L1 ne conclue pas à tort.

Renvoyé si : pas de SHA, verdict bloquant sans constat numéroté, constat sans correction
vérifiable. Un gardien lève lui-même son veto en publiant un nouveau rapport sur le
nouveau SHA ; personne d'autre ne le fait.

## 9. Rapport de simulation

*Produit par S2 (personas), S3 (saboteur), S4 (analyste de friction). Consommé par P2,
U1, L1. Artefact de CI plus résumé en commentaire.*

Champs minimaux :
- **Environnement testé** : aperçu de la PR ou staging, SHA ; **jamais** de données
  d'élèves réels.
- **Persona et tâche** rejouées, ou **scénario de sabotage** (retour arrière, double clic,
  session expirée, triche) pour S3.
- **Résultat** : réussi / échoué, et à quelle étape.
- **Clics constatés vs budget** de la tâche, mobile et ordinateur.
- **Impasses rencontrées** (étape, état de l'écran), chacune reprise en **Signal**.
- **Score de friction** et **écart avec la veille** (S4) ; une hausse rouvre la PR.
- **Lien vers l'artefact** (trace d'arbre d'accessibilité, captures).

Renvoyé si : pas de comparaison au budget, pas d'environnement ou de SHA, impasse sans
signal associé.

## 10. Leçon

*Produite par A1. Consommée par A2 et A3. Vit dans une PR étiquetée `mesh:tuning`
(`mesh-tuning`).* Toute modification du mesh est **N3** : l'humain merge.

Champs minimaux :
- **Incident source** : lien vers l'issue, la PR ou la ligne de journal.
- **Cause racine** : une phrase qui remonte au-delà du symptôme (quel contrat, quelle
  règle, quel agent a laissé passer).
- **Garde-fou proposé** : exactement l'un de — règle, skill, test, persona, cas d'éval —
  avec le **fichier cible**.
- **Mesure** : comment A2 vérifiera le gain (cas d'éval du corpus visible ; le jeu caché
  n'est jamais transmis à A1 ni cité dans la leçon).
- **Risque** : ce que le garde-fou peut casser ou rendre trop strict.
- **Agents concernés** et effet attendu sur leur niveau d'autonomie.

Renvoyée si : le garde-fou n'a pas de fichier cible, aucune mesure n'est proposée, la
leçon cite un cas du jeu caché, ou elle traite le symptôme sans nommer la cause.
