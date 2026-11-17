package fr.brio.contenu;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.LeconCompetence;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves a competency code to the lesson section that teaches it, computed on the fly from the
 * published content (ADR 0037). Nothing is stored: the answer is a pure function of the catalogue.
 */
@Service
public class LeconCompetenceService {

    private final ExerciceRepository exerciceRepository;
    private final ObjectMapper objectMapper;

    LeconCompetenceService(ExerciceRepository exerciceRepository, ObjectMapper objectMapper) {
        this.exerciceRepository = exerciceRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * The first lesson section (document order) carrying an exercise tagged with the competency,
     * in the first chapter that has one. Chapters of {@code niveau} come first, the rest keep
     * catalogue order. Empty when no published lesson section carries the code.
     */
    @Transactional(readOnly = true)
    public Optional<LeconCompetence> trouver(String competence, String niveau) {
        List<Chapitre> candidats = exerciceRepository.findPublishedChapitresByCompetence(competence);
        // Stable sorts: the repository already orders by niveau, matière and chapter order.
        List<Chapitre> ordonnes = niveau == null
                ? candidats
                : java.util.stream.Stream.concat(
                                candidats.stream().filter(c -> niveau.equals(c.getNiveauCode())),
                                candidats.stream().filter(c -> !niveau.equals(c.getNiveauCode())))
                        .toList();
        for (Chapitre chapitre : ordonnes) {
            Optional<LeconCompetence> lecon = premiereSection(chapitre, competence);
            if (lecon.isPresent()) {
                return lecon;
            }
        }
        return Optional.empty();
    }

    private Optional<LeconCompetence> premiereSection(Chapitre chapitre, String competence) {
        JsonNode sections;
        try {
            sections = objectMapper.readTree(chapitre.getContent()).path("sections");
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
        for (JsonNode section : sections) {
            if (!"lesson".equals(section.path("kind").asText()) || !porteLaCompetence(section, competence)) {
                continue;
            }
            return Optional.of(new LeconCompetence(
                    chapitre.getNiveauCode(),
                    chapitre.getMatiereCode(),
                    chapitre.getId(),
                    section.path("id").asText(),
                    section.path("title").asText()));
        }
        return Optional.empty();
    }

    private static boolean porteLaCompetence(JsonNode section, String competence) {
        for (JsonNode block : section.path("blocks")) {
            if (!"exercise".equals(block.path("type").asText())) {
                continue;
            }
            for (JsonNode code : block.path("competencies")) {
                if (competence.equals(code.asText())) {
                    return true;
                }
            }
        }
        return false;
    }
}
