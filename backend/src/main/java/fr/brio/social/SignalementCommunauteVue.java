package fr.brio.social;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Un contenu signalé dans la file de modération de la Communauté (suivi #338), agrégé par cible :
 * tous les signalements ouverts d'une même question ou réponse forment une seule entrée.
 *
 * <p>L'auteur du contenu n'est montré que par son pseudonyme (#325) : la console de v1 ne lève pas
 * le pseudonyme (protocole de détresse différé, ADR 0035).
 *
 * @param cibleType          « question » ou « reponse »
 * @param cibleId            l'identifiant de la question ou de la réponse signalée
 * @param questionId         la question qui porte le contenu (elle-même si la cible est une question)
 * @param auteurPseudonyme   le pseudonyme de l'auteur du contenu
 * @param extrait            un extrait lisible du contenu signalé
 * @param statutContenu      le statut du contenu (publie / masque / supprime)
 * @param estReponseResolue  vrai si la cible est la réponse qui a résolu la question (XP en jeu)
 * @param xpDejaRevoquee     vrai si l'XP de cette réponse a déjà été révoquée
 * @param nombreSignalements combien de membres l'ont signalé
 * @param motifs             les motifs précisés (ceux laissés vides sont omis)
 * @param premierSignalementAt l'instant du premier signalement ouvert
 */
public record SignalementCommunauteVue(
        String cibleType,
        UUID cibleId,
        UUID questionId,
        String auteurPseudonyme,
        String extrait,
        String statutContenu,
        boolean estReponseResolue,
        boolean xpDejaRevoquee,
        int nombreSignalements,
        List<String> motifs,
        Instant premierSignalementAt) {}
