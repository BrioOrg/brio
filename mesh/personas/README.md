# `mesh/personas/` — les utilisateurs simulés

Un fichier YAML par persona, **versionné** : c'est la définition de l'utilisateur que S2
(Joueurs de personas) joue chaque nuit sur staging et que S1 (Scénariste) fait grandir.
Un persona est un *proxy* de l'usage réel tant que la mesure (U2) n'a pas de trafic
(doctrine n°3) : on le recale sur le réel dès qu'on a observé quelqu'un.

| Fichier | Persona | Statut |
|---|---|---|
| [`01-eleve-reel.yaml`](01-eleve-reel.yaml) | L'élève réel : 5e, mobile, parcourt plus qu'il ne lit | hypothèse, à calibrer |

## Règles

1. **Aucune donnée nominative.** Un persona est fictif, même quand il s'inspire d'une personne
   réelle : pas de nom, de prénom, d'établissement, d'adresse. Pseudonyme de la forme
   `Eleve-5e-A` (ADR 0018, minimisation des données d'élève).
2. **`statut: hypothese` tant que rien n'est observé.** Passer à `observe` demande une
   observation réelle, consignée dans le journal du mesh ; c'est l'humain qui le décide (N3).
3. **Un persona se modifie par PR**, jamais à la volée par un agent en cours de nuit. S1 les
   propose, A1 les recale à partir des incidents, l'humain les merge.
4. **Le persona ne triche pas.** Il joue ce qu'il voit (arbre d'accessibilité), avec ses
   limites : c'est S3 (Saboteur) qui joue le tordu, pas lui.
5. **Chaque tâche d'un persona est une tâche de `mesh/routes/tasks.json`** (`objectifs[].tache`).
   Un persona qui vise une tâche absente du budget de clics est une anomalie : S1 ouvre un
   signal pour que U1 l'ajoute.

## Format

| Champ | Sens |
|---|---|
| `id` | = nom du fichier sans extension ; repris dans `persona` de chaque run de nuit |
| `version`, `statut` | version du fichier ; `hypothese` ou `observe` |
| `role` | clé de `personas` dans `tasks.json` (`eleve`, `enseignant`, `visiteur`) : fixe l'entrée et l'espace |
| `profil`, `aisance_numerique` | qui est-il, sur quel appareil, avec quelle connexion |
| `objectifs[]` | ce qu'il vient faire : `tache` (id de `tasks.json`) + `frequence` |
| `patience` | seuils d'abandon : c'est ce qui transforme une gêne en échec mesurable |
| `comportement[]` | habitudes qui provoquent les frictions (ce qu'il ne devine pas, ce qu'il fait par réflexe) |
| `contraintes_accessibilite` | ce que ce persona porte ; l'audit complet reste à U7 |
| `regles_de_jeu[]` | ce que S2 s'interdit pour rester un élève et non un testeur |
| `a_calibrer_par_l_humain[]` | les questions ouvertes à fermer par l'observation |

Les résultats d'un persona sont écrits au format de `mesh/nuit/run.schema.json` et assemblés
dans le rapport de nuit (`docs/mesh/RAPPORT-DE-NUIT.md`).

## Ajouter un persona

1. S1 propose le fichier en PR (`mesh:simulation`), copié de `01-eleve-reel.yaml`.
2. Chaque `objectifs[].tache` existe dans `mesh/routes/tasks.json`.
3. L'humain relit : aucune donnée nominative, seuils plausibles, `statut` honnête.
