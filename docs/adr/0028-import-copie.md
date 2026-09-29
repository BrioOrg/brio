# 0028 — Import et correction de copie (F5)

- **Status**: Accepted
- **Date**: 2026-09-29
- **Deciders**: Gabrielle Clamaran

## Context

F5 : le travail sur papier entre dans le produit. Marche v1 (feuille de route §10) :
l'élève **photographie/scanne sa copie** et la joint à son rendu ; l'enseignant la
**corrige** (note, appréciation). **Pas d'OCR ni d'IA** (marche v2). Le stockage de
fichiers de mineurs est un sujet RGPD, et il est **lié au déploiement** (le vrai
stockage objet UE dépend de l'infra — VPS OVH de Pierce), qui n'est pas encore en
place.

## Decision

### 1. Un port de stockage abstrait, une implémentation locale en dev

Le binaire des copies **ne vit pas en base** : le module dépend d'un port
`StockageCopies` (`store` / `load` / `delete`, par clé opaque). L'implémentation
livrée ici est **locale (disque)**, `StockageCopiesDisque` (répertoire
`brio.copies.dir`). Le **vrai stockage objet en UE** (bucket, URLs signées) sera une
**implémentation de déploiement** branchée par config — hors de ce lot, à caler avec
Pierce. Aucune infra prod n'est inventée ici.

### 2. Métadonnées en base, dépôt joint au rendu

```
devoirs.rendu_pieces (id, rendu_id -> devoirs.rendus, storage_key, filename,
                      content_type, taille_octets, ordre, uploaded_at)
```
+ champs de correction enseignant sur `devoirs.rendus` : `note`, `appreciation`,
`corrige_par`, `corrige_at`.

### 3. Dépôt : limites + retrait EXIF

`POST /api/devoirs/{devoirId}/rendu/pieces` (multipart) : l'élève dépose sur **son**
rendu (créé si besoin). Types acceptés **JPEG / PNG / PDF**, taille bornée (10 Mo),
nombre de pièces borné (5). Les **images sont ré-encodées via `ImageIO`** pour
**retirer l'EXIF** (une photo de copie contient la géolocalisation du domicile). Les
PDF passent tels quels en v1 (métadonnées PDF : à traiter plus tard).

### 4. Correction par l'enseignant, jamais par l'IA

`GET /api/prof/devoirs/{devoirId}/rendus/{eleveId}/pieces` et
`POST …/correction` (note + appréciation) — réservés à l'enseignant de la classe
(`EnseignantContexteQuery`). **Aucune note produite par l'IA** (marche v2, feuille de
route).

### 5. Accès restreint

`GET /api/devoirs/pieces/{pieceId}` sert les octets **uniquement** à l'élève auteur
**ou** à l'enseignant du devoir (sinon 403). Pas d'accès public.

### 6. RGPD

EXIF retiré à l'import ; accès restreint (auteur + enseignant) ; rétention à borner
(≈ 12 mois puis suppression — à appliquer au niveau du stockage prod). Le vrai
stockage en UE est un prérequis de déploiement.

## Consequences

### Positive
- Le port découple le produit de l'infra : on développe et teste maintenant, le vrai
  stockage UE se branche au déploiement **sans changer le code métier**.
- Réutilise le rendu de F4 (une copie se joint à un `rendu` existant).

### Negative / trade-offs
- L'impl disque n'est **pas** un stockage de prod (pas d'URLs signées, pas de
  réplication) — c'est explicitement du dev/test.
- Le ré-encodage `ImageIO` recompresse légèrement les JPEG (acceptable ; retire l'EXIF
  de façon fiable, sans dépendance nouvelle).

### Follow-ups
- Implémentation de stockage objet UE + config de déploiement (avec Pierce).
- Politique de rétention appliquée (suppression automatique).
- v2 : transcription/correction assistée par IA, sous validation humaine.

## Alternatives considered

- **Stocker les copies en base (bytea)** — rejeté : gonfle la base, mauvais pour de
  gros binaires, complique sauvegardes/rétention.
- **OCR / correction IA dès la v1** — rejeté : coût, fiabilité, responsabilité —
  reporté en v2 sous validation humaine (feuille de route §10).
