#!/usr/bin/env bash
# Vérifie la structure des évals d'agents (mesh/evals/) :
#   1. aucun fichier du jeu caché suivi par git ;
#   2. aucun canari (mesh-canary-…) dans les fichiers suivis ;
#   3. chaque cas du corpus public a les champs requis, un id = nom de fichier,
#      un agent = nom de dossier, et ne porte pas de champ canary/sel.
# Usage : scripts/mesh/check-evals.sh   (depuis n'importe où dans le dépôt)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
fail=0
err() { echo "ERREUR: $*" >&2; fail=1; }

# 1 · jeu caché non suivi
tracked_hidden="$(git ls-files 'mesh/evals/hidden' 'mesh/evals/hidden-*/*' 'mesh/evals/*.hidden.y*ml' || true)"
if [ -n "$tracked_hidden" ]; then
  err "fichiers du jeu caché suivis par git (interdit, voir mesh/evals/HIDDEN.md) :"
  echo "$tracked_hidden" >&2
fi

# 2 · aucun canari dans le dépôt (hors ce script et la doc qui en décrit le format)
leaks="$(git grep -l 'mesh-canary-[0-9a-f]\{8\}-' -- . \
  ':!mesh/evals/HIDDEN.md' ':!scripts/mesh/check-evals.sh' || true)"
if [ -n "$leaks" ]; then
  err "canari du jeu caché retrouvé dans le dépôt (fuite) :"
  echo "$leaks" >&2
fi

# 3 · corpus public
required="id agent family severity origin description input expected grading"
families="nominal limite adversarial regression"
count=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  count=$((count + 1))
  base="$(basename "$f" .yaml)"
  dir="$(basename "$(dirname "$f")")"
  for k in $required; do
    grep -q "^${k}:" "$f" || err "$f : champ manquant « $k »"
  done
  grep -q "^id: ${base}\$" "$f" || err "$f : « id » doit valoir « $base » (nom du fichier)"
  grep -q "^agent: ${dir}\$" "$f" || err "$f : « agent » doit valoir « $dir » (nom du dossier)"
  fam="$(sed -n 's/^family: *\([a-z]*\).*/\1/p' "$f" | head -1)"
  case " $families " in *" $fam "*) ;; *) err "$f : famille « $fam » inconnue ($families)";; esac
  if grep -q '^canary:\|^sel:' "$f"; then
    err "$f : champs canary/sel réservés au jeu caché"
  fi
done < <(git ls-files --cached --others --exclude-standard 'mesh/evals/corpus/*/*.yaml')

if [ "$fail" -ne 0 ]; then
  echo "check-evals : échec" >&2
  exit 1
fi
echo "check-evals : OK ($count cas publics)"
