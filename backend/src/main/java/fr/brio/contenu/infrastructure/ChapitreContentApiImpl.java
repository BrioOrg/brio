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
import java.util.regex.Pattern;
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
    public boolean estPublie(String niveau, String matiere, String slug) {
        return chapitreRepository.existsByNiveauCodeAndMatiereCodeAndIdAndStatut(niveau, matiere, slug, "published");
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

        if ("calcul".equals(type)) {
            return new TextBlock(id, type, calculText(b));
        }

        if ("calculatrice".equals(type)) {
            return new TextBlock(id, type, calculatriceText(b));
        }

        // prose/callout: "text"; formula: "latex"; reference/steps/objectives: "title"; image: "alt"
        String text = b.has("text") ? b.path("text").asText("")
                : b.has("latex") ? b.path("latex").asText("")
                : b.has("title") ? b.path("title").asText("")
                : b.path("alt").asText("");
        return new TextBlock(id, type, text);
    }

    /**
     * A worked calculation as the tutor reads it (ADR 0042): its title, each line with its note
     * in brackets, then its conclusion, joined by " ; ". A continuation line of a chain of
     * equalities keeps the "= " it implies, so the chain reads as written.
     */
    private static final Pattern STARTS_WITH_RELATION = Pattern.compile(
            "[=<>≈≤≥≠]|\\\\(approx|neq|ne|leqslant|leq|le|geqslant|geq|ge|lt|gt)(?![a-zA-Z])");

    static String calculText(JsonNode b) {
        List<String> parts = new ArrayList<>();
        if (b.hasNonNull("title")) {
            parts.add(b.path("title").asText());
        }
        boolean egalites = "egalites".equals(b.path("mode").asText());
        int index = 0;
        for (JsonNode line : b.path("lines")) {
            String latex = line.path("latex").asText("").strip();
            if (egalites && index > 0 && !STARTS_WITH_RELATION.matcher(latex).lookingAt()) {
                latex = "= " + latex;
            }
            String note = line.path("note").asText("");
            parts.add(note.isBlank() ? latex : latex + " (" + note + ")");
            index++;
        }
        if (b.hasNonNull("conclusion")) {
            parts.add(b.path("conclusion").asText());
        }
        return String.join(" ; ", parts);
    }

    /**
     * A course calculator as the tutor reads it (ADR 0049 §6): its instruction, then its starting
     * expressions as the author wrote them, joined by " ; ", as for a worked calculation. What the
     * student changes in it is not saved, so the tutor knows only the starting lines.
     */
    static String calculatriceText(JsonNode b) {
        List<String> parts = new ArrayList<>();
        String consigne = b.path("consigne").asText("").strip();
        if (!consigne.isEmpty()) {
            parts.add(consigne);
        }
        for (JsonNode expression : b.path("expressions")) {
            String texte = expression.asText("").strip();
            if (!texte.isEmpty()) {
                parts.add(texte);
            }
        }
        return String.join(" ; ", parts);
    }
}
