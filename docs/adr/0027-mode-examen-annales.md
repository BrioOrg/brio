# 0027 — Mode examen des annales

- **Status**: Accepted
- **Date**: 2026-09-29
- **Deciders**: Gabrielle Clamaran

## Context

ADR 0026 a livré les annales comme contenu et a **différé le mode examen**. Un élève
doit pouvoir faire un sujet d'annale **comme un vrai examen** : chronométré, tuteur
coupé pendant la durée, correction visible seulement après. C'est le même besoin que
le mode contrôle des devoirs (ADR 0025), mais **initié par l'élève** (pas assigné par
un prof) et porté par une **annale** (un chapitre spécialisé), pas un devoir.

## Decision

### 1. Session d'examen (initiée par l'élève)

Quand l'élève démarre un examen sur une annale, on crée une **session** :

```
contenu.examen_sessions (
  id                UUID PK,
  eleve_id          UUID NOT NULL,             -- identite.comptes
  annale_chapitre_id VARCHAR(128) NOT NULL,    -- contenu.annales(chapitre_id)
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at           TIMESTAMPTZ NOT NULL,      -- started_at + annales.duree_minutes
  statut            VARCHAR(15) NOT NULL DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours','termine')),
  termine_at        TIMESTAMPTZ
)
```

`ends_at` vient de `annales.duree_minutes`. La session est **ouverte** tant que
`statut = 'en_cours'` et `now < ends_at`.

### 2. Coupure du tuteur — on généralise la garde d'ADR 0025

Le tuteur (`ia/web/TuteurController`) vérifie déjà `devoirs.api.ControleQuery`. On
ajoute un port `contenu.api.ExamenQuery.enExamenOuvert(eleveId)` et la garde coupe le
tuteur si **contrôle ouvert OU examen ouvert**. Refus standard, avant tout appel
modèle (aucun changement de prompt/modèle → pas d'éval, ADR 0015). `ia` dépend déjà de
`contenu::api`.

### 3. Correction différée

Les résultats/corrigé d'un sujet passé en examen ne sont visibles qu'**après la fin de
la session** (`statut = 'termine'` ou `now ≥ ends_at`).

### 4. Endpoints

- `POST /api/annales/{id}/examen` — démarre une session (renvoie `ends_at`).
- `POST /api/annales/examen/{sessionId}/rendre` — termine la session.
- `GET /api/annales/examen-actif` — la session en cours de l'élève (pour l'UI : chrono
  + verrou tuteur), miroir de `/api/devoirs/controle-actif`.

## Consequences

### Positive
- Réutilise le mécanisme du mode contrôle (coupure serveur + correction différée) et
  la table `annales` d'ADR 0026.
- Coupure **côté serveur** = infalsifiable.

### Negative / trade-offs
- La garde du tuteur vérifie maintenant deux sources (contrôle + examen) — deux petites
  requêtes avant chaque question, acceptable.

### Follow-ups
- Auto-clôture des sessions expirées (batch ou à la lecture).

## Alternatives considered

- **Réutiliser `devoirs` pour l'examen d'annale** — rejeté : un examen d'annale n'est
  pas un devoir assigné par un prof ; il vit dans `contenu` avec l'annale.
- **Garde tuteur côté client seulement** — rejeté : non-autoritative (cf. ADR 0025).
