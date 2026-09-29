# Passation — Gabrielle → Pierce · 2026-09-29

**Sujet : grosse journée côté produit — éditeur + F4 devoirs + mode contrôle (dont des changements dans ton back).**

## En une minute

On a beaucoup avancé aujourd'hui côté Gabrielle/Claude, **back inclus** (pour garder le
rythme pendant que tu es sur le déploiement F1). Tout est **mergé sur `develop`, CI verte**.

## ⚠️ Changements dans TON back — à relire en priorité

- **Nouveau module `devoirs`** (F4, ADR 0020) : schéma `devoirs` (migrations **V28 / V29 / V30**),
  `RenduProjection` qui **écoute `SoumissionEnregistree`** pour dériver le rendu (statut
  `non_commence → en_cours → rendu` + score), endpoints prof + élève, tableau de bord par
  compétence. Dépendances Modulith : `exercices::api` + `identite::api`.
- **`identite.api`** : ajout **additif** `InscriptionsQuery.elevesDeLaClasse(classeId)` (roster de
  classe) + `ClasseService.withHomonymeFlag` passé `public static`. **Aucune signature existante
  modifiée.**
- **`ia` (tuteur)** : garde dans `TuteurController` — refus « Tuteur indisponible pendant le
  contrôle » **avant tout appel modèle** (mode contrôle, ADR 0025). **Aucun changement de
  prompt / modèle / `AnthropicClient` → pas d'éval requise.** `ia` (module nu) dépend maintenant de
  `devoirs::api` (pas de cycle).

## Ce qui a atterri sur `develop`

| PR | Contenu |
|---|---|
| #168 | Refonte de l'éditeur de cours (front) — accueil par modèles, « + » entre blocs, Vrai/Faux, bouton IA dormant |
| #170 | ADR 0020 — devoirs et rendus |
| #171 | F4 devoirs — back + front |
| #172 | Câblage nav (onglet élève /devoirs + lien prof /prof/devoirs) |
| #174 | Mode contrôle (ADR 0025) |

Issues : #167 (éditeur), #169 (F4, fermée), #173 (mode contrôle).

## Côté front

Refonte éditeur (modèles + « + » + Vrai/Faux + hook IA dormant), les 3 écrans devoirs
(créer / tableau de bord / « mes devoirs »), et l'UI du mode contrôle (sélecteur de type +
bandeau « Contrôle en cours » + tuteur verrouillé).

## Reste à faire

- **Le déploiement** (ton chantier F1, #154 / #166) : tout est prêt à tourner, mais **rien n'est
  encore live**.
- **Annales (F7)** — réutilisent le « mode examen » (coupure tuteur + correction différée) déjà
  en place.
- **Import de copie photo (F5)** — le plus lourd (stockage objet UE, retrait EXIF, RGPD).

## Points d'attention pour toi

Tout est vert en CI (Testcontainers inclus). Merci de jeter un œil surtout à la **garde `ia`**
(ton tuteur) et au **port ajouté dans `identite`**. L'assistant IA de rédaction (aide le prof à
écrire cours + devoirs) reste **parqué** — cf. cahier des charges §8.9.

## Note produit

L'assistant IA de rédaction est le gros chantier futur essentiel (CDC §8.9). Le déploiement d'un
environnement privé (ADR 0024) est ce qui rendra tout ça visible pour de vrais tests à deux.
