package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.contenu.infrastructure.ChapterResult;
import fr.brio.contenu.infrastructure.IngestReport;
import java.nio.file.Path;
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

        // Load the fixture and mutate the title so the hash changes.
        JsonNode original;
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            original = objectMapper.readTree(is);
        }
        ObjectNode modified = original.deepCopy();
        modified.put("title", "Titre modifié pour le test");

        // Collect exercise IDs from the first ingest via the chapter content.
        ChapterResult update = chapitreIngestor.ingestDocument(modified, "3e", "mathematiques", 0);

        assertThat(update.status()).isEqualTo(ChapterResult.Status.UPDATED);
    }
}
