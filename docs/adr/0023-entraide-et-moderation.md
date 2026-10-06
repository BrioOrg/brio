# 0023 — Entraide (F6a) et socle de modération

- **Status**: Proposed
- **Date**: 2026-10-05
- **Deciders**: Gabrielle Clamaran

## Context

La demande d'origine décrit « un Discord, fortement modéré, réservé à l'école ».
La feuille de route (§11) coupe F6 en deux parce que les deux moitiés ne coûtent
pas la même chose : la messagerie est une semaine de travail, la modération est le
reste. Les deux usages qui portent la valeur — poser une question sur un exercice,
aider un camarade — ne demandent ni temps réel, ni salons, ni messages privés.

F6a dépend de F2 (XP) et F1 (déploiement), **tous deux livrés et en ligne**. Le
module `social` existe déjà en coquille (Modulith), sans implémentation. Cet ADR
cadre **F6a (l'entraide)** et le **socle de modération** réutilisable ; **F6b (la
messagerie de classe)** est explicitement différée à un ADR/lot ultérieur.

Contrainte de fond : le produit héberge des échanges entre **mineurs**. Toute
brique qui ouvre un canal entre élèves doit arriver avec sa modération, pas après.

## Decision

Nous construisons **F6a seul** dans un nouveau module `fr.brio.social`, avec le
socle de modération minimal mais structurel.

1. **Fils attachés au contenu.** Un fil s'ouvre depuis un **chapitre** ou un
   **exercice**, visible de la **classe** de l'auteur. **Texte seul** : pas
   d'images, pas de fichiers, pas de messages privés élève ↔ élève. **Asynchrone :
   REST + rafraîchissement, pas de WebSocket** (chaque brique temps réel est un
   endroit où un message échappe à la file de modération).

2. **Réponse utile → XP (F2).** L'auteur d'une question marque une réponse comme
   utile → événement `ReponseUtileValidee` → **15 XP** au répondeur, **plafond
   3/jour, idempotent** par `(élève, source, motif)` (ADR 0022), **révocable par un
   modérateur**. `social` publie l'événement ; `progression` l'écoute. Aucun appel
   modèle ⇒ pas d'éval requise.

3. **Garde anti-triche sur les fils d'exercice.** Dans un fil attaché à un
   **exercice**, un message est **masqué aux élèves qui n'ont pas encore soumis**
   cet exercice (l'auteur peut toujours poser sa question). Même principe que le
   tuteur : c'est le raisonnement qui compte, pas la réponse donnée. `social` tient
   sa propre projection des soumissions en **écoutant l'événement de soumission**
   d'`exercices` (référence par identifiant, pas d'objet partagé).

4. **Socle de modération — minimum structurel, en quatre couches amorcées.**
   - **Préventif** : limitation de débit à l'écriture, longueur bornée, pas de lien
     externe cliquable, pas de pièce jointe.
   - **Humain** : l'**enseignant est modérateur de sa classe**. Signalement en deux
     clics depuis chaque message (`social.signalements`), file de signalements,
     action **masquer** un message et **sanctionner** un compte (`social.sanctions`).
   - **Automatique** (classifieur IA) et **protocole de détresse** : **différés**.
     Le classifieur demande le même jeu d'éval que le tuteur ; le protocole de
     détresse se rédige **avec l'établissement**, pas seul. Les tables portent déjà
     les colonnes de statut (`en_moderation`, `masque`) pour les accueillir sans
     migration de rupture.

5. **Modèle (schéma `social`).** `fils`, `messages`, `signalements`, `sanctions`
   (feuille de route §11.2). `social` référence `identite`, `contenu` et
   `exercices` **par identifiant** et écoute leurs événements ; le test de
   frontières `ModularityTests` reste vert sans exception ajoutée.

6. **Rétention.** Messages conservés 12 mois puis anonymisés ; données
   d'identification (LCEN) séparées du contenu. Mécanisme implémenté comme une tâche
   de purge ; branché au déploiement avec le reste de la rétention (aligné sur F5).

## Consequences

### Positive
- Livre la valeur réelle (poser/répondre à une question) pour ~une semaine, sans
  l'infrastructure temps réel ni le risque de la messagerie privée.
- La garde anti-triche réutilise exactement la logique du tuteur (mode contrôle,
  ADR 0025) : cohérence structurelle, pas un verrou d'UI.
- Le socle de modération est posé dès l'ouverture du premier canal entre mineurs —
  on n'ouvre jamais un canal sans file de signalements ni modérateur.

### Negative / trade-offs
- Sans classifieur automatique, la modération repose entièrement sur le prof et les
  signalements : acceptable en environnement privé (test à deux), **à compléter
  avant toute ouverture à de vrais élèves**.
- La projection locale des soumissions dans `social` duplique une donnée
  d'`exercices` (assumé : garde la frontière Modulith nette, pas d'appel synchrone
  transverse à chaud).

### Follow-ups
- **F6b** — messagerie de classe (salons créés par le prof, conversation
  élève → prof ; pas de messages privés élève ↔ élève en v1) : ADR dédié.
- **Classifieur IA de modération** + son harnais d'éval (cas réels).
- **Protocole de détresse** écrit, et **AIPD** (analyse d'impact) à instruire avant
  l'ouverture à des mineurs réels.
- Lien externe cliquable, pièces jointes : seulement si un vrai besoin apparaît,
  jamais sans l'étage de modération correspondant.

## Alternatives considered

- **Tout F6 d'un coup (entraide + messagerie)** — différé : double la surface de
  modération et mélange le risque faible (entraide publique de classe) avec le
  risque fort (canaux conversationnels), pour une livraison bien plus lente.
- **WebSocket / temps réel (présence, frappe, salons)** — rejeté en v1 : une
  infrastructure temps réel pour un forum de trente élèves qui posent trois
  questions par soir, et autant d'endroits où un message échappe à la file.
- **Garde anti-triche uniquement côté client** — rejetée : non-autoritative ; le
  serveur masque les messages, comme il coupe le tuteur (ADR 0025).
- **Classifieur IA dès la v1** — différé : demande un jeu d'éval dédié et des cas
  réels ; le socle préventif + humain est suffisant et sûr pour l'environnement
  privé.
