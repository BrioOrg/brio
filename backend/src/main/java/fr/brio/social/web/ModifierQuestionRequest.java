package fr.brio.social.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Nouveau titre et nouveau corps d'une question. */
record ModifierQuestionRequest(@NotBlank String titre, @NotNull JsonNode corps) {}
