# Le mesh d'agents de Brio

> Plan établi le 12 novembre 2026 sur l'état réel du dépôt `BrioOrg/brio`.
> Ce document remplace la version précédente écrite sur un état du projet dépassé.
> Les modèles indiqués par agent sont une **proposition de coût**, à valider.

31 agents spécialisés, regroupés en 7 pôles, qui transforment chaque signal (une
friction, un bug, une idée) en changement livré, vérifié, testé par des utilisateurs
simulés, puis en leçon qui rend le système meilleur.

**L'exigence numéro un :** un utilisateur trouve ce qu'il cherche, là où il s'attend
à le trouver, en un minimum de gestes.

| 31 | 7 | 10 | 8 | 3 |
|---|---|---|---|---|
| agents à rôle unique | pôles | contrats d'échange | portes de qualité | boucles d'auto-correction |

---

## Doctrine — six règles qui décident de tout le reste

1. **L'UX passe avant le code.** Aucune ligne de code avant qu'une spec de parcours
   existe : quelle tâche, en combien de clics, depuis quel écran, sur mobile et sur
   ordinateur.
2. **Les routes chaudes sont sacrées.** Les tâches les plus fréquentes ont un budget
   de clics. Une PR qui l'allonge est bloquée automatiquement.
3. **Mesurer, pas deviner.** La fréquentation réelle des routes, mesurée de façon
   anonyme, décide de ce qui est « chaud ». En attendant le trafic, les personas
   simulés servent de proxy.
4. **Un agent, un rôle.** Celui qui écrit ne valide pas. Celui qui propose ne ratifie
   pas. Celui qui améliore un agent ne note pas l'amélioration.
5. **Toute erreur devient un garde-fou.** Chaque défaut qui échappe laisse un test,
   une règle ou un cas d'évaluation. C'est ainsi que le système grandit seul.
6. **Zéro impasse, zéro donnée inventée.** Chaque carte mène à sa destination finale.
   Rien n'est affiché que le backend n'a pas. Le produit est utilisé par des mineurs.

---

## Les 31 agents, par pôle

Chaque fiche vit dans `.claude/agents/<ID>-<slug>.md` et donne : mission, déclencheur,
production, outils, modèle proposé, éventuel droit de veto, et liens (reçoit de / envoie à).

### Pilotage · 3 agents · orienter, décider, tracer
- **P1 Chef d'orchestre** — reçoit chaque signal, choisit qui travaille, tient la file
  et le budget, casse les boucles au-delà de trois tours, escalade vers l'humain.
  *(Haiku pour router, Opus pour arbitrer)*
- **P2 Stratège produit** — tient la vision, transforme les signaux en fiches besoin
  (Given/When/Then), priorise la fluidité d'abord. *(Opus)*
- **P3 Greffier des décisions** — rédige et tient les ADR, vérifie que docs et code
  disent la même chose. *(Sonnet)*

### Expérience utilisateur · 7 agents · fluidité, clarté, accessibilité
- **U1 Cartographe des parcours** ⛔ *veto : allongement d'une route chaude* — carte des
  routes et tâches clés, recalcule la profondeur de clics à chaque PR. *(Sonnet)*
- **U2 Analyste d'usage** — mesure anonyme, classe les routes par fréquentation. *(Haiku)*
- **U3 Architecte de l'information** — où vit chaque chose et comment elle s'appelle ;
  arborescence cible, lexique de l'app. *(Opus)*
- **U4 Designer d'interface** — dessine avec le kit Arcade, uniquement les tokens,
  états vide/chargement/erreur systématiques. *(Opus)*
- **U5 Rédacteur UX** — textes de l'interface en français pour des élèves de 11-15 ans. *(Sonnet)*
- **U6 Ingénieur fluidité** ⛔ *veto : régression de vitesse sur route chaude* — Web
  Vitals en 4G simulée, préchargement, correction de l'historique. *(Sonnet)*
