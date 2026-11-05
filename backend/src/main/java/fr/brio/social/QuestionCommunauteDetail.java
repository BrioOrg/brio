package fr.brio.social;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Un fil complet : la question, ses réponses et leurs commentaires. */
public record QuestionCommunauteDetail(
        UUID id,
        String titre,
        JsonNode corps,
        AuteurCommunaute auteur,
        String niveau,
        String matiere,
        boolean resolue,
        long nombreUtile,
        boolean aVote,
        boolean estAuteur,
        boolean modifie,
        Instant createdAt,
        List<ReponseCommunauteVue> reponses) {}
