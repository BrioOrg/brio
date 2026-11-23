# Carte des routes et budget de clics

> **Généré** par `node scripts/mesh/route-budget.mjs --write-doc` — ne pas éditer à la main.
> Source des tâches et budgets : [`mesh/routes/tasks.json`](../../mesh/routes/tasks.json).
> Propriétaire : U1 Cartographe des parcours. Méthode et limites : [`ROUTES-BUDGET.md`](ROUTES-BUDGET.md).

## Tâches clés

Un **clic** = un lien suivi ; une page qui ne fait que rediriger coûte 0. `Clics` est le plus court chemin trouvé dans le code ; `Budget` est le plafond que la CI fait respecter ; `Cible` est ce que U1 vise.

| Tâche | Persona | Chaude | Clics | Budget | Cible | Chemin |
|---|---|---|---:|---:|---:|---|
| Reprendre le chapitre en cours | eleve | 🔥 | 1 | 1 | 1 | `/` → `/[niveau]/[matiere]/[slug]` |
| Ouvrir un chapitre de ma matière | eleve | 🔥 | 2 | 2 | 2 | `/` → `/[niveau]/[matiere]` → `/[niveau]/[matiere]/[slug]` |
| Voir mes devoirs à faire | eleve | 🔥 | 1 | 1 | 1 | `/` → `/ma-classe` |
| Lire un cours publié par mon prof (sans devoir) | eleve | 🔥 | 2 | 2 | 2 | `/` → `/ma-classe` → `/cours/[coursId]` |
| Ouvrir le cours de mon devoir | eleve | 🔥 | 1 | 1 | 1 | `/` → `/cours/[coursId]` |
| Ouvrir le chapitre de mon devoir | eleve | 🔥 | 1 | 1 | 1 | `/` → `/[niveau]/[matiere]/[slug]` |
| Écrire dans le salon de ma classe | eleve | 🔥 | 2 | 2 | 2 | `/` → `/ma-classe` → `/ma-classe/salon` |
| Lire les questions de la Communauté | eleve |  | 1 | 1 | 1 | `/` → `/communaute` |
| Poser une question à la Communauté | eleve |  | 2 | 2 | 2 | `/` → `/communaute` → `/communaute/nouvelle` |
| S'entraîner sur une annale | eleve |  | 2 | 2 | 2 | `/` → `/explorer` → `/annales` |
| Voir mon profil | eleve |  | 1 | 1 | 1 | `/` → `/profil` |
| Ouvrir mes paramètres | eleve |  | 1 | 1 | 1 | `/` → `/parametres` |
| Rejoindre une classe avec un code | eleve |  | 2 | 2 | 2 | `/` → `/ma-classe` → `/rejoindre` |
| Créer un devoir | enseignant | 🔥 | 2 | 2 | 2 | `/prof` → `/prof/devoirs` → `/prof/devoirs/nouveau` |
| Suivre et corriger un devoir | enseignant | 🔥 | 2 | 2 | 2 | `/prof` → `/prof/devoirs` → `/prof/devoirs/[id]` |
| Voir mes classes | enseignant | 🔥 | 1 | 1 | 1 | `/prof` → `/prof/classes` |
| Traiter un signalement | enseignant |  | 1 | 1 | 1 | `/prof` → `/prof/signalements` |
| Modérer le salon de classe | enseignant |  | 1 | 1 | 1 | `/prof` → `/prof/signalements-salon` |
| Se connecter | visiteur | 🔥 | 1 | 1 | 1 | `/commencer` → `/connexion` |
| Créer un compte élève | visiteur | 🔥 | 1 | 1 | 1 | `/commencer` → `/inscription` |
| Rejoindre une classe avec un code | visiteur | 🔥 | 1 | 1 | 1 | `/commencer` → `/rejoindre` |
| Créer un compte enseignant | visiteur |  | 1 | 1 | 1 | `/commencer` → `/inscription/enseignant` |

## Profondeur de chaque route — entrée « eleve » (`/`)

| Clics | Route |
|---:|---|
| 0 | `/` |
| 1 | `/[niveau]/[matiere]` |
| 1 | `/[niveau]/[matiere]/[slug]` |
| 1 | `/communaute` |
| 1 | `/cours/[coursId]` |
| 1 | `/devoirs` |
| 1 | `/explorer` |
| 1 | `/ma-classe` |
| 1 | `/parametres` |
| 1 | `/profil` |
| 2 | `/[niveau]` |
| 2 | `/annales` |
| 2 | `/communaute/[questionId]` |
| 2 | `/communaute/nouvelle` |
| 2 | `/ma-classe/cours` |
| 2 | `/ma-classe/salon` |
| 2 | `/rejoindre` |

## Profondeur de chaque route — entrée « enseignant » (`/prof`)

| Clics | Route |
|---:|---|
| 0 | `/prof` |
| 1 | `/cours/[coursId]` |
| 1 | `/prof/classes` |
| 1 | `/prof/cours/[coursId]` |
| 1 | `/prof/devoirs` |
| 1 | `/prof/signalements` |
| 1 | `/prof/signalements-salon` |
| 2 | `/prof/classes/[id]` |
| 2 | `/prof/devoirs/[id]` |
| 2 | `/prof/devoirs/nouveau` |

## Profondeur de chaque route — entrée « visiteur » (`/commencer`)

| Clics | Route |
|---:|---|
| 0 | `/commencer` |
| 1 | `/connexion` |
| 1 | `/inscription` |
| 1 | `/inscription/enseignant` |
| 1 | `/rejoindre` |
| 2 | `/mot-de-passe-oublie` |

## Impasses connues

Routes qu'aucune entrée n'atteint par un lien : `/changer-mot-de-passe`, `/consentement/[token]`, `/consentement/revocation/[token]`, `/consentement/succes`, `/design`. Déclarées « hors navigation » dans `tasks.json` (`attendus.horsNavigation`) quand elles sont atteintes autrement (lien de courriel, page de développement).

Aucun lien mort.

