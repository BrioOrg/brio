# Le journal du mesh

Une ligne par action d'agent. C'est la matière première de l'auto-correction : le
Rétrospecteur (A1) le lit chaque semaine pour trouver les causes racines, et les
**désaccords humains** qu'il contient font monter ou descendre l'autonomie des agents.

## Où il vit

`mesh/journal/AAAA-MM.jsonl` — un fichier **JSON Lines** par mois (une entrée = une
ligne de JSON). Append-only. Jamais réécrit ; une correction est une nouvelle entrée.

## Format d'une entrée

```json
{
  "ts": "2026-11-12T21:04:00Z",
  "agent": "P1",
  "signal": "issue#412",
  "action": "route",
  "detail": "assigné à U1 (fiche besoin reçue)",
  "level": "N0",
  "tokens_read": 18400,
  "tokens_written": 320,
  "human_disagreement": false,
  "note_humaine": null
}
```

| Champ | Sens |
|---|---|
| `ts` | horodatage ISO-8601 UTC |
| `agent` | ID de l'agent (`P1`, `U1`, `V3`, …) |
| `signal` | issue / PR / cron à l'origine de l'action |
| `action` | verbe court (`route`, `spec`, `review`, `veto`, `merge`, `lesson`, …) |
| `detail` | une phrase lisible |
| `level` | niveau de gouvernance (`N0`–`N3`) |
| `tokens_read` / `tokens_written` | consommation (suivi du budget) |
| `human_disagreement` | `true` si l'humain a contredit l'agent sur cette action |
| `note_humaine` | la ligne écrite par l'humain quand il contredit (sinon `null`) |

## Règles

- **Chaque agent écrit sa propre ligne** après avoir agi (l'agent qui agit, pas un autre).
- Un `veto` et une `escalade` sont toujours journalisés.
- Le budget est suivi via `tokens_read`/`tokens_written` : pause automatique à 80 %.
- Le journal ne contient **aucune donnée nominative d'élève** (doctrine n°6, RGPD).
