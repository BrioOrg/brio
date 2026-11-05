package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Une question dans la liste de la Communauté. */
public record QuestionCommunauteResume(
        UUID id,
        String titre,
        AuteurCommunaute auteur,
        String niveau,
        String matiere,
        boolean resolue,
        long nombreReponses,
        long nombreUtile,
        boolean aVote,
        boolean estAuteur,
        boolean modifie,
        Instant createdAt) {}
