package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Public facade for chapter ingestion (ADR 0010). Two callers exist:
 * IngestCommand (CLI, exits non-zero on failure) and LocalContentSeeder
 * (local dev startup, logs and carries on). Both call ingestAll(); the
 * error-handling contract differs — it is enforced at the caller, not here.
 */
@Component
public class ChapitreIngestor {

    private static final Logger log = LoggerFactory.getLogger(ChapitreIngestor.class);

    private final ChapitreIngestionTx tx;
    private final ObjectMapper objectMapper;

    ChapitreIngestor(ChapitreIngestionTx tx, ObjectMapper objectMapper) {
        this.tx = tx;
        this.objectMapper = objectMapper;
    }

    /**
     * Ingests all chapters found under {@code contentDir/chapitres/} by scanning
     * each {@code _index.json} manifest. The referential must already be loaded
     * (ReferentielIngestor runs first at @Order(1)).
     */
    public IngestReport ingestAll(Path contentDir) {
        Path chapitresDir = contentDir.resolve("chapitres");
        List<ChapterResult> results = new ArrayList<>();

        List<Path> indexFiles;
        try {
            // _index.json sits at chapitres/<niveau>/<matiere>/_index.json — depth 3 from chapitresDir.
            indexFiles = Files.walk(chapitresDir, 3)
                    .filter(p -> "_index.json".equals(p.getFileName().toString()))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Cannot scan content directory: " + chapitresDir, e);
        }

        if (indexFiles.isEmpty()) {
            log.warn("No _index.json files found under {} — nothing ingested", chapitresDir);
            return new IngestReport(results);
        }

        for (Path indexFile : indexFiles) {
            Path matiereDir = indexFile.getParent();
            Path niveauDir = matiereDir.getParent();
            String niveau = niveauDir.getFileName().toString();
            String matiere = matiereDir.getFileName().toString();

            String[] slugs;
            try {
                slugs = objectMapper.readValue(indexFile.toFile(), String[].class);
            } catch (Exception e) {
                log.error("Cannot parse {}: {}", indexFile, e.getMessage());
                results.add(new ChapterResult(niveau + "/" + matiere, ChapterResult.Status.FAILED,
                        "Failed to read _index.json: " + e.getMessage()));
                continue;
            }

            for (int i = 0; i < slugs.length; i++) {
                String slug = slugs[i];
                Path chapterFile = matiereDir.resolve(slug + ".json");
                results.add(ingestFile(chapterFile, niveau, matiere, i));
            }
        }

        logReport(results);
        return new IngestReport(results);
    }

    /**
     * Reads a chapter JSON file from the filesystem and ingests it.
     * The transaction is managed by the delegate {@link ChapitreIngestionTx}.
     */
    public ChapterResult ingestFile(Path file, String niveau, String matiere, int ordre) {
        JsonNode doc;
        try {
            doc = objectMapper.readTree(file.toFile());
        } catch (Exception e) {
            String slug = file.getFileName().toString().replace(".json", "");
            log.error("Cannot read chapter file {}: {}", file, e.getMessage());
            return new ChapterResult(slug, ChapterResult.Status.FAILED, e.getMessage());
        }
        return ingestDocument(doc, niveau, matiere, ordre);
    }

    /**
     * Ingests a pre-parsed chapter document. The underlying transaction rolls back
     * on any validation or persistence error; the exception is caught here and
     * returned as a FAILED result so callers can continue with remaining chapters.
     */
    public ChapterResult ingestDocument(JsonNode doc, String niveau, String matiere, int ordre) {
        String slug = doc.path("id").asText("<unknown>");
        try {
            return tx.ingestDocument(doc, niveau, matiere, ordre);
        } catch (Exception e) {
            log.error("Chapter '{}' failed: {}", slug, e.getMessage(), e);
            return new ChapterResult(slug, ChapterResult.Status.FAILED, e.getMessage());
        }
    }

    private void logReport(List<ChapterResult> results) {
        long created = results.stream().filter(r -> r.status() == ChapterResult.Status.CREATED).count();
        long updated = results.stream().filter(r -> r.status() == ChapterResult.Status.UPDATED).count();
        long skipped = results.stream().filter(r -> r.status() == ChapterResult.Status.SKIPPED).count();
        long failed = results.stream().filter(r -> r.status() == ChapterResult.Status.FAILED).count();
        log.info("Ingestion complete — created: {}, updated: {}, skipped: {}, failed: {}",
                created, updated, skipped, failed);
        results.stream()
                .filter(r -> r.status() == ChapterResult.Status.FAILED)
                .forEach(r -> log.error("  FAILED  {}: {}", r.slug(), r.message()));
    }
}
