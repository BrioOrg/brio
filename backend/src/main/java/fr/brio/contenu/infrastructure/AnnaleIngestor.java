package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.domain.Annale;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Ingestion des annales (F7, ADR 0026). Une annale est un « chapitre spécialisé » : le sujet
 * ({@code <slug>.json}) est ingéré via le pipeline chapitre existant ({@link ChapitreIngestor},
 * non modifié), puis ses métadonnées ({@code <slug>.meta.json}) sont upsertées dans
 * {@code contenu.annales}. Appelé à côté de l'ingestion des chapitres, après elle.
 */
@Component
public class AnnaleIngestor {

    private static final Logger log = LoggerFactory.getLogger(AnnaleIngestor.class);

    private final ChapitreIngestor chapitreIngestor;
    private final AnnaleRepository annaleRepository;
    private final ObjectMapper objectMapper;

    AnnaleIngestor(ChapitreIngestor chapitreIngestor, AnnaleRepository annaleRepository,
                   ObjectMapper objectMapper) {
        this.chapitreIngestor = chapitreIngestor;
        this.annaleRepository = annaleRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Ingère toutes les annales sous {@code contentDir/annales/<niveau>/<matiere>/} en scannant les
     * {@code _index.json}. Absence du dossier {@code annales/} = rien à faire (cas normal).
     */
    public void ingestAll(Path contentDir) {
        Path annalesDir = contentDir.resolve("annales");
        if (!Files.isDirectory(annalesDir)) {
            log.info("No annales directory under {} — skipping", annalesDir);
            return;
        }

        List<Path> indexFiles;
        try {
            indexFiles = Files.walk(annalesDir, 3)
                    .filter(p -> "_index.json".equals(p.getFileName().toString()))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Cannot scan annales directory: " + annalesDir, e);
        }

        int ok = 0;
        int failed = 0;
        for (Path indexFile : indexFiles) {
            Path matiereDir = indexFile.getParent();
            String matiere = matiereDir.getFileName().toString();
            String niveau = matiereDir.getParent().getFileName().toString();

            String[] slugs;
            try {
                slugs = objectMapper.readValue(indexFile.toFile(), String[].class);
            } catch (Exception e) {
                log.error("Cannot parse {}: {}", indexFile, e.getMessage());
                failed++;
                continue;
            }

            for (int i = 0; i < slugs.length; i++) {
                try {
                    ingestOne(matiereDir, slugs[i], niveau, matiere, i);
                    ok++;
                } catch (Exception e) {
                    log.error("Annale '{}' failed: {}", slugs[i], e.getMessage(), e);
                    failed++;
                }
            }
        }
        log.info("Annales ingestion complete — ok: {}, failed: {}", ok, failed);
    }

    // On lit d'abord les métadonnées : si elles sont absentes/invalides, on n'ingère PAS le sujet
    // (sinon un chapitre nu polluerait le catalogue). L'ingestion du chapitre et l'upsert des
    // métadonnées sont chacun transactionnels (ChapitreIngestionTx / save).
    private void ingestOne(Path matiereDir, String slug, String niveau, String matiere, int ordre)
            throws IOException {
        Path metaFile = matiereDir.resolve(slug + ".meta.json");
        AnnaleMeta meta = objectMapper.readValue(metaFile.toFile(), AnnaleMeta.class);

        Path subjectFile = matiereDir.resolve(slug + ".json");
        ChapterResult result = chapitreIngestor.ingestFile(subjectFile, niveau, matiere, ordre);
        if (result.status() == ChapterResult.Status.FAILED) {
            throw new IllegalStateException("chapter ingestion failed: " + result.message());
        }

        annaleRepository.save(new Annale(slug, meta.examen(), meta.session(), meta.annee(),
                meta.centre(), matiere, niveau, meta.dureeMinutes(), meta.licence(), meta.sourceUrl()));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record AnnaleMeta(String examen, String session, int annee, String centre, Integer dureeMinutes,
                      String licence, String sourceUrl) {}
}
