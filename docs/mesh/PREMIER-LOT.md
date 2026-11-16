# Le premier lot — ce que le mesh traite en premier

Règle du plan : **les impasses passent avant tout**. Une impasse casse la confiance plus
vite qu'une fonctionnalité absente, et le produit est utilisé par des mineurs.

Ce document reprend **fidèlement** le premier lot du plan (`PLAN-AGENT-MESH.md`, pages
« budget de clics » et « premier lot »). Chaque ticket devient une issue `mesh:inbox`
(contrat **Signal**, voir [`CONTRATS.md`](CONTRATS.md)) ; **aucune issue n'est encore
ouverte** : ouvrir une issue est un geste de P1 ou de l'humain.

> **Mesurer, pas deviner.** La colonne « Constat » note ce qui a été relevé **à la lecture
> du code** (état du dépôt). U1 (carte des routes) et S3 (saboteur) **confirment ou
> infirment** chaque constat avant la fiche besoin ; un constat infirmé sort du lot. Les ID
> `PL-n` évitent la confusion avec les ID d'agents (B1, L1…) qui apparaissent dans les chaînes.

## Budget de clics des tâches clés

Mesuré dans le code actuel (depuis l'Accueil, connecté). La colonne « Cible » devient la
règle que le cartographe (U1) applique à chaque PR, une fois la carte des routes publiée.

| Tâche clé | Aujourd'hui | Cible | État | Ce qui coince |
|---|---|---|---|---|
| Reprendre le dernier chapitre | 1 | 1 | tenu | 4 clics quand le bloc « Reprendre » est absent |
| Ouvrir le devoir du jour | 2 à ∞ | 1 | **impasse** | La carte de l'Accueil mène à Ma classe, pas au devoir ; un devoir de type `cours` n'a aucun lien vers son contenu |
| Retravailler une notion « à revoir » | ≥ 4 | 1 | **impasse** | Le lien renvoie vers Explorer en général, pas vers le chapitre ou l'exercice |
| Trouver les annales | 2 | 1 | enfoui | Seulement la dernière carte d'Explorer, absent de la navigation |
| Ouvrir un cours du prof | 3 | 2 | long | Onglet supplémentaire ; le lecteur n'a ni progression, ni entraide, ni « Reprendre » |
| Revenir à la liste après une diapo | n diapos | 1 | **piège** | Chaque diapo crée une entrée d'historique ; le bouton retour remonte diapo par diapo |
| Retrouver son mot de passe | — | parcours | **lien mort** | `/mot-de-passe-oublie` n'existe pas |
| Prof : créer un devoir | 2 | 2 | tenu | Ne peut cibler qu'un cours, pas un chapitre officiel |
| Prof : corriger une copie | 2 | 2 | tenu | — |
| Prof : écrire dans le salon | ∞ | 2 | **impossible** | Le texte dit que c'est possible, aucun écran prof ne le permet |

## Les tickets du premier lot

Les impasses d'abord (PL-1 à PL-4), puis les entrées enfouies et les manques prof, enfin
la mesure d'usage. La chaîne d'agents et le critère de fin sont ceux du plan ; le constat
vient de l'exploration du dépôt (à confirmer par U1/S3).

| # | Titre | Chaîne d'agents | Critère de fin | Constat (lecture du code) |
|---|---|---|---|---|
| **PL-1** | Le devoir du jour s'ouvre en un clic depuis l'Accueil, quel que soit son type | P2 → U1 → U4 → B3 → B5 → V1, U7 → S2 | Persona élève : Accueil → contenu du devoir en **1 clic**, mobile et ordinateur | `web/app/(app)/page.tsx:107` : la carte pointe vers `/ma-classe` pour tout devoir. `web/components/devoirs-eleve.tsx:54` : un devoir `sourceType === 'cours'` n'a aucun lien ; la route `/cours/[coursId]` existe mais n'est jamais câblée |
| **PL-2** | « À revoir » mène au chapitre et à l'exercice concernés | P2 → U1 → B1 → B2, B3 → V2 → S2 | **1 clic**, la notion est visible à l'arrivée | `web/components/exercice-widget.tsx` (`LienRevoir`) : ancre `#section` dans la page courante ; si la section n'existe pas, `indexDiapo` retombe sur la diapo 0 (début de chapitre), pas sur la notion |
| **PL-3** | Le retour arrière quitte le mode interactif en un geste | U6 → B1 (ADR) → B3 → U7 → S3 | Saboteur : **3 retours consécutifs** ne piègent jamais l'utilisateur | `web/components/chapitre-interactif/mode-context.tsx` : un `pushState` par diapo (`naviguer`, ~l. 395) ; `popstate` remonte diapo par diapo → il faut N retours pour sortir d'un chapitre de N diapos |
| **PL-4** | Parcours « mot de passe oublié » complet | P2 → V5 → U1 → B2, B3 → V5 → S2 | **Lien vivant**, récupération possible **sans e-mail personnel de l'élève** | `web/components/login-form.tsx` (~l. 82-88) rend `Mot de passe oublié ?` vers `/mot-de-passe-oublie`, route **inexistante** → 404 ; aucun endpoint de reset côté `identite`. Public mineur (ADR 0018) |
| **PL-5** | Les annales entrent dans la navigation principale | U3 → U4 → U5 → B3 → V6 | **1 clic** depuis n'importe quel écran | `/annales` existe (`web/app/(app)/annales/page.tsx`) mais n'est dans aucune section de `web/lib/app-sections.ts` ; joignable seulement par la dernière carte d'Explorer |
| **PL-6** | Le lecteur de cours du prof rejoint le lecteur de chapitre | B1 → B3, B2 → V1, V6 → S2 | Progression, « Reprendre » et fil d'Ariane **identiques** aux chapitres officiels | `web/app/(app)/cours/[coursId]/page.tsx` : lecteur distinct, sans progression ni « Reprendre » |
| **PL-7** | Le prof lit et écrit dans le salon depuis son espace | U1 → B3 → V5 → S2 | **2 clics** depuis `/prof` | Aucun écran prof pour le salon (le texte dit que c'est possible) ; recoupe le suivi #338 (modération) |
| **PL-8** | Un lexique unique pour tous les libellés | U3 → U5 → B3 → V6 | « Cours du prof / Mes cours / Les cours de ta classe » réduits à **un nom par concept** | Libellés multiples pour le même concept dans l'espace classe / prof |
| **PL-9** | États chargement, vide et erreur sur toutes les routes | U4 → B3 → V6, U7 | Plus aucun « Chargement… » brut ; une `error.tsx` **globale** | États vides nus relevés : `explorer`, `[niveau]`, `[matiere]`, `cours/[coursId]`, `annales-eleve.tsx` |
| **PL-10** | Mesure d'usage anonyme | U2 → V5 → **humain N3** → B3 → L2 | Premier **classement hebdomadaire** des routes publié | Aucune mesure en place ; décision N3 préalable (base légale, ADR 0018), outil auto-hébergé sans cookies |

## Ordre d'exécution

1. **Impasses d'abord** : PL-1 à PL-4. Le premier ticket joué dans la chaîne est **PL-4
   (« mot de passe oublié »)**, choisi par l'humain — lien mort + public mineur.
2. Puis les entrées enfouies / manques : PL-5, PL-6, PL-7, PL-8, PL-9.
3. **PL-10** en dernier dans ce lot : il ouvre par une **décision N3** (mesure d'usage).

Chaque ticket livré laisse une ligne dans le journal (`JOURNAL.md`) et, s'il a coincé, une
**Leçon** (contrat 10). Un constat infirmé par U1/S3 sort du lot sans fiche besoin.
