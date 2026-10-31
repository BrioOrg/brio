package fr.brio.social;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

/** Un commentaire sous une réponse : pas de vote ni de résolution (ADR 0035 §5). */
public record CommentaireCommunauteVue(
        UUID id,
        JsonNode corps,
        AuteurCommunaute auteur,
        boolean estAuteur,
        boolean modifie,
        Instant createdAt) {}
