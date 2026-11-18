# La boucle `mesh-tuning`

La troisième boucle d'auto-correction du plan : **« Le mesh · chaque semaine »**. Elle
transforme les défauts échappés de la semaine en corrections du mesh lui-même, mesurées
avant d'être acceptées. Doctrine n°5 : *toute erreur devient un garde-fou.*

```
journal ──► A1 Rétrospecteur ──► PR mesh-tuning ──► A2 Examinateur ──► A3 Bibliothécaire ──► humain
 (7 jours)   cause racine         label mesh:tuning   mesure sur le       versionne la          merge
                                   + Leçon             jeu CACHÉ           leçon (N3)
```

Chaque flèche est un agent différent : celui qui propose ne mesure pas, celui qui
mesure ne versionne pas, celui qui versionne ne ratifie pas (doctrine n°4).

## Une leçon, de bout en bout

| # | Qui | Quoi | Trace |
|---|---|---|---|
| 1 | **A1** | lit `mesh/journal/` (7 jours) : désaccords humains, vetos, escalades, incidents ; remonte à une cause racine **dans le mesh** | ligne `retro` |
| 2 | **A1** | écrit la **Leçon** (`mesh/tuning/LECON-TEMPLATE.md`) et ouvre la PR `mesh-tuning/AAAA-Wss-<slug>`, label `mesh:tuning`, 3 leçons au plus, un agent cible | ligne `lesson`, PR |
| 3 | **A2** | exécute l'agent ciblé sur le corpus public **et** le jeu caché : base vs candidat ; contrôle les canaris | commentaire de PR (agrégats), ligne `eval` |
| 4 | **A2** | verdict : `gain` · `neutre` · `régression` · `non mesurable` | commentaire, rapport `mesh/evals/reports/` |
| 5 | **A3** | **seulement si `gain`** : versionne le garde-fou (règle, skill, test ou cas d'éval public), met à jour `CLAUDE.md` si besoin | commit sur la PR, ligne `lesson` |
| 6 | **Humain** | relit et merge (**N3** : le mesh se modifie) ; sinon ferme avec une note | `note_humaine` au journal |

### Verdicts et suite

| Verdict | Condition (mesurée par A2) | Suite |
|---|---|---|
| `gain` | caché : écart > 0 pour l'agent ciblé, aucune régression ailleurs (public ni caché) | A3 versionne, humain merge |
| `neutre` | pas d'écart caché, ou gain sur le public seul (surapprentissage) | PR fermée, la leçon reste au journal |
| `régression` | un agent perd en score public ou caché | PR bloquée ; A1 reprend **un** tour de plus |
| `non mesurable` | moins de 5 cas cachés pour l'agent ciblé | merge humain explicite possible, **mais aucune montée d'autonomie** |

Au plus **trois tours** A1 ↔ A2 par leçon, puis `mesh:escalade` (comme la boucle de PR).

## Ce que la boucle a le droit de changer

Dans une PR `mesh-tuning` : une fiche d'agent (`.claude/agents/`), une règle
(`.claude/rules/`), un skill, un cas d'éval **public**, `CLAUDE.md`, la doc du mesh.

Jamais : retirer un veto, abaisser un seuil d'autonomie, affaiblir un test ou un cas
existant, toucher au jeu caché, `.github/**`. Ces changements relèvent d'un humain
directement (N3). Une leçon qui l'exigerait est **escaladée**, pas proposée sous une autre forme.

## Cadence et budget

- **Lundi** : A1 (cron), puis A2 sur chaque PR `mesh:tuning` ouverte, puis A3 sur les `gain`.
- Une passe hebdomadaire. Pas de PR si rien à corriger (ligne `retro`, `detail: "RAS"`).
- Budget : 1–2 M de tokens la semaine (plan, « Coûts ») ; pause à 80 %, interrupteur global.
- Les agents d'apprentissage démarrent à **0 · observateur** : tant qu'A1 est à 0, ses PR
  sont des brouillons consultatifs ; l'humain décide seul.

## Où est quoi

| Élément | Chemin |
|---|---|
| Fiches | `.claude/agents/A1-retrospecteur.md`, `A2-examinateur-agents.md`, `A3-bibliothecaire.md` |
| Contrat Leçon (gabarit) | `mesh/tuning/LECON-TEMPLATE.md` |
| Corpus public, rapports | `mesh/evals/corpus/`, `mesh/evals/reports/` |
| Jeu caché (garde-fou) | `mesh/evals/HIDDEN.md` — hors dépôt |
| Journal | `mesh/journal/AAAA-MM.jsonl` (format : [`JOURNAL.md`](JOURNAL.md)) |
| Squelette de workflow hebdo | `mesh/tuning/mesh-tuning-weekly.yml.example` |
| Vérification de structure | `scripts/mesh/check-evals.sh` |

## Brancher la boucle (hors périmètre de la Phase 5)

Le squelette `mesh/tuning/mesh-tuning-weekly.yml.example` décrit trois jobs isolés : **retro**
(A1, sans secret du jeu caché), **exam** (A2, seul à avoir le secret), **version** (A3, seulement
si `gain`). Pour l'activer, un humain le copie dans `.github/workflows/` (propriété humaine) une
fois : l'**app GitHub Claude** installée sur `BrioOrg` (prérequis bloquant du plan), le **dépôt
privé du jeu caché** créé (option A de `mesh/evals/HIDDEN.md`), et le **runner d'évals**
(`scripts/mesh/run-evals.sh`, à écrire) disponible. En attendant, la boucle se joue en
mode 1 (session Claude Code) en suivant les six étapes ci-dessus.