- **U7 Auditeur accessibilité** ⛔ *veto : régression d'accessibilité* — clavier, lecteur
  d'écran, zoom 200 %, contraste, WCAG 2.2 AA. *(Sonnet)*

### Simulation · 4 agents · jouer les vrais usages
- **S1 Scénariste** — personas et scénarios à partir des tâches clés. *(Opus)*
- **S2 Joueurs de personas** — un agent par persona, pilote l'app via l'arbre
  d'accessibilité. *(Haiku)*
- **S3 Saboteur** — fait tout de travers (retour arrière, double clic, session expirée,
  triche). *(Sonnet)*
- **S4 Analyste de friction** — agrège les parcours, score de friction, ouvre des
  tickets reproductibles. *(Opus)*

### Construction · 5 agents · code, contenu, tests
- **B1 Architecte technique** — plan par module, frontières Modulith, contrats d'API,
  ADR si structurant. *(Opus)*
- **B2 Dev backend** — Spring Boot via `work-on-issue`, worktree isolé, commits
  conventionnels. *(Sonnet)*
- **B3 Dev web** — écrans Next.js depuis la spec UI, sans valeur hors tokens. *(Sonnet)*
- **B4 Auteur de contenu** — chapitres manquants (4e, 3e) et annales, jamais publié
  sans le correcteur pédagogique. *(Opus)*
- **B5 Ingénieur de tests** — tests depuis les critères sans regarder l'implémentation,
  puis e2e. *(Sonnet)*

### Vérification · 6 agents · bloquer ce qui ne va pas
- **V1 Relecteur de code** ⛔ *veto : constat bloquant* — revue contre les règles du
  dépôt et les ADR, diagnostic des échecs CI. *(Opus)*
- **V2 Gardien des contrats** ⛔ *veto : dérive de contrat* — `openapi.json`, schémas
  Zod, faux backend et vrai backend cohérents. *(Sonnet)*
- **V3 Contrôleur des tests** ⛔ *veto : test existant affaibli* — mutation, tests
  affaiblis ou instables. *(Haiku)*
- **V4 Correcteur pédagogique** ⛔ *veto : erreur disciplinaire* — recalcule chaque
  réponse, typographie française, cohérence compétence/niveau. *(Opus)*
- **V5 Gardien sûreté et mineurs** ⛔ *veto : risque pour un mineur* — évals tuteur,
  RGPD, modération, mesure d'usage, aucune donnée inventée. *(Opus)*
- **V6 Contrôleur visuel** ⛔ *veto : écart au kit Arcade* — captures 360/768/1280 px
  clair et sombre vs styleguide. *(Sonnet)*

### Livraison · 3 agents · assembler, déployer, surveiller
- **L1 Intégrateur** — assemble les verdicts, rebase sur develop, résumé lisible
  avant/après pour l'humain. *(Sonnet)*
- **L2 Veilleur de staging** — rejoue les routes chaudes après déploiement, propose un
  retour arrière par snapshot. *(Haiku)*
- **L3 Gardien des dépendances** — audit sécurité et licences, mises à jour groupées. *(Haiku)*

### Apprentissage · 3 agents · se corriger, se souvenir
- **A1 Rétrospecteur** — lit le journal, trouve les causes racines, propose des
  corrections au mesh lui-même. *(Opus)*
- **A2 Examinateur des agents** — évalue chaque agent sur un corpus (dont une part
  cachée), décide des montées/descentes d'autonomie. *(Opus)*
- **A3 Bibliothécaire** — mémoire du mesh : chaque leçon devient règle, skill, test ou
  cas d'éval ; `CLAUDE.md` reste vrai. *(Sonnet)*

---

## La chaîne : du signal à la leçon (8 portes)

Une porte ne s'ouvre que si son critère de sortie est rempli. Les retours en arrière
sont prévus et limités.

```
Signal → 1·Besoin → 2·Parcours et UI → 3·Plan technique → 4·Construction
       → 5·Vérification → 6·Simulation → 7·Livraison → 8·Apprentissage
```

