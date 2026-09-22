package fr.brio.contenu.api;

import com.fasterxml.jackson.databind.JsonNode;

/** Overwrite an existing draft's title and content (the "Enregistrer" action, ADR 0019). */
public record ModifierBrouillonCommand(String titre, JsonNode content) {
}
