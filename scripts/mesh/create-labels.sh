#!/usr/bin/env bash
# Crée (ou met à jour) les labels mesh:* sur le dépôt.
# Idempotent : relançable sans risque (gh label create --force).
# Usage : scripts/mesh/create-labels.sh [owner/repo]
#   owner/repo par défaut : le dépôt du répertoire courant (gh le déduit).
set -euo pipefail

REPO_ARG=()
if [[ "${1:-}" != "" ]]; then
  REPO_ARG=(--repo "$1")
fi

# label | couleur (hex sans #) | description
labels=(
  "mesh:inbox|B60205|Signal reçu, pas encore trié"
  "mesh:besoin|0E8A16|Porte 1 — fiche besoin (P2)"
  "mesh:parcours-ui|1D76DB|Porte 2 — parcours + UI (pôle UX)"
  "mesh:plan-technique|5319E7|Porte 3 — plan technique (B1)"
  "mesh:construction|FBCA04|Porte 4 — code / contenu / tests"
  "mesh:verification|D93F0B|Porte 5 — gardiens"
  "mesh:simulation|C2E0C6|Porte 6 — personas sur la branche"
  "mesh:livraison|0052CC|Porte 7 — résumé humain + merge + staging"
  "mesh:apprentissage|BFD4F2|Porte 8 — leçon à versionner"
  "mesh:nuit|0B1F3A|File de nuit : avance jusqu'à la PR, jamais le merge"
  "mesh:escalade|E11D21|Boucle cassée au 3e tour, décision humaine requise"
  "mesh:budget|F9D0C4|Budget d'agent au-delà de 80 %"
  "mesh:tuning|5319E7|PR d'amélioration du mesh (A1 → A2 → A3)"
  "mesh:bloque|000000|En attente d'une décision N3 humaine"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color desc <<< "$entry"
  echo "· $name"
  gh label create "$name" --color "$color" --description "$desc" --force "${REPO_ARG[@]}"
done

echo "OK — ${#labels[@]} labels mesh:* en place."
