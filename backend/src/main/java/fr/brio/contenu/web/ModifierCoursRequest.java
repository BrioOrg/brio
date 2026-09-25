package fr.brio.contenu.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Overwrite a draft's title and content (the "Enregistrer" action). Content validated only at publication. */
record ModifierCoursRequest(@NotBlank @Size(max = 300) String titre, JsonNode content) {
}
