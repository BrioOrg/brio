package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.domain.Chapitre;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Everything that must hold before a teacher's draft can be frozen into an immutable
 * version (ADR 0019 §4). Each failure throws {@link InvalidContentException} — a broken
 * link blocks publication exactly as an unknown competency code does. Order matters: the
 * schema check runs first so later checks can assume a well-formed document.
 */
@Component
class PublicationValidator {

    private final ContentSchemaValidator schemaValidator;
    private final ContentReferentialValidator referentialValidator;
    private final ChapitreRepository chapitreRepository;
    private final ObjectMapper objectMapper;

    PublicationValidator(
            ContentSchemaValidator schemaValidator,
            ContentReferentialValidator referentialValidator,
            ChapitreRepository chapitreRepository,
            ObjectMapper objectMapper) {
        this.schemaValidator = schemaValidator;
        this.referentialValidator = referentialValidator;
        this.chapitreRepository = chapitreRepository;
        this.objectMapper = objectMapper;
    }

    void validate(JsonNode content) {
        schemaValidator.validate(content);
        referentialValidator.assertCompetenciesExist(content);
        for (JsonNode section : content.path("sections")) {
            for (JsonNode block : section.path("blocks")) {
                String type = block.path("type").asText();
                if ("reference".equals(type) && "internal".equals(block.path("scope").asText())) {
                    assertInternalReferenceResolves(block);
                } else if ("image".equals(type) || "figure".equals(type)) {
                    assertAltPresent(block);
                }
            }
        }
    }

    /**
     * An internal reference must point at a <em>published</em> catalogue chapter, and its
     * optional anchor at a real section of that chapter. Teacher→teacher references are not
     * expressible (the target schema has no course field) and would break immutability, so
     * only the catalogue is resolved here.
     */
    private void assertInternalReferenceResolves(JsonNode block) {
        JsonNode target = block.path("target");
        String level = target.path("level").asText();
        String subject = target.path("subject").asText();
        String slug = target.path("slug").asText();

        Optional<Chapitre> chapitre = chapitreRepository
                .findByNiveauCodeAndMatiereCodeAndIdAndStatut(level, subject, slug, "published");
        if (chapitre.isEmpty()) {
            throw new InvalidContentException(
                    "Broken internal reference '" + block.path("id").asText()
                    + "': no published chapter " + level + "/" + subject + "/" + slug);
        }

        String anchor = target.path("anchor").asText(null);
        if (anchor != null && !sectionIds(chapitre.get()).contains(anchor)) {
            throw new InvalidContentException(
                    "Broken internal reference '" + block.path("id").asText()
                    + "': anchor '" + anchor + "' is not a section of " + level + "/" + subject + "/" + slug);
        }
    }

    private void assertAltPresent(JsonNode block) {
        if (block.path("alt").asText("").isBlank()) {
            throw new InvalidContentException(
                    "Missing alt text on " + block.path("type").asText()
                    + " block '" + block.path("id").asText() + "'");
        }
    }

    private Set<String> sectionIds(Chapitre chapitre) {
        Set<String> ids = new HashSet<>();
        try {
            JsonNode content = objectMapper.readTree(chapitre.getContent());
            for (JsonNode section : content.path("sections")) {
                ids.add(section.path("id").asText());
            }
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Stored chapter content is not valid JSON: " + chapitre.getId(), e);
        }
        return ids;
    }
}
