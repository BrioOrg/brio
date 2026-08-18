package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
class ContenuSeeder {

    private static final Logger log = LoggerFactory.getLogger(ContenuSeeder.class);
    private static final String SEED_FILE = "/contenu/seeds/pythagore-3e.json";

    private final ContenuService contenuService;
    private final ChapitreRepository chapitreRepository;
    private final ObjectMapper objectMapper;

    ContenuSeeder(ContenuService contenuService, ChapitreRepository chapitreRepository, ObjectMapper objectMapper) {
        this.contenuService = contenuService;
        this.chapitreRepository = chapitreRepository;
        this.objectMapper = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    void seed() {
        try (InputStream is = getClass().getResourceAsStream(SEED_FILE)) {
            if (is == null) {
                log.warn("Seed file {} not found on classpath — skipping", SEED_FILE);
                return;
            }
            JsonNode document = objectMapper.readTree(is);
            String chapitreId = document.get("id").asText();

            if (chapitreRepository.existsById(chapitreId)) {
                log.info("Chapter '{}' already present — skipping seed", chapitreId);
                return;
            }

            contenuService.ingestChapitre(document);
            log.info("Seeded chapter '{}'", chapitreId);
        } catch (Exception e) {
            log.error("Failed to seed chapter from {}: {}", SEED_FILE, e.getMessage(), e);
        }
    }
}
