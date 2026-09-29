# 0025 — Mode contrôle (tuteur coupé pendant un contrôle)

- **Status**: Accepted
- **Date**: 2026-09-29
- **Deciders**: Gabrielle Clamaran

## Context

ADR 0020 a différé le type de devoir `controle`. Un contrôle est une évaluation :
le tuteur ne doit pas aider pendant sa durée, et la correction n'est visible
qu'après. F4 a déjà les pièces nécessaires (l'enum `type` est ouvert, la colonne
`correction_visible_at` existe). Le tuteur (`ia`) est un `POST /api/.../tuteur`
authentifié : on connaît donc l'élève au moment de la question.

## Decision

1. **`controle` devient un `type` de devoir autorisé** (migration ; enum
   `devoir_maison | controle`).
2. **Coupure du tuteur en bloc.** Tant qu'un élève a un contrôle ouvert (un devoir
   `controle` publié dans une de ses classes, `now ∈ [ouvre_at, echeance_at]`, rendu
   pas encore `rendu`), le tuteur **refuse entièrement** pour cet élève — le plus
   simple, conforme à l'UX « Tuteur indisponible pendant le contrôle », et sans
   correspondance fragile par exercice. Exposé par
   `devoirs.api.ControleQuery.enControleOuvert(eleveId)`, **vérifié dans le
   `TuteurController` d'`ia` AVANT tout appel modèle** → renvoie un refus standard.
   Aucun changement de prompt ni de modèle ⇒ **pas d'éval requise** (ADR 0015).
3. **`ia` gagne une dépendance Modulith sur `devoirs :: api`** (ia → devoirs ; pas
   de cycle, `devoirs` ne dépend pas d'`ia`).
4. **Correction différée** : inchangé, cachée jusqu'à `correction_visible_at`
   (= l'échéance pour un contrôle), réutilise F4.
5. **Endpoint élève** `GET /api/devoirs/controle-actif` → l'interface affiche un
   bandeau et verrouille le tuteur de façon proactive (le serveur reste l'autorité).

## Consequences

### Positive
- Réutilise tout F4 ; le même « mode examen » (coupure + correction différée)
  resservira aux annales (F7).
- Coupure **côté serveur** = infalsifiable, contrairement à un simple verrou d'UI.

### Negative / trade-offs
- La coupure en bloc désactive le tuteur sur **tout** le contenu pendant un
  contrôle (assumé : un élève en contrôle ne devrait pas utiliser le tuteur).

### Follow-ups
- Mode examen des annales (F7) réutilisant ce mécanisme.
- Coupure par périmètre (chapitre/exercice) seulement si un vrai besoin apparaît.

## Alternatives considered

- **Coupure par exercice/chapitre** — rejetée en v1 : correspondance fragile, la
  coupure en bloc est plus sûre.
- **Garde uniquement côté client** — rejetée : non-autoritative ; le serveur doit
  imposer la coupure.
