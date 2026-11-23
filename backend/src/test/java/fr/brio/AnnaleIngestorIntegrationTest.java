package fr.brio;

import fr.brio.contenu.AnnaleDto;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.ExerciceEntrainementDto;
import fr.brio.contenu.ReferentielService;
import fr.brio.contenu.api.CompetenceDto;
import fr.brio.contenu.infrastructure.AnnaleIngestor;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F7 (ADR 0026) : la fixture d'annale s'ingère comme un chapitre spécialisé, apparaît dans
 * {@code /api/annales}, est exclue du catalogue des cours, et alimente l'entraînement par compétence.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class AnnaleIngestorIntegrationTest {

    // Lancé depuis backend/ → ../content résout le répertoire content du dépôt.
    private static final Path CONTENT_DIR = Path.of("../content");
    private static final String ANNALE_ID = "brevet-2025-demo";

    @Autowired AnnaleIngestor annaleIngestor;
    @Autowired ContenuService contenuService;
    @Autowired ReferentielService referentielService;

    @Test
    void ingesteLAnnaleEtLExposeSansPolluerLeCatalogue() {
        annaleIngestor.ingestAll(CONTENT_DIR);

        // 1. L'annale apparaît dans la liste des annales.
        List<AnnaleDto> annales = contenuService.listerAnnales(null, null, null);
        assertThat(annales)
                .as("La fixture d'annale doit être listée")
                .anyMatch(a -> ANNALE_ID.equals(a.id()) && "brevet".equals(a.examen()) && a.annee() == 2025);

        // 2. Elle n'apparaît PAS dans le catalogue des cours.
        boolean dansCatalogue = contenuService.getCatalogue().stream()
                .flatMap(n -> n.matieres().stream())
                .flatMap(m -> m.chapitres().stream())
                .anyMatch(c -> ANNALE_ID.equals(c.slug()));
        assertThat(dansCatalogue).as("Une annale ne doit pas apparaître dans le catalogue").isFalse();

        // 3. L'entraînement par compétence renvoie ses exercices (avec l'énoncé, sans correction).
        List<ExerciceEntrainementDto> entrainement =
                contenuService.entrainementParCompetence("c4.geo.pythagore.calculer");
        assertThat(entrainement)
                .as("L'exercice de calcul de l'annale doit remonter par sa compétence")
                .anyMatch(e -> ANNALE_ID.equals(e.annaleId()) && !e.prompt().isBlank());
    }

    @Test
    void lesCompetencesProposeesALEleveSontCellesQueLesAnnalesTravaillent() {
        annaleIngestor.ingestAll(CONTENT_DIR);

        // #406 : la vue « Par compétence » de l'élève lit ces compétences, pas le référentiel prof.
        List<CompetenceDto> competences = referentielService.competencesDesAnnales();
        assertThat(competences)
                .extracting(CompetenceDto::code)
                .contains("c4.geo.pythagore.calculer")
                .isSorted();
        assertThat(competences).allSatisfy(c -> {
            assertThat(c.intitule()).isNotBlank();
            assertThat(contenuService.entrainementParCompetence(c.code()))
                    .as("Chaque compétence proposée a au moins un exercice : %s", c.code())
                    .isNotEmpty();
        });
    }

    @Test
    void reIngestionIdempotente() {
        annaleIngestor.ingestAll(CONTENT_DIR);
        annaleIngestor.ingestAll(CONTENT_DIR);

        long combien = contenuService.listerAnnales(null, null, null).stream()
                .filter(a -> ANNALE_ID.equals(a.id()))
                .count();
        assertThat(combien).as("Une double ingestion ne duplique pas l'annale").isEqualTo(1);
    }
}
