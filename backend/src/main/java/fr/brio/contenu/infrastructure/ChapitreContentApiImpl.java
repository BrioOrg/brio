package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.Block;
import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.ChapitreDocument;
import fr.brio.contenu.api.ExerciseBlock;
import fr.brio.contenu.api.Section;
import fr.brio.contenu.api.TextBlock;
import fr.brio.contenu.domain.Cours;
import fr.brio.contenu.domain.CoursVersionId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class ChapitreContentApiImpl implements ChapitreContentApi {

    private final ChapitreRepository chapitreRepository;
    private final CoursRepository coursRepository;
    private final CoursVersionRepository coursVersionRepository;
    private final ObjectMapper objectMapper;

    ChapitreContentApiImpl(
            ChapitreRepository chapitreRepository,
            CoursRepository coursRepository,
            CoursVersionRepository coursVersionRepository,
            ObjectMapper objectMapper) {
        this.chapitreRepository = chapitreRepository;
        this.coursRepository = coursRepository;
        this.coursVersionRepository = coursVersionRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<ChapitreDocument> findByTriplet(String niveau, String matiere, String slug) {
        return chapitreRepository
                .findByNiveauCodeAndMatiereCodeAndId(niveau, matiere, slug)
                .map(ch -> parseDocument(ch.getContent(), "chapter " + slug));
    }

    @Override
    public Optional<ChapitreDocument> findCoursVersionPubliee(UUID coursId) {
        return coursRepository.findById(coursId)
                .filter(c -> Cours.STATUT_PUBLIE.equals(c.getStatut()) && c.getVersionPubliee() != null)
                .flatMap(c -> coursVersionRepository.findById(new CoursVersionId(coursId, c.getVersionPubliee())))
                .map(v -> parseDocument(v.getContent(), "course version " + coursId));
    }

    private ChapitreDocument parseDocument(String content, String label) {
        try {
            return toDocument(objectMapper.readTree(content));
        } catch (Exception e) {
            throw new IllegalStateException("Stored content is not valid JSON: " + label, e);
        }
    }

    private ChapitreDocument toDocument(JsonNode doc) {
        String id = doc.path("id").asText();
        List<Section> sections = new ArrayList<>();
        for (JsonNode s : doc.path("sections")) {
            sections.add(toSection(s));
        }
        return new ChapitreDocument(id, sections);
    }

    private Section toSection(JsonNode s) {
        String id = s.path("id").asText();
        List<Block> blocks = new ArrayList<>();
        for (JsonNode b : s.path("blocks")) {
            blocks.add(toBlock(b));
        }
        return new Section(id, blocks);
    }

    private Block toBlock(JsonNode b) {
        String id = b.path("id").asText();
        String type = b.path("type").asText();

        if ("exercise".equals(type)) {
            String prompt = b.path("prompt").asText("");
            UUID exerciceId = UUID.fromString(b.path("exerciceId").asText());
            return new ExerciseBlock(id, type, prompt, exerciceId);
        }

        // prose/callout: "text"; formula: "latex"; reference/steps/objectives: "title"; image: "alt"
        String text = b.has("text") ? b.path("text").asText("")
                : b.has("latex") ? b.path("latex").asText("")
                : b.has("title") ? b.path("title").asText("")
                : b.path("alt").asText("");
        return new TextBlock(id, type, text);
    }
}
