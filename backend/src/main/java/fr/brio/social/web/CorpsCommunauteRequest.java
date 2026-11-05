package fr.brio.social.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

/** Corps d'une réponse ou d'un commentaire : un tableau de blocs de la palette (ADR 0035 §3). */
record CorpsCommunauteRequest(@NotNull JsonNode corps) {}
