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
   **Chaque phrase de l'écran qui affirme un fait cite le fichier:ligne qui la rend vraie** ;
   un lien vers un flux existant est vérifié pour ce qu'il fait (rétro PL-4 : `/rejoindre`
   créait un nouveau compte, « usage unique · 7 jours » était faux).
3. **Plan technique** — *B1*. Modules touchés, contrats d'API, impact faux backend,
   ADR si structurant. Branche via `scripts/start-feature.sh <issue> "<desc>"`. Label → `mesh:plan-technique`.
   **Numéro d'ADR et version de migration réservés dans l'issue**, après
   `node scripts/mesh/check-numerotation.mjs --base origin/develop --open-prs`. Si le
   changement touche à l'authentification ou à l'état d'un compte, le plan nomme le verrou
   de chaque paire concurrente (connexion × réinitialisation…, `.claude/rules/backend-java.md`).
4. **Construction** — *B2, B3, B4, B5* en parallèle. L'ingénieur de tests écrit les
   tests **depuis les critères, sans regarder le code**. Commits conventionnels, push de
   la branche, PR. Sortie : PR verte en CI. Label → `mesh:construction`.
   **Avant chaque push** (et après chaque `git merge origin/develop`), en local : *P4*
   lance `node scripts/mesh/aiguillage.mjs --base origin/develop` et on exécute **les
   contrôles qu'il retient** (les garde-fous du mesh tournent toujours) :
   ```bash
   for f in scripts/mesh/__tests__/*.test.mjs; do node --test "$f" || exit 1; done
   node scripts/mesh/route-budget.mjs --base origin/develop
   node scripts/mesh/check-numerotation.mjs --base origin/develop --open-prs
   ```
   `./mvnw verify`, web test/lint, `check:content` et e2e seulement s'il les retient ; e2e
   ciblés sur les routes touchées sauf s'il demande la suite complète.
   Prettier sur les fichiers modifiés seulement, jamais sur un glob. Corps de PR :
   `Closes #<issue>` en anglais, puis vérifier `gh pr view --json closingIssuesReferences`.
   Détail : `.claude/rules/mesh-hygiene.md`.
5. **Vérification** — *P4 d'abord*, puis **les gardiens qu'il retient** parmi V1–V6, U1,
   U6, U7, en parallèle, **un seul commentaire consolidé** qui commence par le bloc
   « Aiguillage » (lancés / écartés, avec raisons). Tour 1 : `aiguillage.mjs --base
   origin/develop`. **Tours 2-3** : `aiguillage.mjs --since <commit revu>` ; on relance les
   gardiens que la correction réveille et ceux qui avaient un constat, et **chacun ne relit
   que la correction**, pas toute la PR. P4 peut ajouter un gardien (fichier:ligne), jamais
   en retirer. Trois allers-retours au maximum avant escalade vers P1. Sortie : aucun veto. Label → `mesh:verification`.
6. **Simulation** — *S2, S3*, selon P4 : les personas jouent **les tâches touchées**
   (liste de l'aiguillage) sur l'aperçu de la PR (+ routes chaudes voisines si une route
   chaude est touchée) ; S3 seulement si un formulaire, une session, un exercice ou la
   Communauté bouge ; le saboteur tente retour arrière, session expirée, triche. Hors
   budget de clics → retour porte 2. Label → `mesh:simulation`.
7. **Livraison** — *L1*, puis **l'humain**. L1 prépare un résumé lisible (ce qui change
   pour l'élève, captures et clics avant/après, verdicts). **STOP : l'humain merge ou
   refuse.** Puis staging + smoke des routes chaudes 24 h (L2). Label → `mesh:livraison`.
   Juste avant de demander le merge, L1 relance les vérifications locales de la porte 4 sur
   la branche à jour de `develop` et signale l'ordre de merge si une autre PR ouverte ajoute
   une migration ou un ADR.
8. **Apprentissage** — *A1, A3*. Tout ce qui a coincé devient règle, test, persona ou cas
   d'éval. Label → `mesh:apprentissage`, puis fermeture. Matière : verdicts des portes 5-6,
   runs CI rouges ou relancés, commits de correction (« annule », « intègre develop »).
   Exemple joué : `docs/mesh/lecons/2026-11-pl4.md`.

## Garde-fous

- **Aucun push sur `develop`/`main`** ; merge humain sur tout ce qui est N3.
- Un agent qui reçoit un contrat incomplet (voir `docs/mesh/CONTRATS.md`) le **renvoie**.
- Chaque action d'agent laisse une ligne dans le journal (`docs/mesh/JOURNAL.md`). En mode 1
  (session Claude Code), **la session écrit elle-même** dans `mesh/journal/AAAA-MM.jsonl` la
  ligne de chaque porte franchie, verdict, veto et arbitrage humain, dans le commit de la porte ;
  `scripts/mesh/__tests__/journal.test.mjs` en vérifie le format (rétro PL-4 : journal resté vide).
- Simulation sur staging/CI uniquement, jamais sur des données d'élèves réels.

## Note d'implémentation (Phase 1)

Ce skill est le **squelette** du pilote. Les portes 2–8 s'étofferont à mesure que les
pôles correspondants sont activés (Phases 2 à 5). En l'état, il documente l'enchaînement
et pose les deux arrêts humains obligatoires.
