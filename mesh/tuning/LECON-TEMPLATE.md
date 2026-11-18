<!--
Contrat « Leçon » — produit par A1, consommé par A2 puis A3. Vit dans le corps de la PR
`mesh-tuning` (copier ce gabarit, une section par leçon, trois leçons au plus).
Un contrat incomplet est RENVOYÉ par A2, jamais complété au jugé.
Aucune donnée d'élève, aucun contenu de jeu caché.
-->

## Leçon L-AAAA-Wss-N — <titre court>

- **Agent ciblé** : `<ID>` (un seul par PR)
- **Autres agents touchés** : `<ID>`, … ou « aucun »
- **Gravité** : critical | major | minor
- **Niveau de gouvernance** : N3 (modification du mesh)

### 1. Défaut échappé
Ce qui s'est passé, en deux phrases, et **où** c'est passé entre les mailles.
Références : entrées de journal (`mesh/journal/AAAA-MM.jsonl`, ts), issue/PR.
Désaccord humain associé : oui/non (`note_humaine` citée si oui).

### 2. Cause racine
Les « pourquoi » successifs, jusqu'à une cause **dans le mesh** (fiche ambiguë, contrat
incomplet accepté, veto manquant, déclencheur absent, cas d'éval absent).
Une cause « le modèle s'est trompé » ne suffit pas.

### 3. Changement proposé
Diff minimal du mesh (fichier, section). Pourquoi c'est le plus petit changement.
Ce qui **ne** change **pas** (vetos, seuils, tests existants : intouchés).

### 4. Garde-fou à versionner (par A3, après `gain`)
- [ ] règle `.claude/rules/…`
- [ ] skill `.claude/skills/…`
- [ ] test
- [ ] cas d'éval **public** `mesh/evals/corpus/<ID>/<id>.yaml` (origin: regression, lesson: cette leçon)
- [ ] mise à jour de `CLAUDE.md`

### 5. Hypothèse mesurable
« Sur les cas de `<ID>`, le taux de réussite monte, sans régression sur les autres agents. »
Cas publics concernés : liste. Jeu caché : **ne pas préciser** (A1 n'y a pas accès).

### 6. Verdict (rempli par A2, pas par A1)
- Verdict : gain | neutre | régression | non mesurable
- Score public (base → candidat) : … → …
- Score caché agrégé (base → candidat) : … → …
- Non-régression : ok / agent(s) en baisse
- Canaris : aucun retrouvé / **fuite** (escalade)
