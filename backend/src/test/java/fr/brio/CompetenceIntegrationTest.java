package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.contenu.infrastructure.ChapterResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CompetenceIntegrationTest {

    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired ObjectMapper objectMapper;
    @Autowired ApplicationContext context;

    @Test
    void shouldProjectReferentialIntoDatabaseAtStartup() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.competences", Integer.class);
        assertThat(count).isGreaterThan(100);

        String intitule = jdbcTemplate.queryForObject(
                "SELECT intitule FROM contenu.competences WHERE code = ?",
                String.class, "c4.geo.pythagore.calculer");
        assertThat(intitule).contains("Pythagore");
    }

    @Test
    void shouldUpsertByCodeWhenReferentialIsIngestedAgain() throws Exception {
        Integer before = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.competences", Integer.class);

        // By bean name: the class is package-private to the contenu module and
        // may be wrapped in a transactional proxy.
        ApplicationRunner ingestor = context.getBean("referentielIngestor", ApplicationRunner.class);
        ingestor.run(new DefaultApplicationArguments());

        Integer after = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.competences", Integer.class);
        assertThat(after).isEqualTo(before);
    }

    @Test
    void shouldRejectChapterReferencingUnknownCompetencyCodeAndPersistNothing() throws Exception {
        // Valid seed document, but one exercise pointing at a well-formed code
        // that does not exist in the referential.
        ObjectNode doc;
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            doc = ((ObjectNode) objectMapper.readTree(is)).deepCopy();
        }
        doc.put("id", "chapitre-code-inconnu");
        ObjectNode firstExercise = firstExerciseBlock(doc);
        firstExercise.set("competencies",
                objectMapper.createArrayNode().add("c4.geo.inexistant.tester"));

        ChapterResult result = chapitreIngestor.ingestDocument(doc, "3e", "mathematiques", 0);
        assertThat(result.status()).isEqualTo(ChapterResult.Status.FAILED);
        assertThat(result.message()).contains("c4.geo.inexistant.tester");

        Integer chapitres = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.chapitres WHERE id = ?",
                Integer.class, "chapitre-code-inconnu");
        assertThat(chapitres).isZero();
        Integer exercices = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.exercices WHERE chapitre_id = ?",
                Integer.class, "chapitre-code-inconnu");
        assertThat(exercices).isZero();
    }

    private ObjectNode firstExerciseBlock(JsonNode chapter) {
        for (JsonNode section : chapter.get("sections")) {
            for (JsonNode block : section.get("blocks")) {
                if ("exercise".equals(block.path("type").asText())) {
                    return (ObjectNode) block;
                }
            }
        }
        throw new AssertionError("Seed chapter contains no exercise block");
    }
}
