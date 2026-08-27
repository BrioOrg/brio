package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.Block;
import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.ChapitreDocument;
import fr.brio.contenu.api.ExerciseBlock;
import fr.brio.contenu.api.Section;
import fr.brio.contenu.api.TextBlock;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class ChapitreContentApiImpl implements ChapitreContentApi {

    private final ChapitreRepository chapitreRepository;
    private final ObjectMapper objectMapper;

    ChapitreContentApiImpl(ChapitreRepository chapitreRepository, ObjectMapper objectMapper) {
        this.chapitreRepository = chapitreRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<ChapitreDocument> findByTriplet(String niveau, String matiere, String slug) {
        return chapitreRepository
                .findByNiveauCodeAndMatiereCodeAndId(niveau, matiere, slug)
                .map(ch -> {
                    try {
                        return toDocument(objectMapper.readTree(ch.getContent()));
                    } catch (Exception e) {
                        throw new IllegalStateException(
                                "Stored chapter content is not valid JSON: " + slug, e);
                    }
                });
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

        // prose/callout: "text"; formula: "latex"; image: "alt"
        String text = b.has("text") ? b.path("text").asText("")
                : b.has("latex") ? b.path("latex").asText("")
                : b.path("alt").asText("");
        return new TextBlock(id, type, text);
    }
}
