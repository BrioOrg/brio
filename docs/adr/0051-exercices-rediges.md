# 0051 — Exercices rédigés d’une leçon

- **Status**: Proposed — les choix produit ci-dessous sont consignés. Le plan technique et les modalités
  de traitement des copies seront précisés dans les lots concernés.
- **Date**: 2026-11-26
- **Deciders**: Discussion produit du 26 novembre 2026
- **Suivi**: [#469](https://github.com/BrioOrg/brio/issues/469)

## Contexte

Les leçons de Brio et les cours d’enseignant utilisent des blocs d’exercice courts, dont le QCM,
la réponse numérique et la réponse courte. Ces blocs sont adaptés à une vérification rapide au fil
de la lecture. Une réponse rédigée a d’autres besoins. Elle peut contenir un raisonnement, de la
notation spécialisée ou une copie sur papier. L’élève doit pouvoir retrouver exactement ce qu’il a
remis et le comparer à une référence de correction.

Brio dispose déjà d’un éditeur de cours, d’un clavier mathématique, d’évaluateurs déterministes et
d’un mécanisme de dépôt privé pour les devoirs. Ces briques peuvent être réutilisées. Leurs parcours
existants restent en service. Voir [ADR 0019](0019-editeur-par-blocs.md),
[ADR 0012](0012-short-answer-deterministic-normalisation.md) et
[ADR 0028](0028-import-copie.md).

## Décision

### 1. Un exercice rédigé appartient à une leçon

La leçon garde ses activités rapides dans le fil de lecture. Elle donne aussi un accès distinct à
ses exercices rédigés. Chacun a un énoncé complet et un espace de réponse, de remise et de retour
sur la copie. Le catalogue Brio comme les leçons publiées par les enseignants peuvent accueillir
ces exercices. La revue par un enseignant est réservée aux leçons que les enseignants publient
pour leurs classes.

L’enseignant dispose d’un constructeur d’exercices dédié à côté de l’éditeur de leçon. Il choisit
la leçon de rattachement, rédige l’énoncé, configure la saisie et la correction, puis prévisualise
le parcours élève avant publication. Les QCM et les autres activités rapides restent des blocs dans
l’éditeur de leçon. Le constructeur est un outil d’écriture et de publication. La génération
d’énoncés par IA relève d’un autre chantier.

Les devoirs et les annales sont hors périmètre. Un futur devoir pourra référencer un exercice
appartenant à une leçon. Le rattachement à la leçon et l’identité de l’exercice doivent donc
permettre cette réutilisation sans recopier l’énoncé. Ce lot ne change ni les sources, ni les
échéances, ni le suivi des devoirs existants.

### 2. Un mode de correction par exercice

Le mode s’applique à toute la copie. Il n’y a pas de combinaison de modes par question dans un
même exercice. Avant de répondre, l’élève voit le même parcours d’exercice quel que soit le mode.
L’interface lui montre les consignes, les contrôles de saisie disponibles et les informations
d’échéance s’il y en a.

| Mode choisi par l’auteur | Cas d’usage | Référence exigée avant publication |
| --- | --- | --- |
| Automatique déterministe | Valeur, expression mathématique ou étapes dont la validité se vérifie par des règles explicites. Aucun appel IA. | Domaine et règle de réponse, formes acceptées et solution expliquée. |
| Revue par l’enseignant | Rédaction, dissertation, analyse ou démonstration libre nécessitant un jugement pédagogique. | Solution expliquée pour un problème fermé ou grille avec critères et exemples pour une réponse ouverte. Une copie modèle peut compléter la grille. |
| Retour IA borné | Traduction guidée, liste d’éléments attendus ou raisonnement avec des critères objectivement vérifiables. Activation explicite par l’auteur. | Corrigé de référence et clé de correction détaillant les critères, variantes et minimum attendu. |

Pour une dérivée de polynôme, `2(x + 1)` et `2x + 2` peuvent désigner la même réponse.
L’équivalence se vérifie côté serveur dans une famille d’expressions et un domaine définis. Tester
des valeurs sur quelques points ne suffit pas à établir l’équivalence. Distinguer une expression
fausse d’une expression illisible ou hors du domaine pris en charge. Le premier lot doit prouver
le parcours avec un exemple étroit avant d’étendre les familles d’expressions.

Une démonstration guidée peut être déterministe lorsque les étapes admises et leurs dépendances
sont vérifiables. Une démonstration libre peut emprunter plusieurs chemins valides et exige de
vérifier les justifications. Elle relève de l’enseignant lorsque la qualité de l’argumentation
demande un jugement. Un retour IA est envisageable uniquement sur des critères fermés explicités
par l’auteur, dans les limites de la section 6.

### 3. Saisie et remise dans Brio

Le format de saisie suit les besoins de l’exercice. En maths, la saisie accepte le clavier et
des touches qui insèrent au curseur des gabarits modifiables comme des fractions, des racines,
des puissances ou des intégrales. Pour une réponse structurée, l’auteur peut proposer des
fragments sélectionnables si cela sert l’objectif pédagogique. Les contrôles restent utilisables
au clavier, sur mobile et avec un lecteur d’écran. Insérer une notation ne garantit pas qu’elle
fasse partie du domaine du correcteur automatique de cet exercice.

La copie est remise dans l’app. Pour un exercice revu par l’enseignant, l’auteur peut autoriser
une photo, seule ou en complément d’une réponse saisie. Chaque dépôt reste attaché à sa copie
et à la version de l’exercice. Le serveur refuse les pièces pour les autres modes. Aucune
lecture automatique, aucun OCR et aucun envoi de photo à un modèle ne sont prévus. Garder la
possibilité d’étudier d’autres usages des photos plus tard.

Le premier lot avec photo reprend les contrôles d’[ADR 0028](0028-import-copie.md), dont la
validation du fichier, le retrait des métadonnées d’image et l’accès privé. Il accepte une
image JPEG ou PNG par remise, de 5 Mo au plus, avec des dimensions bornées avant décodage.
Les octets nettoyés sont stockés dans une table séparée. La photo et la remise sont confirmées
dans la même transaction sans dépendre du stockage des devoirs. Les règles de rétention des
nouvelles copies doivent être précisées pour l’exploitation.

Le retour et la photo sont consultables par l’élève auteur. Pour la revue, l’auteur de
l’exercice doit encore enseigner à l’élève dans l’une des classes auxquelles la leçon est
publiée. La dissociation des modules et les références par identifiant suivent
[l’ADR 0007](0007-one-database-schema-per-module.md).

### 4. Quand le corrigé devient visible

Une remise valide ouvre immédiatement l’accès à la référence commune, même si la réponse est
fausse ou si le retour personnel de l’enseignant reste à faire. La remise conserve la version de
l’énoncé et du corrigé correspondants. Ouvrir un exercice ou sauvegarder un brouillon ne compte pas
comme une remise. Les autorisations et les heures d’ouverture du corrigé sont contrôlées par le
serveur. Les réponses de lecture et les ressources mises en cache respectent la même règle.

| Situation | Corrigé commun | Copie et retour personnel |
| --- | --- | --- |
| Catalogue Brio, sans remise | Masqué. Les exercices du catalogue n’ont jamais d’échéance. | Aucune copie remise. |
| Exercice d’enseignant sans échéance, sans remise | Masqué. Le mode entraînement sans échéance est autorisé. | Aucune copie remise. |
| Exercice d’enseignant daté, sans remise, avant l’échéance effective | Masqué. | Aucune copie remise. |
| Exercice d’enseignant daté, sans remise, à partir de l’échéance effective | Visible. | Afficher que l’élève n’a pas remis de copie. |
| Remise valide, avec ou sans échéance | Visible immédiatement. | La copie est visible. Le retour personnel s’affiche dès qu’il est disponible et, pour une revue humaine, publié. |

Un enseignant peut clôturer un exercice daté plus tôt pour le public qu’il gère. L’instant de
clôture devient alors l’échéance effective. L’action doit annoncer que les élèves concernés qui
n’ont pas remis pourront voir la solution après la clôture. Ce mécanisme est propre aux nouveaux
exercices de leçon. Il ne change pas [l’ADR 0020](0020-devoirs.md) sur les devoirs.

### 5. Comparer « Ta réponse » et « Corrigé »

La comparaison porte sur la copie effectivement remise et la référence de correction de la
même version. Elle doit rendre un écart pédagogique compréhensible. L’affichage fonctionne côte
à côte si la place le permet, ou dans un ordre explicite sur petit écran. La couleur n’est
jamais le seul indicateur d’un écart. Les libellés et l’ordre de lecture restent accessibles.

- **Formule**. Montrer les deux écritures. Une écriture équivalente est correcte. Si un écart est
  établi, indiquer le résultat ou l’étape attendue sans inventer le raisonnement de l’élève.
- **Texte à réponse fermée**. Comparer les éléments attendus et les éléments repérés. Une phrase
  différente mot pour mot peut exprimer la même réponse. Les différences de caractères ne
  déterminent pas la réussite.
- **Rédaction ouverte**. Afficher la copie à côté de la grille et, si elle existe, de la copie
  modèle. Les commentaires personnels apparaissent quand l’enseignant les publie. La copie
  modèle illustre une réponse possible.
- **Photo**. Afficher la copie originale en regard de la solution ou de la grille. Il n’y a pas de
  comparaison automatique du contenu de l’image.
- **Corrigé ouvert sans remise**. Afficher la référence seule et indiquer l’absence de copie.

Le lot ne prévoit pas d’historique visuel ni de comparaison entre tentatives.

### 6. Concept de retour IA à clé de correction

L’activation est explicite et désactivée par défaut. L’auteur choisit le mode et rédige une clé
de correction avant publication. Le modèle n’a pas à décider si un exercice autorise un retour.
La clé décrit les éléments attendus, leur nombre minimum, les
variantes ou paraphrases admises et les contresens pertinents. Une question de traduction peut
fixer un sens et un temps à préserver. Une question d’économie peut demander deux conditions de
la concurrence pure et parfaite et énumérer les conditions acceptables.

Pour cet exemple, « les entreprises peuvent entrer et sortir librement » et « les produits sont
identiques » correspondent à deux critères de la clé. Le retour identifie les éléments confirmés
et cite les passages de la copie qui les attestent. Il distingue les critères présents, absents
et incertains. En cas d’ambiguïté, il indique le point à préciser. Il ne commente ni le style,
ni la valeur d’une opinion, ni la qualité d’une dissertation. Il ne donne pas de note
institutionnelle. Si la clé exige un jugement subjectif, choisir la revue par l’enseignant.

Pour maîtriser les coûts, préparer une clé compacte par version d’exercice. Une remise éligible
déclenche normalement un seul appel borné avec la copie, l’énoncé et la clé, assortis de l’extrait
précis de la leçon si l’auteur l’a choisi. La recherche dans tout le catalogue et l’historique
des élèves restent hors du premier lot IA. Ne pas inclure de pièce jointe ou de données
d’identification. Conserver le résultat de la remise pour éviter un nouvel appel à chaque
consultation.

Les critères de sortie sont structurés et validés. La copie sert de donnée à examiner et ne peut
pas modifier la clé ou les instructions. Une sortie invalide ou une indisponibilité produit un
état explicite. Le corrigé commun reste accessible selon la règle de la section 4. Avant
activation, mesurer coût, latence et qualité sur un corpus couvrant les variantes justes, les
erreurs, les cas partiels et ambigus et les consignes glissées dans une copie. Instruire et faire
valider le traitement des copies d’élèves selon [l’ADR 0018](0018-base-legale-traitement-eleves.md)
et les règles du projet. Le tuteur de chapitre garde son propre rôle
([ADR 0015](0015-chapter-tutor-v1.md)).

### 7. Pilote du retour par critères (#473)

Le constructeur propose deux formats fermés pour le pilote, une traduction avec une contrainte
explicite ou une liste d’éléments attendus. L’auteur fournit le corrigé commun, de un à six
critères distincts, le minimum attendu et jusqu’à quatre variantes par critère. Il confirme
que les critères sont vérifiables. Il peut copier un court extrait de la leçon s’il est
nécessaire. Une dissertation reste en revue enseignant. Pour essayer le parcours avec des
données fictives, demander « Nomme deux conditions de la concurrence pure et parfaite » et
utiliser comme critères la libre entrée et sortie et l’homogénéité des produits. Une copie
partielle peut dire « Les entreprises peuvent entrer et sortir librement. »

La remise valide est confirmée avant de lancer le retour. La file locale accepte trois
traitements simultanés et six en attente. Le premier enregistrement de la copie déclenche
au plus un appel. Un rechargement consulte le résultat enregistré. Si la file est saturée,
si le processus s’arrête ou si la réponse du modèle est invalide, la copie et le corrigé
restent accessibles et le retour devient indisponible. L’attente expire après 60 secondes.
Le lot ne relance pas automatiquement un appel vers le prestataire.

Le correcteur envoie l’énoncé (1 500 caractères), la copie (1 200 caractères), la clé et
l’extrait facultatif (500 caractères). Il limite les sorties à 768 tokens et le délai de
lecture à 12 secondes. Il contrôle que chaque critère a exactement un état et que tout
extrait cité figure mot pour mot dans la copie. Il ne transmet aucun identifiant de compte,
historique ou média. Un filtre bloque les adresses électroniques et numéros de téléphone
français détectables. Une saisie libre peut néanmoins contenir d’autres données personnelles.

`BRIO_EXERCICES_RETOUR_IA_ACTIF` vaut `false` par défaut. Pour le pilote, effectuer d’abord
l’évaluation sur copies synthétiques avec `./mvnw test -Peval -Dtest=RetourExerciceLiveEvalTest`
depuis `backend/`, avec la clé habituelle. Le corpus répète cinq cas et consigne les tokens
d’entrée et de sortie, le temps et les états. La procédure produit les résultats de test
dans `backend/target/surefire-reports/`. Vérifier ensuite les coûts sur des entrées proches
des limites, puis consigner l’autorisation du traitement des copies, le prestataire,
les durées de rétention et le budget accepté dans #473 avant d’activer. L’évaluation
fictive et le test avec fournisseur simulé ne valident pas le traitement des copies réelles.

## Conséquences et ordre de livraison

La première version doit démontrer les deux parcours, automatique et revue par l’enseignant,
avec un exercice réel de chaque type. Les enseignants disposent d’une surface pour écrire les
énoncés et les références de correction. La séparation demande une conception du lecteur et des
permissions propres à la copie. Elle permet de réutiliser ultérieurement une référence d’exercice
dans les devoirs.

| Ordre | Priorité | Lot | Dépendance |
| --- | --- | --- | --- |
| 1 | P1 | [#470 — Socle de leçon et premier exercice automatique](https://github.com/BrioOrg/brio/issues/470) | Poser le contrat de publication, de remise et de visibilité. |
| 2 | P1 | [#471 — Revue enseignant et photo](https://github.com/BrioOrg/brio/issues/471) | Réutiliser le socle et livrer le second parcours complet. |
| 3 | P1 | [#472 — Comparaison copie et corrigé](https://github.com/BrioOrg/brio/issues/472) | Démarrer la conception dès le contrat du lot 1. Vérifier l’intégration des deux parcours des lots 1 et 2. |
| 4 | P2 | [#473 — Retour IA à critères vérifiables](https://github.com/BrioOrg/brio/issues/473) | Après les parcours de remise et de comparaison. Activation conditionnée par les évaluations et la validation du traitement. |

Les migrations, contrats d’API et choix de stockage seront définis dans ces lots. La première
livraison ne dépend pas de l’IA.

## Alternatives étudiées

- Étendre les blocs courts à tous les usages mêlerait la lecture, l’écriture d’une copie et
  le suivi du retour dans la même surface.
- Démarrer par des devoirs imposerait un parcours d’affectation alors que l’accès depuis une leçon
  est le besoin immédiat.
- Une correction hybride par question ajouterait des états de remise et de retour dont le premier
  périmètre n’a pas besoin.
- Une comparaison textuelle brute traiterait des variantes valides comme des erreurs.
- Un modèle libre de juger une copie ouverte sortirait du périmètre vérifiable et rendrait le
  coût, la stabilité et la qualité du retour plus difficiles à maîtriser.