Retours en arrière :
- **5 → 4** : corrections demandées, trois tours au maximum, puis escalade vers l'humain.
- **6 → 2** : la tâche dépasse son budget de clics, le parcours est repensé.
- **7 → Signal** : le veilleur de staging rejoue les routes chaudes et remonte les incidents.
- **8 → 2 et 5** : chaque leçon devient règle, test, persona ou cas d'évaluation.

| Porte | Responsable | Critère de sortie |
|---|---|---|
| 1 · Besoin | Stratège produit | critères testables, priorité justifiée |
| 2 · Parcours et UI | Pôle UX | budget de clics fixé, écrans maquettés (kit Arcade), états vide/chargement/erreur |
| 3 · Plan technique | Architecte technique | plan validé, ADR « Proposed » si nécessaire |
| 4 · Construction | Devs, contenu, tests | PR verte en CI, critères couverts par des tests |
| 5 · Vérification | 6 gardiens + UX | aucun constat bloquant, aucun veto |
| 6 · Simulation | Personas sur la branche | tâche réussie dans le budget, aucune nouvelle impasse |
| 7 · Livraison | Intégrateur + humain + veilleur | staging sain 24 h, sinon retour par snapshot |
| 8 · Apprentissage | Rétro, examen, mémoire | au moins une leçon versionnée par incident |

---

## Les dix contrats d'échange

Les agents ne se parlent pas en prose libre : ils s'échangent des documents au format
fixe, stockés sur GitHub. Un agent qui reçoit un contrat incomplet **le renvoie** au
lieu de deviner. Voir [`CONTRATS.md`](CONTRATS.md) *(à produire en Phase 1)*.

| Contrat | Produit par | Consommé par | Où il vit |
|---|---|---|---|
| Signal | S4, U2, L2, V*, humain | P1 | issue `mesh:inbox` |
| Fiche besoin | P2 | U1, U3, B1, B4, B5 | corps de l'issue |
| Spec de parcours | U1, U3 | U4, U6, B3, S1 | commentaire d'issue |
| Spec UI | U4, U5 | B3, V6, U7 | commentaire + captures |
| Plan technique | B1 | B2, B3, V1, V2 | commentaire d'issue |
| Décision conseil | P2+B1+gardien | P3, tous | `docs/adr/` |
| Changement | B2, B3, B4, B5 | V1–V6, U6, U7, S2 | pull request |
| Rapport de vérification | V1–V6, U6, U7 | L1, auteur | revue de PR |
| Rapport de simulation | S2, S3, S4 | P2, U1, L1 | artefact CI + résumé |
| Leçon | A1 | A2, A3 | PR `mesh-tuning` |

---

## Gouvernance — qui décide quoi

| Niveau | Exemples | Qui décide | Trace |
|---|---|---|---|
| N0 · automatique | renommage, test instable corrigé, faute de frappe | l'agent qui agit | journal |
| N1 · responsable | choix interne à un module, libellé, ordre de deux tickets | l'agent propriétaire du domaine | commentaire « Décision » |
| N2 · conseil | nouvel écran, route chaude modifiée, nouvelle dépendance, nouvelle table | P2 + B1 + gardien concerné | ADR « Proposed » |
| N3 · humain | données de mineurs, tuteur, mesure d'usage, coûts, irréversible, **modification du mesh** | toi | ADR « Accepted » signé |

### Autonomie gagnée par la mesure
0. **observateur** : commente sans bloquer (point de départ de chaque agent).
1. **conseiller** : ouvre des tickets, verdicts consultatifs.
2. **acteur** : ouvre des PR, verdicts bloquants. Désaccord humain < 15 % sur 20 interventions.
3. **autonome encadré** : ratifie le N2 unanime. Désaccord < 5 % sur 50 interventions.
4. **auto-merge** : PR N0 seulement, par catégorie, sur décision humaine.

> Tout incident fait redescendre l'agent d'un niveau.

