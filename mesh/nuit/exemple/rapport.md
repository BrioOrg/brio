# Rapport de nuit — 2026-11-13

**Verdict : 🔴 rouge**

| Commit | Environnement | Runs | Personas | Sabotages | Score de friction | Veille |
|---|---|---:|---:|---:|---:|---:|
| `0000000` | staging | 6 | 1 | 2 | 2.83 | n/a |

## Tâches clés

| Tâche | Runs | Réussite | Clics (méd.) | Budget | Hors budget | Sabotages cassés | Score |
|---|---:|---:|---:|---:|---:|---:|---:|
| `eleve-annales` | 1 | 0 % | — | 2 | 0 | 0 | 13 |
| `eleve-poser-question` | 2 | 100 % | 3 | 2 | 1 | 0 | 2 |
| `eleve-devoirs-a-faire` | 2 | 100 % | 1 | 1 | 0 | 0 | 0 |
| `eleve-reprendre-chapitre` | 1 | 100 % | 1 | 1 | 0 | 0 | 0 |

**Tâches non jouées cette nuit** : `eleve-cours-du-prof`, `eleve-lire-communaute`, `eleve-ouvrir-chapitre`, `eleve-parametres`, `eleve-profil`, `eleve-rejoindre-classe`, `eleve-salon-de-classe`, `prof-creer-devoir`, `prof-mes-classes`, `prof-signalements`, `prof-signalements-salon`, `prof-suivre-devoir`, `visiteur-creer-compte-eleve`, `visiteur-creer-compte-enseignant`, `visiteur-rejoindre-classe`, `visiteur-se-connecter`

## Frictions

| | Type | Route | Tâche | Détail | Vues | Personas |
|---|---|---|---|---|---:|---|
|  | impasse | `/` | `eleve-annales` | [exemple] Le persona renonce : il ne devine pas que les annales sont sous « Explorer ». | 1 | 01-eleve-reel |
|  | ambigu | `/communaute/nouvelle` | `eleve-poser-question` | [exemple] Le persona ne reconnaît pas « Publier » comme l'envoi de sa question. | 1 | 01-eleve-reel |

## Tickets à ouvrir (S4 → `mesh:inbox`)

### impasse · `/` · `eleve-annales`

[exemple] Le persona renonce : il ne devine pas que les annales sont sous « Explorer ».

Reproduction (run `ex-04`, persona `01-eleve-reel`, commit `0000000`, staging) :

1. clic — barre de navigation (`/`)
2. recherche — entrée « Annales » (`/`) → [exemple] le persona ne trouve pas l'entrée et renonce

---

_Simulation sur staging remis à zéro, personas fictifs : aucune donnée d'élève réel. Barème : `docs/mesh/RAPPORT-DE-NUIT.md`._
