# Labels du mesh

Les labels `mesh:*` portent l'état d'un signal le long des 8 portes, plus quelques
labels de pilotage. Ils sont créés / mis à jour par `scripts/mesh/create-labels.sh`.

## Étapes de la chaîne (une seule à la fois sur une issue)

| Label | Porte | Sens |
|---|---|---|
| `mesh:inbox` | Signal | signal reçu, pas encore trié |
| `mesh:besoin` | 1 | fiche besoin en cours (P2) |
| `mesh:parcours-ui` | 2 | spec de parcours + UI (pôle UX) |
| `mesh:plan-technique` | 3 | plan technique (B1) |
| `mesh:construction` | 4 | code / contenu / tests en cours |
| `mesh:verification` | 5 | gardiens en cours |
| `mesh:simulation` | 6 | personas sur la branche |
| `mesh:livraison` | 7 | résumé humain + merge + staging |
| `mesh:apprentissage` | 8 | leçon à versionner |

## Pilotage

| Label | Sens |
|---|---|
| `mesh:nuit` | file de nuit : avance jusqu'à la PR, jamais jusqu'au merge |
| `mesh:escalade` | boucle cassée au 3ᵉ tour, décision humaine requise |
| `mesh:budget` | budget d'agent au-delà de 80 % |
| `mesh:tuning` | PR d'amélioration du mesh lui-même (A1 → A2 → A3) |
| `mesh:bloque` | en attente d'une décision N3 humaine |
