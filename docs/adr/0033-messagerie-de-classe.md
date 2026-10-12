# 0033 — Messagerie de classe (F6b)

- **Status**: Proposed
- **Date**: 2026-10-12
- **Deciders**: Gabrielle Clamaran

## Context

F6a a livré l'entraide (fils attachés au contenu, ADR 0023) et son socle de
modération. F6b est l'autre moitié de F6 (feuille de route §11.3-11.5) : un
**canal conversationnel de classe**. La demande d'origine parlait d'« un Discord
fortement modéré, réservé à l'école » ; la feuille de route a tranché que la
messagerie coûte une semaine et la modération tout le reste, et que le canal le
plus risqué (messages privés élève ↔ élève) porte le moins de valeur.

Le produit héberge des échanges entre **mineurs** : tout canal arrive avec sa
modération, pas après. Le module `social` existe déjà (entraide) avec ses briques
réutilisables : `ModerationPreventive`, `sanctions` (par compte), le pattern
signalement + prof modérateur.

## Decision

Nous construisons **F6b v1 côté back** : un **salon de classe de groupe**, en
réutilisant au maximum le socle de F6a. **Pas de messages privés élève ↔ élève.**

1. **Salon de classe, créé par l'enseignant.** Un salon appartient à une classe,
   est créé par un enseignant de cette classe, et est **visible de toute la
   classe**. Les élèves **et** l'enseignant y écrivent ; les élèves posent, le prof
   répond, à la vue de tous — c'est ce qui rend le canal modérable (rien
   d'invisible). Les **messages privés élève ↔ élève sont hors périmètre** (canal le
   plus risqué, le moins pédagogique, le plus dur à modérer).

2. **Asynchrone.** REST + rafraîchissement, **pas de WebSocket** : chaque brique
   temps réel est un endroit où un message échappe à la file de modération, pour
   une classe qui poste quelques messages par soir.

3. **Modération = le socle de F6a, réutilisé.**
   - **Préventif** : `ModerationPreventive` (longueur bornée, pas de lien externe,
     pas de pièce jointe) + limitation de débit à l'écriture.
   - **Humain** : l'enseignant de la classe **masque** un message ; un membre
     **signale** un message (deux clics) → file de signalements du prof.
   - **Sanctions** : la table `social.sanctions` est **réutilisée telle quelle**
     (elle cible un compte, pas un message) — une sanction de lecture seule rend un
     élève muet **partout** (entraide et messagerie), ce qui est le bon
     comportement.
   - **Différés** (comme F6a) : le classifieur IA (demande un jeu d'éval dédié) et
     le **protocole de détresse** (se rédige avec l'établissement). Les tables
     portent déjà les statuts (`masque`) pour les accueillir sans rupture.

4. **Modèle (schéma `social`, migration V37).** Nouvelles tables `salons`,
   `salon_messages`, `salon_signalements` ; `sanctions` inchangée. Tables séparées
   des tables d'entraide (parent différent : un salon n'est pas un fil) — pas de FK
   cross-module, références par identifiant (ADR 0007). Le test `ModularityTests`
   reste vert sans exception.

5. **Endpoints distincts de l'entraide.** `/api/salons` (membre) et
   `/api/prof/salons` (enseignant, gated par `/api/prof/**` dans SecurityConfig).
   On ne touche PAS aux endpoints d'entraide (le front d'entraide en dépend).

## Consequences

### Positive
- Livre le canal de classe sans l'infrastructure temps réel ni le risque des
  messages privés.
- Réutilise le socle de modération et les sanctions de F6a : cohérence (un muet est
  muet partout), peu de code neuf.
- Un salon de groupe visible est le canal le plus facile à modérer (tout est à la
  vue du prof, présent dans le salon).

### Negative / trade-offs
- Pas de conversation privée élève ↔ prof en v1 (un élève timide n'a pas de canal
  discret) : assumé, c'est le canal le plus risqué ; à rouvrir plus tard si besoin.
- `salon_signalements` duplique la forme de `signalements` d'entraide plutôt que de
  rendre `signalements` polymorphe : évite d'altérer une table déployée (V36) et son
  FK ; la file de modération du prof lit les deux sources.

### Follow-ups
- Front de la messagerie (salon côté élève + côté prof) : lot/PR séparé.
- Classifieur IA de modération + son harnais d'éval.
- Protocole de détresse écrit et **AIPD** avant toute ouverture à de vrais mineurs.
- Rétention (12 mois puis anonymisation), LCEN, DSA : tâche de purge, branchée au
  déploiement avec le reste de la rétention (aligné F5/F6a).
- Conversation privée élève ↔ enseignant, si un vrai besoin apparaît (avec sa
  modération).

## Alternatives considered

- **Conversations privées élève ↔ prof (1:1) en v1** — différé : canal invisible,
  le plus dur à modérer, pour la valeur la plus faible (le CDC conseille de
  l'éviter en v1).
- **Temps réel (WebSocket, présence, frappe)** — rejeté : infrastructure temps réel
  pour un forum de classe, et autant d'endroits où un message échappe à la file.
- **Rendre `signalements` polymorphe (entraide + salon)** — rejeté en v1 : imposerait
  d'altérer la table déployée V36 et de dropper un FK auto-nommé (fragile selon
  l'environnement) ; une table `salon_signalements` séparée est non-bloquante.
- **Salons créés par les élèves / salons thématiques multiples** — hors v1 : un
  salon par classe, créé par le prof, suffit et borne la modération.
