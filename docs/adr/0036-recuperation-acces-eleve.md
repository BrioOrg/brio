# 0036 — Récupération d'accès de l'élève : le prof réinitialise le compte existant

- **Status**: Proposed
- **Date**: 2026-11-16
- **Deciders**: Porte 3 du mesh — B1 (architecture) · U1 (veto V5) — arbitrage humain N3 — ticket PL-4 (#364)

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
- `ADMIN_BRIO` peut réinitialiser tout élève inscrit dans la classe désignée.
- Le compte doit être `actif` : un compte en attente de consentement, suspendu ou clos → 409
  (une réinitialisation ne lui rendrait pas l'accès, et ne doit pas contourner une révocation).

Pourquoi passer par la classe : « prof d'une classe où l'élève est inscrit » est exactement la
relation que porte `inscriptions` ; l'écran `/prof/classes/[id]` liste déjà ces élèves.
L'endpoint ne prend que des IDs (ADR 0016 §4) : rien d'identifiant ne transite dans l'URL.

### 2. Le mot de passe provisoire

- Généré par `SecureRandom`, 12 caractères en 3 groupes de 4 séparés par des tirets
  (`k7m4-p9xa-3rtw`), alphabet minuscule **sans caractères ambigus** (ni `0/o`, ni `1/l/i`) —
  le même que l'identifiant (ADR 0018 §5). Les tirets font partie du mot de passe : l'élève
  recopie exactement ce qu'il voit. ≈ 59 bits d'entropie, sous le verrou progressif de `V42`.
- Stocké **haché** (`PasswordEncoder`) dans `mot_de_passe_hash`, **à la place** de l'ancien :
  l'ancien mot de passe cesse de fonctionner immédiatement (utile aussi si le compte a été
  partagé ou volé).
- Renvoyé en clair **dans cette seule réponse**, avec `Cache-Control: no-store`. Aucun endpoint
  ne permet de le relire : perdu, le prof réinitialise à nouveau.

### 3. Expiration et usage unique

Colonnes ajoutées à `identite.comptes` (`V43`) : `doit_changer_mot_de_passe`,
`mot_de_passe_provisoire_expire_le` (création + 7 jours), `mot_de_passe_provisoire_utilise_le`.

- `BrioUserDetailsService` déclare les identifiants **expirés** (`credentialsNonExpired = false`)
  quand le provisoire est **expiré** ou **déjà utilisé**.
- `LoginAuditHandler` marque le provisoire **utilisé** dès la connexion réussie : la session
  ainsi ouverte est la seule qui pourra choisir le nouveau mot de passe. Si l'élève la quitte
  sans l'avoir fait, il retourne voir son prof — c'est le prix de l'usage unique.
- Le changement (`POST /api/moi/mot-de-passe`) remplace le hash, efface les trois colonnes.

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

`POST /api/moi/mot-de-passe` n'est accepté que **si le drapeau est levé** (sinon 409) : sans
demander l'ancien mot de passe, il ne doit pas devenir un changement libre qu'une session volée
pourrait utiliser. Nouveau mot de passe : 8 à 128 caractères, différent du provisoire (422).

### 6. Débit limité et sessions

- Réinitialisations : au plus **40 par heure par adulte** et **5 par 24 h par élève**
  (`brio.reinitialisation.*`) → 429. Compté sur la table d'audit, en base (pas de Redis, ADR 0034).
- Connexions avec le provisoire : le verrou par identifiant et le débit par IP tronquée de
  `V42` s'appliquent tels quels. La réinitialisation **efface** le verrou de l'identifiant de
  l'élève : le prof vient de le voir en personne, et l'élève doit réussir du premier coup (AC8).
- La réinitialisation **supprime toutes les sessions ouvertes** du compte (index par principal
  de Spring Session JDBC, ADR 0034) : une session détenue par un tiers ne survit pas et ne peut
  pas choisir le nouveau mot de passe.

### 7. Trace d'audit

Table `identite.reinitialisations_acces` : `compte_id` (élève), `par_compte_id` (adulte),
`classe_id`, `cree_le`, `expire_le`. **Jamais** le mot de passe, son hash, ni l'IP de l'élève.
Elle sert aussi de compteur au débit limité.

### 8. Propriété des données et frontières

Tout vit dans `identite` (comptes, classes, inscriptions, sessions, audit) : aucun autre module
n'est touché, aucune frontière Modulith franchie. Contrats publiés dans `identite.api` :
`ReinitialisationAccesInfo` (`identifiantConnexion`, `motDePasseProvisoire`, `expireLe`),
`ChangerMotDePasseRequest`, `EtatAcces` (lu par `system.web.StatutCheckFilter`), et le champ
`CompteInfo.doitChangerMotDePasse`. `CompteInfo` n'expose toujours pas l'identifiant
(ADR 0016 §4) : seule la réponse de réinitialisation, réservée au prof, le porte.

### 9. Écrans

- `/mot-de-passe-oublie` (public, statique) : la consigne d'abord — « Va voir ton prof : il te
  redonne ton identifiant et un mot de passe provisoire pour TON compte ; tu choisiras ensuite
  ton propre mot de passe ; le provisoire expire au bout de 7 jours. » Aucun champ, aucun lien
  vers `/rejoindre` (qui crée un autre compte).
- `/prof/classes/[id]` : « Réinitialiser l'accès » par élève → confirmation → affichage unique
  de l'identifiant, du provisoire et de l'expiration.
- `/changer-mot-de-passe` : hors coquille, **protégé** (non ajouté aux préfixes publics : il
  n'a de sens qu'avec la session ouverte par le provisoire ; sans session, le middleware
  renvoie à `/connexion`).

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
  inhérent à un canal humain ; le changement obligatoire le rend inutile ensuite.
- Usage unique strict : quitter la session avant d'avoir choisi son mot de passe oblige à
  redemander au prof.
- Un élève qui n'est inscrit dans **aucune** classe active (Path B sans classe) ne peut pas
  être réinitialisé par un prof : seul `ADMIN_BRIO` le pourrait, via une classe — à traiter
  si le cas se présente (ticket de suivi).
- Une requête de plus par requête authentifiée ? Non : `StatutCheckFilter` lisait déjà le compte.

### Follow-ups
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
