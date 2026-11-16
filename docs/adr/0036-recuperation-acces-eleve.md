# 0036 — Récupération d'accès de l'élève : le prof réinitialise le compte existant

- **Status**: Proposed
- **Date**: 2026-11-16
- **Deciders**: Porte 3 du mesh — B1 (architecture) · U1 (veto V5) — arbitrages humains N3
  (Gabrielle, 2026-11-16 : compte existant ; puis risque résiduel accepté, `admin_brio` hors
  classe, réglages) — ticket PL-4 (#364)

## Context

Le lien « Mot de passe oublié ? » de `web/components/login-form.tsx` pointait vers
`/mot-de-passe-oublie`, une route inexistante (404) : une impasse sur un chemin de
récupération d'accès, dans un produit utilisé par des mineurs (ADR 0018).

Contraintes de données (déjà actées) :

- Les comptes (`V8__identite_comptes.sql`) ont un `identifiant_connexion` et un
  `mot_de_passe_hash` pour tous ; **l'`email` est réservé aux adultes**. Les élèves Path B
  n'ont qu'un `email_titulaire_legal` (e-mail **parent**), les élèves Path A « mission
  d'établissement » **aucun e-mail** (ADR 0018). Aucun canal n'atteint l'élève lui-même.
- L'`identifiant_connexion` est généré côté serveur et montré **une seule fois** (ADR 0018 §5).
- Les mots de passe sont hachés par le `DelegatingPasswordEncoder` (`{bcrypt}`, `SecurityConfig`).
- La connexion est protégée par un verrou progressif par identifiant et un débit par IP
  tronquée (`V42`, ADR 0017 §7).

Arbitrage porte 1 : périmètre **élève seul**, canal **via le prof / l'établissement**, portée
**mot de passe ET identifiant**. Une première version (écran statique renvoyant vers
`/rejoindre`) a été refusée en porte 5 (veto V5) : `/rejoindre` **crée un nouveau compte**
(progression perdue, doublon) avec un code de classe multi-usage valable 14 jours — la
promesse « usage unique · 7 jours » affichée à l'élève était fausse. **Décision humaine (N3)** :
le prof réinitialise l'accès du **compte existant**.

## Decision

Un adulte autorisé **réinitialise l'accès du compte existant** d'un élève : le serveur génère un
**mot de passe provisoire** qu'il **hache** à la place du mot de passe courant, **valable 7 jours**,
**à usage unique**, et lève un drapeau **« doit changer son mot de passe »**. Le prof reçoit **une
seule fois** l'identifiant de connexion de l'élève, le provisoire et la date d'expiration ; il les
remet à l'élève. À la première connexion, l'élève **doit choisir son propre mot de passe** avant
tout le reste. L'élève garde son compte, ses classes et sa progression. Aucun e-mail.

### 1. Autorisation

`POST /api/classes/{classeId}/inscriptions/{compteId}/reinitialisation-acces` (module
`identite`, `ClasseController`, à côté du renommage d'un élève qui suit le même patron).

- Rôle : `ENSEIGNANT` ou `ADMIN_BRIO` (matcher dédié dans `SecurityConfig`, en plus du contrôle
  dans le service). Un élève → 403.
- Un enseignant doit être le **professeur principal de cette classe**, la classe doit être
  **active**, et l'élève doit y être **inscrit** (rôle `eleve`, inscription non close).
  Autre prof → **403** ; élève absent de la classe → 404 ; compte non élève → 404.
- `ADMIN_BRIO` peut réinitialiser tout élève inscrit dans la classe désignée (voir aussi §1 bis).
- Le compte doit être `actif` : un compte en attente de consentement, suspendu ou clos → 409
  (une réinitialisation ne lui rendrait pas l'accès, et ne doit pas contourner une révocation).

Pourquoi passer par la classe : « prof d'une classe où l'élève est inscrit » est exactement la
relation que porte `inscriptions` ; l'écran `/prof/classes/[id]` liste déjà ces élèves.
L'endpoint ne prend que des IDs (ADR 0016 §4) : rien d'identifiant ne transite dans l'URL.

### 1 bis. Élèves sans classe active : `admin_brio` (arbitrage N3)

Un élève inscrit via `/commencer` (Path B, aucune classe) ou dont la classe est archivée n'a
aucun prof qui puisse passer par §1. **Décision humaine (N3, 2026-11-16)** : `admin_brio` peut le
réinitialiser hors classe.

`POST /api/admin/comptes/{id}/reinitialisation-acces` (`AdminComptesController`, sur le patron de
`/{id}/pseudonyme`), réservé à `ROLE_ADMIN_BRIO` par le matcher existant
`/api/admin/comptes/**`. La cible doit être un compte de **rôle élève** (sinon 404, un adulte
compris, comme un compte inexistant) et **actif** (sinon 409). Mêmes garanties que §1 : provisoire,
7 jours, usage unique, sessions fermées, audit (`classe_id` NULL), débit limité.

Aucune surface web d'administration n'existe encore sur `develop` : l'endpoint est livré seul,
l'action sera branchée dans l'espace `/admin` (PR #357, mergée après celle-ci). **Aucun canal de
contact** vers `admin_brio` n'existe non plus (ni page légale, ni adresse dans `deploy/`, la
documentation ou les ADR) : `/mot-de-passe-oublie` n'en invente pas et ne mentionne pas cette
voie tant qu'il n'y en a pas (voir Follow-ups).

### 2. Le mot de passe provisoire

- Généré par `SecureRandom`, 12 caractères en 3 groupes de 4 séparés par des tirets
  (`k7m4-p9xa-3rtw`), alphabet minuscule **sans caractères ambigus** (ni `0/o`, ni `1/l/i`) —
  le même que l'identifiant (ADR 0018 §5). ≈ 59 bits d'entropie, sous le verrou progressif de
  `V42`.
- **Saisie tolérante (arbitrage N3)** : l'élève peut le taper **sans les tirets**, avec des
  espaces, en majuscules. Il est haché sous sa forme canonique (sans tirets ni espaces, en
  minuscules), et son hash porte le marqueur `{provisoire}` devant le `{bcrypt}` habituel ;
  `EncodeurMotsDePasse` (le `PasswordEncoder` de l'application, qui délègue à
  `DelegatingPasswordEncoder`) canonicalise la saisie **uniquement** devant un hash marqué. Le
  hachage reste bcrypt ; le mot de passe choisi ensuite par l'élève n'a pas le marqueur et reste
  comparé exactement. L'entropie ne change pas (les tirets sont fixes, l'alphabet est minuscule).
- Stocké **haché** dans `mot_de_passe_hash`, **à la place** de l'ancien : l'ancien mot de passe
  cesse de fonctionner immédiatement (utile aussi si le compte a été partagé ou volé).
- Renvoyé en clair **dans cette seule réponse**, avec `Cache-Control: no-store`. Aucun endpoint
  ne permet de le relire : perdu, le prof réinitialise à nouveau.

### 3. Expiration et usage unique

Colonnes ajoutées à `identite.comptes` (`V43`) : `doit_changer_mot_de_passe`,
`mot_de_passe_provisoire_expire_le` (création + 7 jours), `mot_de_passe_provisoire_utilise_le`,
et `acces_reinitialise_le` / `acces_reinitialise_par` (§8).

- `BrioUserDetailsService` déclare les identifiants **expirés** (`credentialsNonExpired = false`)
  quand le provisoire est **expiré** ou **déjà utilisé**.
- **Usage unique atomique** : `LoginAuditHandler` marque le provisoire utilisé par **un seul
  `UPDATE … WHERE utilise_le IS NULL` conditionnel** (`CompteRepository.consommerMotDePasseProvisoire`),
  avant de relire le compte. Deux connexions concurrentes avec le même provisoire passent toutes
  deux le contrôle de §3 ; Postgres réévalue la condition après le commit de la première, la
  seconde obtient 0 ligne : sa session est invalidée et elle reçoit **la réponse d'un mauvais mot
  de passe** (même 401, même corps, échec compté). La session gagnante est la seule qui pourra
  choisir le nouveau mot de passe. Si l'élève la quitte sans l'avoir fait, il retourne voir son
  prof — c'est le prix de l'usage unique (arbitrage N3 : « usage unique strict », avec
  l'avertissement « fais-le maintenant » sur `/changer-mot-de-passe`).
- Le changement (`POST /api/moi/mot-de-passe`) remplace le hash, efface les trois colonnes du
  provisoire.

### 4. Anti-énumération

Un provisoire expiré ou déjà utilisé produit **exactement** la réponse d'un mauvais mot de
passe : Spring lève `CredentialsExpiredException` **après** la vérification du mot de passe,
l'unique `AuthenticationFailureHandler` répond `401 {"error":"Identifiant ou mot de passe
incorrect"}` et compte l'échec dans le verrou progressif, comme pour un mauvais mot de passe.
Même statut, même corps, même effet de bord, un seul calcul bcrypt dans les deux cas.
L'écran élève `/mot-de-passe-oublie` ne demande et ne soumet **rien**.

### 5. Le changement obligatoire — appliqué par le serveur

Tant que le drapeau est levé, `StatutCheckFilter` (qui relit déjà le compte à chaque requête
authentifiée pour le statut) **refuse en 403** toute requête authentifiée sauf `GET /api/moi`
et `POST /api/moi/mot-de-passe` (la déconnexion est traitée avant ce filtre).

Choisi plutôt qu'une redirection côté web seule : le middleware Next est un garde d'ergonomie,
pas une frontière de sécurité (en-tête de `web/middleware.ts`) ; un appel direct à l'API le
contourne. Le web fait **en plus** la redirection (`CompteInfo.doitChangerMotDePasse` dans la
réponse de connexion et dans `GET /api/moi` → `/changer-mot-de-passe`), pour que l'élève n'ait
jamais une page en erreur.

`POST /api/moi/mot-de-passe` n'est accepté que **si le drapeau est levé et que le provisoire a
servi** (sinon 409) : sans demander l'ancien mot de passe, il ne doit pas devenir un changement
libre qu'une session volée pourrait utiliser. Nouveau mot de passe : 8 à 128 caractères,
différent du provisoire, comparé comme à la connexion (422). Le compte est verrouillé le temps du
changement, et **toutes les autres sessions du compte sont fermées** : seule celle qui a choisi
le mot de passe reste ouverte.

### 6. Débit limité et sessions

- Réinitialisations : au plus **40 par heure par adulte** et **5 par 24 h par élève**
  (`brio.reinitialisation.*`, réglages validés en N3) → 429 ; l'écran prof dit que l'attente peut
  aller jusqu'à 24 h. Compté sur la table d'audit, en base (pas de Redis, ADR 0034). **Sûr en
  parallèle** : la réinitialisation verrouille la ligne de l'adulte puis celle de l'élève
  (`SELECT … FOR UPDATE`, toujours dans cet ordre, donc sans interblocage) ; deux réinitialisations
  du même adulte ou du même élève s'exécutent l'une après l'autre et chacune compte la trace que
  la précédente a validée.
- Connexions avec le provisoire : le verrou par identifiant et le débit par IP tronquée de
  `V42` s'appliquent tels quels. La réinitialisation **efface** le verrou de l'identifiant de
  l'élève : le prof vient de le voir en personne, et l'élève doit réussir du premier coup (AC8).
- La réinitialisation **supprime toutes les sessions ouvertes** du compte (index par principal
  de Spring Session JDBC, ADR 0034) : une session détenue par un tiers ne survit pas et ne peut
  pas choisir le nouveau mot de passe.

### 7. Trace d'audit

Table `identite.reinitialisations_acces` : `compte_id` (élève), `par_compte_id` (adulte),
`classe_id` (NULL pour §1 bis), `cree_le`, `expire_le`. **Jamais** le mot de passe, son hash, ni
l'IP de l'élève. Elle sert aussi de compteur au débit limité. Les records qui portent un mot de
passe (`ReinitialisationAccesInfo`, `ChangerMotDePasseRequest`) ont un `toString()` masqué : une
ligne de log ne peut pas l'imprimer.

### 8. L'élève est prévenu (arbitrage N3)

Une fois son mot de passe choisi, l'élève voit, en haut des pages de l'application : « Ton accès
a été réinitialisé le … par ton prof (ou : par l'équipe brio). Si ce n'est pas toi qui as choisi
ton mot de passe, préviens ton prof. »

- Données : `acces_reinitialise_le` et `acces_reinitialise_par` (`enseignant` | `admin_brio`),
  posées par la réinitialisation et **conservées** après le changement. Jamais le nom de
  l'adulte. Exposées dans `CompteInfo.accesReinitialise` (`le`, `par`) **seulement** une fois le
  changement fait, et pendant **30 jours** après la réinitialisation (`HORIZON_AVIS`) ; `null`
  sinon. Rien n'est affiché qui ne vienne de là.
- Le bandeau se ferme ; la fermeture est retenue **sur l'appareil seulement** (`localStorage`,
  clé = date de la réinitialisation), jamais sur le serveur : un adulte qui aurait choisi le mot
  de passe à la place de l'élève et fermé le bandeau chez lui ne peut pas le cacher sur l'appareil
  de l'élève. Une nouvelle réinitialisation le refait apparaître.

### 9. Ce que voit l'adulte qui détient le provisoire

Tant que `doitChangerMotDePasse` est vrai, `CompteInfo` (réponse de connexion **et**
`GET /api/moi`) **ne contient pas le pseudonyme** de l'élève (identité de la Communauté, #325) ;
toutes les autres routes sont déjà refusées par §5. Le prof ne peut donc pas, en se connectant
avant l'élève, apprendre sous quel nom celui-ci apparaît hors de la classe.

### 10. Propriété des données et frontières

Tout vit dans `identite` (comptes, classes, inscriptions, sessions, audit) : aucun autre module
n'est touché, aucune frontière Modulith franchie. Contrats publiés dans `identite.api` :
`ReinitialisationAccesInfo` (`identifiantConnexion`, `motDePasseProvisoire`, `expireLe`),
`ChangerMotDePasseRequest`, `EtatAcces` (lu par `system.web.StatutCheckFilter`),
`AvisReinitialisation`, et les champs `CompteInfo.doitChangerMotDePasse` et
`CompteInfo.accesReinitialise`. `EncodeurMotsDePasse` (racine de `identite`) est instancié par
`system.web.SecurityConfig`. `CompteInfo` n'expose toujours pas l'identifiant
(ADR 0016 §4) : seule la réponse de réinitialisation, réservée au prof, le porte.

### 11. Écrans

- `/connexion` : lien « Identifiant ou mot de passe oublié ? » ; champ identifiant sans
  majuscule, correction ni soulignement automatiques.
- `/mot-de-passe-oublie` (public, statique), en phrases courtes : « Va voir ton prof. Il te
  redonne ton identifiant et un mot de passe provisoire. C'est pour ton compte. Ensuite, tu
  choisis ton propre mot de passe. » Puis : pas d'autre solution (attendre le prof), **ne pas
  créer de nouveau compte** (la progression attend), 7 jours et usage unique, pas besoin de ton
  e-mail. Aucun champ, aucun lien vers `/rejoindre` (qui crée un autre compte).
- `/prof/classes/[id]` : « Réinitialiser l'accès » par élève → confirmation (qui dit que l'élève
  sera déconnecté partout ; le focus y entre) → résultat (le focus y passe, WCAG 2.4.3) :
  identifiant groupé par 4 (espacement visuel seulement), provisoire **masqué par défaut** avec
  « Afficher », avertissement « N'affichez pas cet écran au tableau », boutons **Copier** pour
  l'identifiant et le provisoire. Un résultat par élève : en réinitialiser un second n'efface pas
  le premier.
- `/changer-mot-de-passe` : hors coquille, **protégé** (non ajouté aux préfixes publics : il
  n'a de sens qu'avec la session ouverte par le provisoire ; sans session, le middleware
  renvoie à `/connexion`). Avertit « Fais-le maintenant : si tu fermes le navigateur, il faudra
  redemander à ton prof ». Le middleware y renvoie aussi depuis `/connexion`, `/inscription`,
  `/commencer` et `/rejoindre` quand un changement est en attente ; une erreur de `/api/moi`
  (5xx, injoignable) n'est jamais prise pour une session ouverte.

## Risque résiduel accepté

**L'adulte qui détient le provisoire peut agir au nom de l'élève jusqu'au changement.** Le
provisoire lui est remis en clair (c'est le canal choisi) : jusqu'à ce que l'élève se connecte et
choisisse son mot de passe, le prof — ou l'`admin_brio` — peut se connecter à sa place, et même
choisir le mot de passe lui-même, ce qui écarterait l'élève de son compte.

Ce qui le limite :
- **Audit** : chaque réinitialisation est tracée (qui, quel élève, par quelle classe, jusqu'à
  quand) (§7).
- **Débit** : 40 par heure par adulte, 5 par 24 h par élève (§6).
- **Masquage** : pendant le changement en attente, rien d'autre n'est accessible que le choix du
  mot de passe (§5), et le pseudonyme de l'élève n'est pas exposé (§9).
- **Notification** : une fois le mot de passe choisi, l'élève est prévenu de la réinitialisation,
  datée, et invité à prévenir son prof s'il n'a pas choisi ce mot de passe lui-même ; l'adulte ne
  peut pas effacer cet avis de l'appareil de l'élève (§8).
- **Usage unique et expiration** : une seule session, 7 jours au plus (§3).

**Accepté en N3 par Gabrielle le 2026-11-16**, avec ces durcissements.

## Consequences

### Positive
- L'élève **garde son compte et sa progression** ; mot de passe ET identifiant oubliés sont
  couverts (le prof voit l'identifiant dans la réponse).
- Promesses tenues et vérifiables : 7 jours, usage unique, changement obligatoire, testés.
- Aucun e-mail, aucune donnée nouvelle sur l'élève ; aucune énumération possible.
- Une réinitialisation coupe aussi un accès compromis (ancien mot de passe et sessions).

### Negative / trade-offs
- L'élève dépend de la disponibilité de son prof (choix de la porte 1).
- Le provisoire transite en clair une fois, vers le navigateur du prof, et le prof le voit :
  inhérent à un canal humain. Le changement obligatoire le rend inutile **une fois que l'élève a
  choisi son mot de passe** — pas avant : voir « Risque résiduel accepté ».
- Usage unique strict : quitter la session avant d'avoir choisi son mot de passe oblige à
  redemander au prof.
- Un élève qui n'est inscrit dans **aucune** classe active ne peut être réinitialisé que par
  `admin_brio` (§1 bis), et aucun canal ne permet encore à l'élève de le joindre.
- L'avis de §8 dépend de l'appareil pour sa fermeture : sur un nouvel appareil, il réapparaît
  pendant 30 jours.
- Une requête de plus par requête authentifiée ? Non : `StatutCheckFilter` lisait déjà le compte.

### Follow-ups
- **Canal de contact** pour les élèves sans classe active (§1 bis) : à créer (page légale ou
  adresse de support), puis à mentionner sur `/mot-de-passe-oublie`.
- Brancher §1 bis dans l'espace `/admin` (PR #357).
- Purge de `reinitialisations_acces` à aligner sur la rétention des traces de session.
- Reset enseignant (e-mail pro) : ticket séparé.
- Changement de mot de passe **volontaire** (avec l'ancien mot de passe) : ticket séparé.

## Alternatives considered

- **Écran statique + `/rejoindre`** (première version) — rejeté en porte 5 : crée un nouveau
  compte, code multi-usage valable 14 jours, promesse de sécurité fausse.
- **Self-service sans prof** — rejeté : aucun canal n'atteint l'élève (pas d'e-mail) ; un
  « question secrète » ou similaire serait devinable par un camarade.
- **Jeton de réinitialisation à lien** (patron `ConsentementService`, `V11`) — rejeté : il
  faudrait transmettre un lien à l'élève, sans canal ; le provisoire se recopie depuis le prof.
- **Garder l'ancien mot de passe valide à côté du provisoire** — rejeté : ne coupe pas un accès
  compromis, et double la surface d'attaque pendant 7 jours.
- **Redirection côté web seule pour le changement obligatoire** — rejeté : contournable par un
  appel direct à l'API (voir §5).
- **Reset enseignant** — hors périmètre (porte 1).
