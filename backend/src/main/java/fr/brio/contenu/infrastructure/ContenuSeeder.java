package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
class ContenuSeeder {

    private static final Logger log = LoggerFactory.getLogger(ContenuSeeder.class);
    private static final String CHAPITRES_PATTERN = "classpath:/contenu/chapitres/**/_index.json";

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
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        try {
            Resource[] indexFiles = resolver.getResources(CHAPITRES_PATTERN);
            if (indexFiles.length == 0) {
                log.warn("No _index.json files found under classpath:/contenu/chapitres/ — skipping seed");
                return;
            }
            for (Resource indexFile : indexFiles) {
                seedFromIndex(indexFile);
            }
        } catch (Exception e) {
            log.error("Failed to scan chapter directories: {}", e.getMessage(), e);
        }
    }

    private void seedFromIndex(Resource indexFile) throws Exception {
        String path = indexFile.getURL().getPath();
        // path ends with .../<niveau>/<matiere>/_index.json; extract the two segments before it
        String[] parts = path.split("/contenu/chapitres/");
        if (parts.length < 2) {
            log.warn("Could not parse niveau/matiere from path: {}", path);
            return;
        }
        String[] segments = parts[1].split("/");
        if (segments.length < 3) {
            log.warn("Unexpected path structure (need niveau/matiere/_index.json): {}", path);
            return;
        }
        String niveau = segments[0];
        String matiere = segments[1];

        String[] slugs = objectMapper.readValue(indexFile.getInputStream(), String[].class);
        for (int i = 0; i < slugs.length; i++) {
            ingestIfAbsent(niveau, matiere, slugs[i], i);
        }
    }

    private void ingestIfAbsent(String niveau, String matiere, String slug, int ordre) {
        if (chapitreRepository.existsById(slug)) {
            log.info("Chapter '{}' already present — skipping seed", slug);
            return;
        }
        String resourcePath = "/contenu/chapitres/" + niveau + "/" + matiere + "/" + slug + ".json";
        try (var is = getClass().getResourceAsStream(resourcePath)) {
            if (is == null) {
                log.warn("Chapter file {} not found on classpath — skipping", resourcePath);
                return;
            }
            JsonNode document = objectMapper.readTree(is);
            contenuService.ingestChapitre(document, ordre);
            log.info("Seeded chapter '{}'", slug);
        } catch (Exception e) {
            log.error("Failed to seed chapter '{}' from {}: {}", slug, resourcePath, e.getMessage(), e);
        }
    }
}
