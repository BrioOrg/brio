---
name: feature
description: >-
  Lance une feature de A à Z à travers les 8 portes du mesh d'agents, dans une
  session Claude Code. Use when the user types "/feature …" or describes a new
  feature/fix as a single sentence to run through the mesh pipeline.
---

# /feature — une feature de A à Z à travers le mesh

Étend `work-on-issue` : au lieu de partir d'un numéro d'issue, on part d'**une phrase**,
et on enchaîne les huit portes de `docs/mesh/PLAN-AGENT-MESH.md`. Une porte ne s'ouvre
que si son critère de sortie est rempli. Deux étapes seulement exigent l'humain :
**la validation de l'issue (porte 1)** et **le merge (porte 7)**.

> Mode d'emploi détaillé : `docs/mesh/PLAN-AGENT-MESH.md` (section « Une feature de A à Z »).
> Fiches des agents cités : `.claude/agents/<ID>-*.md`.

## Entrée

```
/feature le devoir du jour doit s'ouvrir en un clic depuis l'accueil
```

Une phrase, sans format imposé. Crée/étiquette une issue `mesh:inbox`.

## Les 8 portes (dans l'ordre, retours en arrière limités)

1. **Besoin** — *P2*. Lit code + ADR, pose 0 à 3 questions, écrit l'issue
   (persona, tâche, critères Given/When/Then, priorité). **STOP : l'humain répond
   « ok » ou corrige. Ce n'est jamais l'humain qui rédige l'issue.**
   Sortie : critères testables, priorité justifiée. Label → `mesh:besoin`.
2. **Parcours & UI** — *U1, U3, U4, U5, U6*. Clics actuels + budget cible, emplacement
   du lien, composants du kit Arcade, textes, états vide/chargement/erreur. Si une route
   chaude change ou un écran est créé (N2), demander l'avis de l'humain. Label → `mesh:parcours-ui`.
   ⛔ U1 oppose son veto si une route chaude s'allonge.
3. **Plan technique** — *B1*. Modules touchés, contrats d'API, impact faux backend,
   ADR si structurant. Branche via `scripts/start-feature.sh <issue> "<desc>"`. Label → `mesh:plan-technique`.
4. **Construction** — *B2, B3, B4, B5* en parallèle. L'ingénieur de tests écrit les
   tests **depuis les critères, sans regarder le code**. Commits conventionnels, push de
   la branche, PR. Sortie : PR verte en CI. Label → `mesh:construction`.
5. **Vérification** — *V1–V6, U6, U7*, en parallèle, **un seul commentaire consolidé**.
   Trois allers-retours au maximum avant escalade vers P1. Sortie : aucun veto. Label → `mesh:verification`.
6. **Simulation** — *S2, S3*. Personas jouent la tâche sur l'aperçu de la PR (+ routes
   chaudes voisines) ; le saboteur tente retour arrière, session expirée, triche. Hors
   budget de clics → retour porte 2. Label → `mesh:simulation`.
7. **Livraison** — *L1*, puis **l'humain**. L1 prépare un résumé lisible (ce qui change
   pour l'élève, captures et clics avant/après, verdicts). **STOP : l'humain merge ou
   refuse.** Puis staging + smoke des routes chaudes 24 h (L2). Label → `mesh:livraison`.
8. **Apprentissage** — *A1, A3*. Tout ce qui a coincé devient règle, test, persona ou cas
   d'éval. Label → `mesh:apprentissage`, puis fermeture.

## Garde-fous

- **Aucun push sur `develop`/`main`** ; merge humain sur tout ce qui est N3.
- Un agent qui reçoit un contrat incomplet (voir `docs/mesh/CONTRATS.md`) le **renvoie**.
- Chaque action d'agent laisse une ligne dans le journal (`docs/mesh/JOURNAL.md`).
- Simulation sur staging/CI uniquement, jamais sur des données d'élèves réels.

## Note d'implémentation (Phase 1)

Ce skill est le **squelette** du pilote. Les portes 2–8 s'étofferont à mesure que les
pôles correspondants sont activés (Phases 2 à 5). En l'état, il documente l'enchaînement
et pose les deux arrêts humains obligatoires.
