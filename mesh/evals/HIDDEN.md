# Le jeu de cas caché — garde-fou

> Garde-fou non négociable du plan : *« L'examinateur garde un jeu de cas caché que le
> rétrospecteur ne voit jamais. »* Sans lui, le rétrospecteur règle ses propositions sur
> les cas que l'examinateur utilise pour les noter : un gain apparent, aucun gain réel
> (loi de Goodhart). Ce document dit comment la séparation est **tenue**, pas seulement
> promise.

## Principe

1. **Il n'est pas dans le dépôt.** Tout ce qui est dans le dépôt est lisible par tous les
   agents, A1 compris. Le jeu caché vit dans un stockage séparé ; le dépôt ne garde
   que des **empreintes** (`empreintes.json`).
2. **Un seul lecteur machine : A2**, dans un job dédié. Les jobs d'A1 et d'A3 n'ont ni le
   secret, ni le montage.
3. **Propriétaire humain** : `/mesh/evals/**` est couvert par CODEOWNERS ; les cas se
   créent, changent et se retirent par décision humaine.
4. **Les sorties sont des agrégats** : A2 ne diffuse jamais le contenu, l'identifiant ni
   le détail par cas d'un cas caché.

## Où il vit (décision N3 à prendre)

| Option | Stockage | Accès |
|---|---|---|
| **A · dépôt privé (recommandé)** | `BrioOrg/brio-mesh-evals-hidden`, privé, hors visibilité des apps/agents | jeton en lecture seule, secret `MESH_EVALS_HIDDEN_TOKEN` exposé **au seul job A2** |
| B · archive chiffrée | `hidden.tar.age` dans un stockage privé (hors du dépôt) | clé `age` en secret du seul job A2 |

Dans les deux cas le contenu est monté à l'exécution dans un dossier **hors de
l'espace de travail**, désigné par `MESH_EVALS_HIDDEN_DIR`, supprimé en fin de job.
Il n'est jamais écrit dans un artefact CI, un cache, un log, un commentaire de PR
ni dans `mesh/journal/`.

> À trancher par un humain (ADR « Proposed » → « Accepted ») : option retenue, propriétaire
> du dépôt privé. Tant que ce n'est pas fait, **le jeu caché est vide** : A2 rend
> `non mesurable` et aucune montée d'autonomie n'est possible. Le système ne ment pas
> sur ce qu'il ne sait pas mesurer.

## Quatre barrières

| Barrière | Ce qu'elle empêche | Où elle est tenue |
|---|---|---|
| **Séparation des accès** | A1 lit le jeu | jobs distincts ; secret limité à A2 ; A1 n'a pas la variable `MESH_EVALS_HIDDEN_DIR` |
| **Refus d'accès d'outil** | un agent ouvre `hidden/` par erreur | règle de permissions Claude Code à placer dans `.claude/settings.json` (propriété humaine) : `deny` de lecture sur `mesh/evals/hidden/**` et `$MESH_EVALS_HIDDEN_DIR` pour A1 et A3 ; voir ci-dessous |
| **Ceinture git** | une copie accidentelle commitée | `mesh/evals/.gitignore` + `scripts/mesh/check-evals.sh` (échoue si suivi) |
| **Détection de fuite** | une fuite par une règle, une fiche, un cas public | **canari** : A2 cherche dans le dépôt et dans chaque diff `mesh-tuning` les marqueurs `mesh-canary-<uuid>` du jeu caché |

Extrait de règle de refus à intégrer par l'humain :

```json
{ "permissions": { "deny": ["Read(mesh/evals/hidden/**)", "Read(//**/mesh-evals-hidden/**)"] } }
```

## Format d'un cas caché

Même format que le corpus public (`README.md`), plus deux champs :

```yaml
canary: mesh-canary-0f3c1b9e-6a4d-4c2e-9d70-5b1e2a8c4f11   # unique, ne figure nulle part ailleurs
sel: 9c41e07a                                              # aléa : empreinte non devinable
```

`empreintes.json` consigne pour chaque cas **uniquement** `{agent, sha256}` (empreinte
du fichier, sel compris), pour détecter une altération. Ni identifiant, ni canari, ni contenu.

## Cycle de vie

- **Création** : l'humain, ou A2 sur proposition validée par l'humain. Un défaut échappé donne
  un cas **public** (par A3) et, au besoin, un **jumeau caché** (même défaut, autre
  formulation) pour mesurer qu'on a compris la cause et pas appris l'exemple.
- **Taille minimale** : au moins **5 cas cachés** par agent mesuré, familles variées. En
  dessous, verdict `non mesurable`.
- **Usure** : un cas caché ayant pesé sur **3 décisions** de tuning est retiré et publié dans
  le corpus public (`origin: hidden-retired`) ; l'humain en écrit un neuf. Un agent qui a
  vu l'agrégat plusieurs fois peut s'y adapter.
- **Fuite** : canari retrouvé hors du jeu → cas retiré immédiatement, ligne `escalade`
  au journal (sans contenu), examen des dernières décisions fondées sur lui, humain prévenu.
- **Accès** : revue trimestrielle des détenteurs du secret ; rotation du jeton à chaque départ.

## Ce que A1 a le droit de savoir

Seulement : « leçon L12 : `gain` / `neutre` / `régression` / `non mesurable` » et l'écart de score
agrégé pour l'agent ciblé. Il n'apprend **jamais** quels cas ont échoué. Il peut donc répondre à
« ma correction a-t-elle marché ? » mais pas « comment passer le test ».

## Auto-contrôle de A2

Personne ne note A2 sur le jeu caché. Son propre corpus public est passé par P1 et
revu par un humain ; ses verdicts sont journalisés (comptes) et ses désaccords avec
l'humain mesurés comme pour les autres agents.
