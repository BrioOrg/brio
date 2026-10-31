package fr.brio.social;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Une réponse à une question, avec ses commentaires. */
public record ReponseCommunauteVue(
        UUID id,
        JsonNode corps,
        AuteurCommunaute auteur,
        long nombreUtile,
        boolean aVote,
        boolean estAuteur,
        boolean aResolu,
        boolean modifie,
        Instant createdAt,
        List<CommentaireCommunauteVue> commentaires) {}
