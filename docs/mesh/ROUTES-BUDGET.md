# Carte des routes et budget de clics

> Mesh · Phase 2 · agent **U1 Cartographe des parcours** (⛔ veto : allongement d'une route chaude).
> Doctrine n°2 : *les routes chaudes sont sacrées*. Une PR qui allonge une tâche clé est
> bloquée automatiquement.

La carte publiée est [`CARTE-ROUTES.md`](CARTE-ROUTES.md) (générée). Le contrat est
[`mesh/routes/tasks.json`](../../mesh/routes/tasks.json). Le moteur est `scripts/mesh/`.

## Ce que la CI vérifie

Le workflow `.github/workflows/mesh-ux.yml` (job `click-budget`) échoue si, sur la PR :

| Violation | Exemple |
|---|---|
| une tâche dépasse son **budget** | « Voir mes devoirs » passe de 1 à 2 clics parce que l'onglet disparaît |
| une tâche devient une **impasse** | la page « Annales » n'est plus liée depuis Explorer |
| une **route orpheline** apparaît | une nouvelle page qu'aucun lien n'atteint (hors `attendus.horsNavigation`) |
| un **lien mort** apparaît | un `href` vers une page qui n'existe pas (hors `attendus.liensMorts`) |
| un budget **chaud est relevé**, ou une tâche chaude retirée / dé-chauffée | comparé à `tasks.json` de la branche de base |

Le dernier point est la parade au contournement : relever un budget pour faire passer la CI
reste visible, et la CI le refuse. Seule une décision **U1 + humain** (N3, ADR) autorise de
changer cette règle, par une PR dédiée.

## Comment la profondeur est calculée

`scripts/mesh/lib/route-graph.mjs` — analyse statique, sans build ni navigateur :

1. **Routes** : chaque `web/app/**/page.tsx` ; les groupes `(app)` sont transparents, `[x]` est dynamique.
2. **Liens** : tout chemin de route écrit comme chaîne (`href`, `router.push`, `{ href: '/…' }`,
   gabarits `` `/${niveau}/${matiere}` ``) dans la page, dans ses `layout.tsx` (donc la barre de
   navigation compte pour toutes les pages dessous) et dans tous les composants qu'ils importent.
   Un gabarit désigne la route la plus spécifique (`/${n}/${m}` → `/[niveau]/[matiere]`).
3. **Coût** : un lien = **1 clic**. Une page qui ne fait que `redirect()` (comme `/devoirs`) = 0.
   Un `redirect()` conditionnel (garde de rôle) n'est jamais compté.
4. **Plus court chemin** par recherche 0-1, par **persona** : l'élève n'emprunte pas les liens
   enseignant (`exclut`), l'enseignant reste dans `/prof` et `/cours` (`autorise`), le visiteur
   dans les pages publiques. Une tâche peut imposer des étapes (`via`).

### Limites assumées (c'est une borne basse optimiste)

- Un lien conditionnel (affiché seulement si l'élève a déjà une progression, une classe…) est
  compté. La profondeur ne bouge donc que si le **code** des liens change : c'est voulu pour un
  cliquet. La mesure réelle viendra de U2 ; en attendant, S2 (personas) valide en vrai.
- Un lien construit depuis une variable (`href={href}`) ou fourni par le backend n'est pas vu.
  L'angle mort est connu : un contournement doit passer par un `href` littéral pour compter.
- Le temps et la clarté d'un clic ne sont pas mesurés ici (U6, U5, S2).
- Une page atteinte **seulement par une redirection conditionnelle** (garde d'état ou de rôle,
  comme `/changer-mot-de-passe` après une connexion avec un mot de passe provisoire) n'a aucun
  lien entrant : elle sort en route orpheline. La déclarer dans `attendus.horsNavigation` dans
  le même commit que la page, et lancer `route-budget` en local avant le push (rétro PL-4).

## Le contrat `tasks.json`

```jsonc
{
  "personas": { "eleve": { "entree": "/", "exclut": ["/prof", …] }, … },
  "attendus": { "horsNavigation": ["/design", …], "liensMorts": [] },
  "taches": [{
    "id": "eleve-devoirs-a-faire",   // stable : cité par les personas et les rapports de nuit
    "label": "Voir mes devoirs à faire",
    "persona": "eleve",
    "chaude": true,                   // route chaude : budget irrévocable
    "via": ["/ma-classe"],            // étapes obligatoires (facultatif)
    "arrivee": "/ma-classe",
    "budget": 1,                      // plafond que la CI fait respecter
    "cible": 1                        // ce que U1 vise (≤ budget)
  }]
}
```

- **Budget** = la profondeur actuelle pour une route chaude (cliquet : elle ne s'allonge pas).
  **Cible** = ce que U1 veut atteindre. Quand `cible < budget`, U1 ouvre un signal ; quand la
  profondeur tombe sous le budget, la CI le dit (« budget resserrable ») : on le resserre.
- `attendus` est une **dette déclarée** : chaque entrée est une impasse connue, à résorber.
  Un lien mort réparé doit être retiré de la liste (la CI le rappelle).
- Ajouter une tâche = ajouter une ligne ; la lister comme chaude, c'est s'engager à la tenir.

## Utilisation

```bash
node scripts/mesh/route-budget.mjs                         # verdict, exit 1 si violation
node scripts/mesh/route-budget.mjs --base origin/develop   # + interdit de relever un budget chaud
node scripts/mesh/route-budget.mjs --explain eleve-annales # le chemin derrière une profondeur
node scripts/mesh/route-budget.mjs --write-doc             # régénère CARTE-ROUTES.md
node --test 'scripts/mesh/__tests__/*.test.mjs'            # tests du moteur
```

Une PR qui change des liens régénère `CARTE-ROUTES.md` ; la CI signale (sans échouer) une carte périmée.

## Qui fait quoi

| Agent | Rôle ici |
|---|---|
| U1 | possède `tasks.json` ; lit le verdict à chaque PR ; pose son veto si une route chaude s'allonge |
| U2 | classe les routes par fréquentation réelle → décide ce qui devient `chaude` |
| U3 | propose les raccourcis qui font baisser les profondeurs |
| S1/S2 | rejouent les tâches en vrai : la carte statique est la borne basse, eux la confirment |
