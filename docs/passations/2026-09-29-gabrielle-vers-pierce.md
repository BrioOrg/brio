# Passation — Gabrielle → Pierce · 2026-09-29

**Sujet : très grosse journée produit — F4 devoirs + éditeur + mode contrôle + annales (F7) + mode examen + F5 import de copie. Beaucoup de changements dans ton back.**

## En une minute

On a pris **F4 en entier (back inclus)** puis enchaîné plusieurs suites, pendant que tu
es sur le déploiement. **Tout est mergé sur `develop`, CI verte** (Modulith, contrat
OpenAPI, Testcontainers, tests web, anti-dérive design). La « plateforme de classe » est
quasi entièrement construite ; **il reste surtout le déploiement + le contenu réel**.

## ⚠️ Changements dans TON back — à relire en priorité

- **Nouveau module `devoirs`** (F4, ADR 0020) : schéma `devoirs` (migrations **V28→V33**),
  `RenduProjection` **écoute `SoumissionEnregistree`** pour dériver le rendu, endpoints
  prof + élève, tableau de bord par compétence. Deps Modulith : `exercices::api` +
  `identite::api`.
- **`identite.api`** : ajout **additif** `InscriptionsQuery.elevesDeLaClasse(classeId)` +
  `ClasseService.withHomonymeFlag` passé `public static`. Aucune signature existante
  modifiée.
- **`ia` (tuteur)** : garde dans `TuteurController` — coupe le tuteur si l'élève est en
  **contrôle OU en examen** (mode contrôle ADR 0025 + mode examen ADR 0027), **avant tout
  appel modèle**. **Aucun changement de prompt / modèle / `AnthropicClient` → pas d'éval
  requise.** `ia` (module nu) dépend maintenant de `devoirs::api` et `contenu::api`.
- **`contenu`** : **annales** (ADR 0026, table `contenu.annales`, `AnnaleIngestor` qui
  réutilise l'ingestion chapitre **sans toucher** `ChapitreIngestor`/`ExerciceExtractor`/le
  CHECK exercices ; exclusion du catalogue ; endpoints `/api/annales` + entraînement par
  compétence) et **mode examen** (ADR 0027, table `contenu.examen_sessions`, `ExamenQuery`,
  endpoints démarrer/rendre/examen-actif).

## Ce qui a atterri sur `develop`

| PR | Contenu |
|---|---|
| #168 | Refonte de l'éditeur de cours (front) — modèles, « + » entre blocs, Vrai/Faux, hook IA dormant |
| #170 / #171 / #172 | ADR 0020 · F4 devoirs (back + front) · câblage nav |
| #174 | Mode contrôle (ADR 0025) |
| #176 | Annales F7 — outillage (ADR 0026) |
| #179 | Mode examen des annales (ADR 0027) |
| #180 | F5 — import et correction de copie (ADR 0028) |

## Points d'attention pour toi

- **Garde `ia`** (contrôle + examen) et **port `identite`** : à relire.
- **F5 — stockage** : construit contre un **port `StockageCopies`** avec une **impl locale
  (disque) pour le dev**. ⚠️ **Le vrai stockage objet UE + la rétention (~12 mois) sont à
  brancher par toi au déploiement** (une impl du port + config). L'EXIF est retiré, l'accès
  est restreint (élève auteur + prof du devoir).
- Migrations à jour jusqu'à **V33**. Tout boote sous profil `validate` (schéma ↔ entités
  vérifiés).

## Reste à faire

- **Le déploiement réel** sur le VPS OVH (ton chantier F1, #154 / #166) — **rien n'est
  encore live** ; c'est ce qui rendra tout ça visible pour de vrais tests à deux.
- **Le stockage prod de F5** (bucket UE + rétention).
- **Rédiger le contenu réel** (chapitres, sujets d'annales) — manuel, avec soin juridique
  (réécrire les énoncés, jamais copier un corrigé, citer la session).
- **F6** (entraide / messagerie) — pas commencé.
- **Assistant IA de rédaction** (aide le prof à écrire cours + devoirs) — **parqué**, cf.
  cahier des charges §8.9.

Tout est vert en CI (Testcontainers inclus). Merci pour le back côté déploiement — c'est
la dernière marche pour que la plateforme existe pour de vrai.
