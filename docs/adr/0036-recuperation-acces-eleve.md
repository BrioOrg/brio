# 0036 — Récupération d'accès de l'élève (écran statique, ré-émission par le prof)

- **Status**: Proposed
- **Date**: 2026-11-16
- **Deciders**: Porte 3 du mesh — B1 (architecture) · U1 (veto V5) — ticket PL-4 (#364)

## Context

Le lien « Mot de passe oublié ? » de `web/components/login-form.tsx` pointe vers
`/mot-de-passe-oublie`, une route qui n'existe pas : l'élève tombe sur un **404**, une
impasse sur un chemin de récupération d'accès, dans un produit utilisé par des mineurs
(ADR 0018). C'est le signal PL-4 du premier lot (`docs/mesh/PREMIER-LOT.md`, « lien mort »).

Les contraintes de données sont fermes et déjà actées :

- Les comptes (`V8__identite_comptes.sql`) ont un `identifiant_connexion` et un
  `mot_de_passe_hash` pour tous, mais **l'`email` est réservé aux adultes** : aucun élève
  n'a d'e-mail personnel. Les élèves Path B « consentement » n'ont qu'un
  `email_titulaire_legal` (e-mail **parent**) ; les élèves Path A « mission
  d'établissement » n'ont **aucun e-mail** (ADR 0018).
- L'`identifiant_connexion` est généré côté serveur et montré **une seule fois**
  (ADR 0018 §5).
- Il n'existe **aucun endpoint de réinitialisation** côté `identite` aujourd'hui.

Arbitrage humain (porte 1) : périmètre **élève seul** ; canal de récupération **via le
prof / l'établissement** (fin de parcours valide) ; portée **mot de passe ET identifiant**.
La gouvernance N3 (données d'authentification de mineurs) impose un arrêt humain et un ADR
sur le mécanisme — le présent document.

## Decision

Pour la v1, nous **n'ajoutons aucun endpoint ni jeton nouveau**. Nous rendons
`/mot-de-passe-oublie` vivant avec un **écran 100 % statique** (Server Component, sans
`'use client'`) qui **ne demande ni identifiant, ni e-mail, ni aucune donnée** et **ne
soumet rien**. L'écran porte une consigne actionnable : « demande à ton prof, il te
ré-émet un identifiant et un mot de passe », avec un rebouclage vers le flux
**`/rejoindre` existant** (code-classe, identifiant montré une fois) par lequel
l'enseignant ré-émet un accès.

La ré-émission d'accès de l'élève est donc **médiée par l'enseignant**, via un flux déjà
en place, sans endpoint de reset côté `identite`.

## Consequences

### Positive
- **Pas d'énumération de comptes (AC5) par construction** : rien n'est soumis, donc aucun
  signal observable ne peut distinguer un compte existant d'un compte absent.
- **Aucun e-mail d'élève manipulé (AC2)** : l'écran n'en demande ni n'en envoie aucun —
  cohérent avec le fait qu'aucun e-mail d'élève n'existe en base.
- **Zéro impasse (AC1, AC3)** : le 404 disparaît et les trois cas (mot de passe oublié,
  identifiant oublié, les deux) convergent vers la même sortie « via le prof ».
- **Accès effectivement reconstitué (AC4, AC8)** : le prof ré-émet via `/rejoindre`
  (identifiant montré une fois), un accès à usage unique et à expiration ≤ 7 j conforme à
  l'existant — **sans backend neuf**.
- Ne montre **aucune donnée que le backend n'a pas** ; aucune route chaude allongée.

### Negative / trade-offs
- **Pas de self-service autonome** : l'élève dépend de la disponibilité de son enseignant.
  C'est un choix assumé (porte 1), le seul canal réaliste pour un élève sans e-mail.
- La ré-émission repose sur le bon usage du flux `/rejoindre` par l'enseignant ; aucun
  contrôle technique nouveau n'est ajouté ici.

### Follow-ups
- Front : route statique `web/app/mot-de-passe-oublie/page.tsx`, test de lien vivant +
  rendu, e2e desktop/mobile (ce ticket).

## Alternatives considered

- **Endpoint de réinitialisation self-service côté `identite`** — rejeté pour la v1 : exige
  un canal de notification que l'élève n'a pas (aucun e-mail), et un nouvel endpoint +
  jeton + anti-brute-force, hors budget et hors arbitrage « via le prof ». Chemin futur si
  le self-service autonome devient exigé : endpoint dédié réutilisant le patron
  `ConsentementService` (jeton haché à usage unique + expiration + jeton de révocation
  distinct, `V11`) et la protection par identifiant + IP tronquée (`V42`, ADR 0017 §5).
- **Reset enseignant (e-mail pro)** — hors périmètre (porte 1), ticket séparé.
- **Laisser le lien tel quel / le retirer** — rejeté : retirer le lien masque le besoin sans
  offrir de chemin de récupération ; le garder mort entretient l'impasse pour un mineur.
