package fr.brio.contenu.infrastructure;

import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
@Order(2)
class LocalContentSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalContentSeeder.class);

    private final ChapitreIngestor chapitreIngestor;
    private final Path contentDir;

    LocalContentSeeder(
            ChapitreIngestor chapitreIngestor,
            @Value("${brio.content.dir:../content}") String contentDirProperty) {
        this.chapitreIngestor = chapitreIngestor;
        this.contentDir = Path.of(contentDirProperty);
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("Seeding content from {} (local profile)", contentDir.toAbsolutePath());
        try {
            chapitreIngestor.ingestAll(contentDir);
        } catch (Exception e) {
            log.error("Content seeding failed: {} — the app will start without seeded content", e.getMessage(), e);
        }
    }
}
