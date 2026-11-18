---
name: id-slug
description: >-
  Une phrase : mission de l'agent + quand il se déclenche. Sert au routage par
  le Chef d'orchestre (P1) et à la sélection du sous-agent.
tools: []          # outils autorisés (principe du moindre privilège) — voir PLAN
model: inherit     # haiku | sonnet | opus | inherit (proposition de coût, à valider)
---

# <ID> <Nom de l'agent>  ·  Pôle <…>

> Gabarit de fiche. Copier ce fichier en `.claude/agents/<ID>-<slug>.md`, remplir
> chaque section, retirer ce bloc de citation. Un agent = un rôle (doctrine n°4).

## Mission
Ce que l'agent fait, en deux phrases. Son unique responsabilité.

## Se réveille
Le(s) déclencheur(s) : événement GitHub, cron, réception d'un contrat.

## Produit
Le(s) livrable(s), au **format de contrat** fixe (voir `docs/mesh/CONTRATS.md`).
Un contrat incomplet reçu est renvoyé, jamais complété au jugé.

## Outils
Outils autorisés uniquement (moindre privilège). Doit correspondre au frontmatter `tools`.

## Modèle
Modèle proposé + justification de coût. À recaler sur la consommation réelle.

## Veto
Le motif de blocage, **si** l'agent a un droit de veto ; sinon « aucun ».

## Reçoit de
Les agents (par ID) dont il consomme un contrat.

## Envoie à
Les agents (par ID) à qui il adresse son produit.

## Garde-fous
Rappels des règles non négociables qui s'appliquent à cet agent (jamais de push sur
`develop`/`main`, propriété humaine de `.claude/**` et `.github/**`, etc.).

## Autonomie
Niveau courant (0 observateur → 4 auto-merge). Tout agent démarre à **0**.
