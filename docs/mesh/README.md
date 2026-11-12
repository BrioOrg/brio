# docs/mesh — le mesh d'agents de Brio

Le **mesh** est le système multi-agents qui développe Brio : chaque signal (friction,
bug, idée) traverse 8 portes de qualité, du besoin à la leçon, porté par 31 agents à
rôle unique.

## Par où commencer

- **[`PLAN-AGENT-MESH.md`](PLAN-AGENT-MESH.md)** — le plan complet (doctrine, les 31 agents,
  les 8 portes, les 10 contrats, la gouvernance, les 3 boucles, l'ordre de construction,
  les coûts). **Référence normative.**
- **[`LABELS.md`](LABELS.md)** — les labels `mesh:*` qui portent l'état d'un signal.
- **[`JOURNAL.md`](JOURNAL.md)** — le format du journal du mesh (matière de l'auto-correction).

## Ce qui existe (Phase 1 · Fondations)

- `.claude/agents/_TEMPLATE.md` — gabarit de fiche d'agent.
- `.claude/agents/P1-chef-orchestre.md`, `P3-greffier-decisions.md`, `A3-bibliothecaire.md`
  — les trois premiers agents (pilotage + mémoire).
- `.claude/skills/feature/SKILL.md` — le pilote `/feature` (squelette des 8 portes).
- `.github/CODEOWNERS` — propriété humaine de `.claude/**`, `.github/**`, évals et visuels.
- `scripts/mesh/create-labels.sh` — crée les labels `mesh:*`.
- `mesh/journal/` — accueille les fichiers mensuels du journal.

## À construire (phases suivantes)

- **`CONTRATS.md`** — les 10 formats d'échange (résumés dans le plan).
- **`PREMIER-LOT.md`** — les premiers tickets (impasses d'abord), en Phase 4.
- Les 28 fiches d'agents restantes, les workflows `mesh-*.yml`, la carte des routes et le
  budget de clics en CI, la mutation + les contrats en CI, les évals d'agents.

## Prérequis d'exécution

L'**app GitHub Claude sur l'org `BrioOrg`** est requise pour le mode « GitHub automatique »
(pousser des branches, ouvrir des issues). Le mode « Claude Code » (`/feature` en session)
fonctionne sans, dès les fondations en place.
