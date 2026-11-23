# Registre des traitements

Registre des traitements de données personnelles de brio, tenu dans le dépôt et mis à jour **en
même temps** que les migrations qui créent ou étendent un traitement
(`CAHIER-DES-CHARGES-V2.md` §5, Contraintes). Lieu décidé par l'humaine à la signature de
l'ADR 0050 (2026-11-23).

> **État.** Ce registre est ouvert avec sa première entrée. Les autres traitements existants
> (comptes et sessions, ADR 0016-0018 ; soumissions d'exercices ; entraide, salon et modération,
> ADR 0023, 0044 ; devoirs) ne sont pas encore inscrits. Leur inscription relève de l'ADR 0018 §3
> et doit être faite avant qu'un établissement réel active la voie A ou qu'un compte voie B réel
> soit ouvert. Ce registre n'est pas une qualification juridique : celle-ci relève de la
> consultation prévue par l'ADR 0018 §3.

## Suivi de progression de l'élève

- **Décisions** : ADR 0022 (chapitres), ADR 0050 (cours d'enseignant).
- **Finalité** : afficher à l'élève seul sa progression (XP, niveau, série, maîtrise par
  compétence, jauge et point de reprise des chapitres et des cours de son enseignant). Aucune
  finalité d'évaluation ni de classement.
- **Personnes concernées** : élèves inscrits (11-15 ans) ; pour les cours, ceux des classes
  auxquelles le cours est porté au moment de l'action.
- **Catégories de données** : identifiant pseudonyme du compte ; identifiants de chapitre, de
  cours, de section, d'exercice (UUID ou clé) et de compétence ; horodatages de lecture, de
  réussite, d'activité et de fin ; lignes d'XP (type, référence, points, date) ; solde et niveau ;
  série (jours actifs, gels) ; maîtrise (niveau, échantillon) et projection des soumissions par
  compétence (correct, score, première tentative, difficulté) ; copie transitoire de
  l'identifiant dans `system.event_publication` pour un événement non abouti.
- **Stockage** : schéma `progression` (migrations V19 à V22, V24, V25, V39 et V45), PostgreSQL
  hébergé dans l'UE.
- **Destinataires** : l'élève seul, par des routes dont l'identité vient de la session. Aucun accès
  enseignant, établissement ou administrateur.
- **Base légale** : celle du compte de l'élève (ADR 0018 §1, voie A ou B).
- **Durée de conservation** : vie du compte, **à titre provisoire**. La durée concrète,
  l'effacement à la suppression d'un compte et la purge anticipée des lignes d'un cours qui n'est
  plus visible sont fixés par #435, à fermer avant toute activation réelle (ADR 0018 §3).
- **Mesures** : pseudonymat (UUID, aucun nom ni classe dans le schéma `progression`) ; identité
  tirée de la session sur toutes les routes ; contrôle de portée avant toute écriture liée à un
  cours ; aucune donnée hors UE ; XP sans boucle pilotable par l'élève (unicité des clés, plafond
  quotidien).
