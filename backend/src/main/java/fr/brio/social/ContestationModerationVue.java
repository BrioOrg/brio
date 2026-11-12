package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/**
 * Une contestation en attente dans la console de modération (suivi #338). L'auteur d'un contenu
 * masqué ou supprimé conteste la décision ; un admin tranche avec intervention humaine.
 *
 * @param id                l'identifiant de la contestation
 * @param cibleType         « question » ou « reponse »
 * @param cibleId           l'identifiant du contenu contesté
 * @param questionId        la question qui porte le contenu
 * @param auteurPseudonyme  le pseudonyme de l'auteur qui conteste
 * @param extrait           un extrait du contenu (vide s'il a été supprimé)
 * @param message           le message de la contestation
 * @param decisionAction    l'action contestée (masquer / supprimer)
 * @param decisionMotif     le motif de la décision contestée
 * @param statutContenu     le statut courant du contenu
 * @param createdAt         l'instant de la contestation
 */
public record ContestationModerationVue(
        UUID id,
        String cibleType,
        UUID cibleId,
        UUID questionId,
        String auteurPseudonyme,
        String extrait,
        String message,
        String decisionAction,
        String decisionMotif,
        String statutContenu,
        Instant createdAt) {}
