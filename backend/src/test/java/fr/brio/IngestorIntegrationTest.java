package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.contenu.infrastructure.ChapterResult;
import fr.brio.contenu.infrastructure.IngestReport;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Rebuild-from-scratch guarantee (ADR 0010): blank DB → Flyway → ingestAll → assertions.
 * Two consecutive runs must produce identical state.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class IngestorIntegrationTest {

    // Run from backend/, so ../content resolves to the repo content directory.
    private static final Path CONTENT_DIR = Path.of("../content");

    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired ContenuService contenuService;
    @Autowired ObjectMapper objectMapper;

    @Test
    void shouldIngestAllContentWithoutFailures() {
        IngestReport report = chapitreIngestor.ingestAll(CONTENT_DIR);

        assertThat(report.hasFailures()).as("No chapter should fail").isFalse();
        assertThat(report.results()).isNotEmpty();
        // Each result is CREATED or SKIPPED — never FAILED or UPDATED on a valid run.
        assertThat(report.results()).allMatch(r ->
                r.status() == ChapterResult.Status.CREATED || r.status() == ChapterResult.Status.SKIPPED);
    }

    @Test
    void shouldSkipAllChaptersOnDuplicateRun() {
        chapitreIngestor.ingestAll(CONTENT_DIR);
        IngestReport secondRun = chapitreIngestor.ingestAll(CONTENT_DIR);

        assertThat(secondRun.hasFailures()).isFalse();
        assertThat(secondRun.countByStatus(ChapterResult.Status.SKIPPED))
                .as("All chapters should be SKIPPED on an identical second run")
                .isEqualTo(secondRun.results().size());
    }

    @Test
    void shouldUpdateChapterAndPreserveExerciseUuidsWhenContentChanges() throws Exception {
        IngestReport firstRun = chapitreIngestor.ingestAll(CONTENT_DIR);
        assertThat(firstRun.hasFailures()).isFalse();

        // Collect exercise exerciceIds from the stored chapter content after the first run.
        JsonNode afterFirstRun = contenuService.findChapitre("theoreme-de-pythagore")
                .orElseThrow(() -> new AssertionError("Chapter not found after first ingest"));
        List<String> uuidsBefore = exerciceIds(afterFirstRun);
        assertThat(uuidsBefore).as("First run must produce exercise UUIDs").isNotEmpty();

        // Mutate the title so the content_hash changes (simulates the image→figure conversion).
        JsonNode original;
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            original = objectMapper.readTree(is);
        }
        ObjectNode modified = original.deepCopy();
        modified.put("title", "Titre modifié pour le test");

        ChapterResult update = chapitreIngestor.ingestDocument(modified, "3e", "mathematiques", 0);
        assertThat(update.status()).isEqualTo(ChapterResult.Status.UPDATED);

        // Exercise UUIDs must be identical after the update.
        JsonNode afterUpdate = contenuService.findChapitre("theoreme-de-pythagore")
                .orElseThrow(() -> new AssertionError("Chapter not found after update"));
        List<String> uuidsAfter = exerciceIds(afterUpdate);
        assertThat(uuidsAfter)
                .as("Exercise UUIDs must be preserved across a content update")
                .containsExactlyInAnyOrderElementsOf(uuidsBefore);
    }

    private List<String> exerciceIds(JsonNode chapter) {
        List<String> ids = new ArrayList<>();
        for (JsonNode section : chapter.path("sections")) {
            for (JsonNode block : section.path("blocks")) {
                if ("exercise".equals(block.path("type").asText()) && block.has("exerciceId")) {
                    ids.add(block.get("exerciceId").asText());
                }
            }
        }
        return ids;
    }
}
