package fr.brio.contenu.infrastructure;

import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Profile("ingest")
@Order(2)
class IngestCommand implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(IngestCommand.class);

    private final ChapitreIngestor chapitreIngestor;

    IngestCommand(ChapitreIngestor chapitreIngestor) {
        this.chapitreIngestor = chapitreIngestor;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (args.getNonOptionArgs().isEmpty()) {
            throw new IngestionFailedException(
                    "Usage: ingest <content-dir>  (e.g. java -jar app.jar content/ --spring.profiles.active=ingest)");
        }

        Path contentDir = Path.of(args.getNonOptionArgs().get(0));
        log.info("Ingesting content from {}", contentDir.toAbsolutePath());

        IngestReport report = chapitreIngestor.ingestAll(contentDir);

        printReport(report);

        if (report.hasFailures()) {
            throw new IngestionFailedException(
                    report.countByStatus(ChapterResult.Status.FAILED) + " chapter(s) failed — see above for details");
        }
    }

    private void printReport(IngestReport report) {
        log.info("--- Ingestion report ---");
        report.results().forEach(r -> log.info("  {}  {}{}", r.status(), r.slug(),
                r.message() != null ? ": " + r.message() : ""));
        log.info("  created={} updated={} skipped={} failed={}",
                report.countByStatus(ChapterResult.Status.CREATED),
                report.countByStatus(ChapterResult.Status.UPDATED),
                report.countByStatus(ChapterResult.Status.SKIPPED),
                report.countByStatus(ChapterResult.Status.FAILED));
    }
}