### Garde-fous non négociables
- **Aucun push sur `develop` ou `main`** ; merge humain sur tout ce qui est N3.
- `.claude/**`, `.github/**`, évals et visuels figés : **propriétaire humain** (CODEOWNERS).
- Un test existant ne s'affaiblit jamais sans l'accord du contrôleur des tests.
- L'examinateur garde un jeu de cas caché que le rétrospecteur ne voit jamais.
- Budget par agent, pause automatique à 80 %, interrupteur global.
- Simulation sur staging et CI seulement, **jamais sur des données d'élèves réels**.

---

## Auto-correction — trois boucles, trois rythmes

- **La PR · minutes** — construction ↔ vérification, trois tours au plus. Un échec CI est
  d'abord diagnostiqué par le relecteur avant que le dev ne touche au code.
- **Le produit · chaque nuit** — staging remis à zéro, personas et saboteur rejouent les
  tâches clés, l'analyste de friction compare au jour précédent. Une hausse rouvre la PR.
- **Le mesh · chaque semaine** — le rétrospecteur propose des corrections, l'examinateur
  les mesure sur le jeu caché, le bibliothécaire versionne la leçon. L'humain merge.

---

## Ordre de construction du mesh

| Phase | Agents activés | Preuve que c'est fait | Durée |
|---|---|---|---|
| **1 · Fondations** | P1, P3, A3 | labels, journal, fiches agents dans `.claude/agents/`, CODEOWNERS | 3 j |
| **2 · UX et simulation** | U1–U7, S1–S4 | carte des routes publiée, budget de clics en CI, rapport de nuit | 8 j |
| **3 · Vérification** | V1–V6, B5 | une revue consolidée par PR, mutation et contrats en CI | 7 j |
| **4 · Décision et construction** | P2, B1–B4, L1–L3 | un ticket du premier lot livré sans intervention avant le merge | 6 j |
| **5 · Apprentissage** | A1, A2 | première PR `mesh-tuning` mergée avec gain mesuré sur le jeu caché | 5 j |

> L'UX passe avant la vérification générale : c'est l'exigence prioritaire, et le
> cartographe plus les personas sont eux-mêmes des vérificateurs.

---

## Modes d'exécution

| Mode | Déclenchement | Ce qu'il faut |
|---|---|---|
| 1 · Claude Code (jour 1) | `/feature …` dans une session Claude Code | fiches `.claude/agents/*.md` + skill `/feature` qui étend `work-on-issue` |
| 2 · GitHub automatique | ouverture d'issue, `/mesh` ou `@claude`, PR, échec CI | workflows `mesh-*.yml` + **app GitHub Claude installée sur `BrioOrg`** |
| 3 · Planifié | simulation chaque nuit, rétro chaque lundi | tâches planifiées Claude Code (cloud) ou cron |

> **Prérequis bloquant aujourd'hui :** l'app GitHub Claude sur `BrioOrg`, sans laquelle
> aucun agent ne peut pousser de branche ni ouvrir d'issue.

---

## Le premier lot (ce que le mesh traite en premier)

Les impasses passent avant tout — une impasse casse la confiance plus vite qu'une
fonctionnalité absente. Voir [`PREMIER-LOT.md`](PREMIER-LOT.md) *(à produire en Phase 4)*.

---

## Coûts (ordres de grandeur, à recaler sur la 1re semaine)

| Activité | Volume estimé | Équiv. tarif API public |
|---|---|---|
| Une feature de A à Z (~15 passages) | 2–4 M lus (~80 % cache), 100–200 k écrits | 5–10 $ tout Opus · 2–4 $ en mix |
| Une nuit de simulation (8 personas × ~40 étapes) | ~3 M, surtout Haiku | < 1 $ |
| Red team du tuteur (chaque nuit) | ~0,5 M | ~1 $ |
| Rétro + examen des agents (chaque semaine) | 1–2 M | 3–6 $ |
| Vérification des 45 chapitres (une fois) | ~5 M | 15–25 $ |

> Avec un abonnement Claude, tu consommes une limite hebdomadaire, pas des dollars.
> Mesure réelle : `/usage` dans Claude Code après la première feature.
