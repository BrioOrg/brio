# 0035 — Communauté v1 : questions et réponses entre élèves

- **Status**: Accepted
- **Date**: 2026-10-31
- **Deciders**: Pierce Broudin

## Context

La navigation en cinq espaces (#328) prévoit une section Communauté, aujourd'hui
désactivée (#320). L'issue #327 demandait de la cadrer avant d'écrire du code.

L'entraide existante (ADR 0023) est limitée à la classe : un fil s'attache à un
chapitre ou un exercice, ses messages sont du texte brut, et le prof modère. La
Communauté dépasse la classe. Les élèves y apparaissent sous le pseudonyme attribué
par Brio (#325), et il faut pouvoir y écrire des maths et du code.

L'application est en développement et n'a pas de vrais élèves. L'ADR 0023 pose qu'aucun
canal entre mineurs ne s'ouvre sans file de signalements ni modérateur, tout en jugeant
ce manque acceptable en environnement privé s'il est comblé avant l'arrivée de vrais
élèves. Tout merge dans `develop` est déployé automatiquement (ADR 0024 §10), et seul le
mot de passe Caddy protège cet environnement.

## Decision

Nous construisons un espace de questions et réponses asynchrone à la manière de Reddit,
sans modération pendant le développement, derrière un réglage serveur désactivé par
défaut.

1. **Format.** Une question a un titre et un corps mis en forme. D'autres élèves y
   répondent, avec la même mise en forme. Pas de messages privés. REST sans WebSocket,
   comme le reste de `social`.

2. **Corps stocké en blocs de cours.** Le corps est un tableau JSON de blocs du schéma
   existant (ADR 0004, ADR 0019), restreint à une palette réduite et rendu par le même
   moteur que les cours. L'éditeur est neuf et léger : l'élève tape son texte et ajoute
   une formule ou du code depuis la barre d'outils. Le serveur rejette tout type de bloc
   hors palette.

3. **Mise en forme v1.**
   - Déjà rendue dans les cours : gras, italique, maths en ligne, formule, bloc de code,
     programme Scratch.
   - À ajouter : la liste à puces (nouveau bloc, additif au sens de l'ADR 0019) et le
     surlignage (nouveau marquage dans le parseur partagé `rich-text`).
   - Le surlignage a un seul style, issu des tokens. Pas de choix de couleur, conformément
     à l'ADR 0019. S'il manque un token sémantique, il passe par sa propre PR.
   - Exclus : coloration syntaxique du code, tableaux, figures, images, liens cliquables,
     citations, code en ligne.

4. **Fil à deux niveaux.** Des réponses à la question, et un seul niveau de commentaires
   sous chaque réponse. Une référence au parent dans le schéma permettrait d'aller plus
   loin plus tard.

5. **Vote positif unique, « Utile ».** Un vote par élève, sur les questions et les
   réponses, pas sur les commentaires ni sur ses propres messages. Pas de vote négatif :
   aucun score négatif sur ce qu'écrit un enfant.

6. **Résolution avec XP.** L'auteur marque la réponse qui a résolu sa question. Le fil
   apparaît comme résolu et le répondeur reçoit 15 XP via `ReponseUtileValidee`, sans
   changer `progression`. Comme dans l'entraide, on ne retient pas sa propre réponse. Le
   plafond de 3 par jour et l'idempotence par réponse (ADR 0022) restent ceux de
   l'entraide, et le plafond est partagé avec elle.

7. **Visibilité.** Tous les niveaux sont visibles, avec un filtre par défaut sur le niveau
   de l'élève. Le catalogue va aujourd'hui de la 6e à la 3e, en mathématiques seulement.
   L'arrivée du lycée imposera de revoir ce point.

8. **Participants.** Tout compte élève, avec ou sans classe. Le niveau affiché est celui
   de `CompteInfo` : la classe active, sinon le niveau déclaré à l'inscription. Pas
   d'enseignants en v1. L'élève apparaît sous la forme « Renard-Turquoise · 3e », et le nom
   affiché de classe n'apparaît jamais dans cet espace (#325).

9. **Contrôle et examen.** La Communauté reste accessible pendant un contrôle ou un examen.
   C'est un choix assumé : le tuteur y est coupé (ADR 0025, ADR 0027), la Communauté non.

10. **Pas de modération en développement, mais un verrou.** Le réglage serveur
    `brio.communaute.active` est désactivé par défaut et commande à la fois l'API et
    l'onglet de navigation. Il est activé en local et dans l'environnement privé. Il n'y a
    donc ni signalement, ni classifieur, ni filtre préventif en v1. Il ne s'active pour
    de vrais élèves qu'une fois traitée la liste ci-dessous.

11. **Modèle.** De nouvelles tables dans le schéma `social`, car `social.fils` exige un
    `classe_id` et `social.messages` stocke du texte brut. Une colonne `statut` sur les
    questions et les réponses permettra d'ajouter la modération sans migration de rupture.
    Les auteurs peuvent modifier et supprimer leurs messages, et un message modifié porte
    la mention « modifié ».

### Conditions avant d'ouvrir à de vrais élèves

- Classifieur IA avant publication et son jeu d'éval. Il n'existe pas de vrais messages
  d'élèves dont tirer des cas.
- Qui traite l'escalade, et sous quel délai, y compris le soir.
- Protocole de détresse, rédigé avec un établissement (ADR 0023).
- Filtres préventifs : liens, pseudos de réseaux sociaux, numéros de téléphone, limite de
  débit.
- Console de modération Brio, avec signalement, décisions, contestation et révocation de
  l'XP de « réponse utile ». Elle n'existe pas : `admin_brio` ne peut que régénérer un
  pseudonyme.
- Rôle juridique entre établissements et AIPD. Sur le parcours A de l'ADR 0018,
  l'établissement est responsable de traitement, ce qui ne couvre peut-être pas un espace
  géré par Brio entre établissements. Ce point et les comptes sans classe sont à valider
  avec un DPO ou un juriste.
- Obligations DSA, CGU et pages légales. `web/app` n'en contient aucune.
- Purge de rétention à 12 mois. L'ADR 0023 §6 la décrit, mais `social` n'en contient pas
  le code.

## Consequences

### Positive
- Aucun format de contenu ni aucune bibliothèque en plus : maths, code et Scratch
  réutilisent le moteur de rendu, le parseur partagé et les composants `ChampFormule` et
  `ClavierMaths`.
- Le parseur restant partagé, le mobile pourra réutiliser le même format.
- Le réglage empêche qu'une levée du mot de passe Caddy ouvre aussi un forum non modéré à
  des mineurs.

### Negative / trade-offs
- L'éditeur est du travail neuf : `bloc-editeur.tsx` est conçu pour les enseignants et ne
  se réutilise pas tel quel.
- `BlockRenderer` doit sortir de `chapter-view.tsx`, et KaTeX doit recevoir des limites
  explicites : les commentaires du code supposent une entrée relue, ce qui n'est plus vrai
  ici.
- Une question peut être posée en plein contrôle, ce qui contourne la coupure du tuteur.
- Deux élèves peuvent s'échanger de l'XP dans la limite du plafond, et personne ne peut la
  révoquer tant que la console n'existe pas.
- Des élèves de 11 et 15 ans partagent le même espace.

### Follow-ups
- Issues back et front découlant de cet ADR.
- Une issue de suivi pour les conditions d'ouverture ci-dessus.
- Notifications, recherche et session d'aide en direct : hors v1.

## Alternatives considered

- **Markdown avec barre d'outils** — rejeté : ajoute une bibliothèque et un second parseur
  à côté de celui des cours, et un élève de 6e verrait des astérisques et des dollars.
- **Éditeur riche complet (TipTap)** — rejeté : la plus grosse dépendance, un troisième
  format de contenu, des nœuds maths à construire et un chemin plus difficile vers Expo.
- **Réutiliser `social.fils` et `social.messages`** — rejeté : un fil appartient à une
  classe et ses messages sont du texte brut. Des tables séparées suivent le précédent de
  l'ADR 0033.
- **Ouvrir par établissement, modéré par les profs** — rejeté : soit le prof voit le nom
  derrière le pseudonyme, ce qui rompt #325, soit il ne voit que le pseudonyme et ne peut
  pas agir en cas de détresse.
- **Classifieur et signalements dès la v1** — différés : sans vrais élèves, ils n'ont ni
  cas réels ni personne à protéger, et restent une condition d'ouverture.
- **Votes positifs et négatifs, imbrication sans limite** — rejetés : un score négatif sur
  la tentative d'un enfant, et des fils difficiles à suivre sur téléphone.
- **Se fier au mot de passe Caddy** — rejeté : le lever pour un pilote ouvrirait aussi le
  forum, sans rien pour le signaler.
