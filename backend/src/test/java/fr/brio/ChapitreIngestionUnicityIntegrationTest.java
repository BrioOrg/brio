package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.contenu.infrastructure.ChapterResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chapter ids are unique across the catalogue (ADR 0011, #218): a chapter whose id already
 * belongs to another niveau must fail, and leave the other chapter and its exercises untouched.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ChapitreIngestionUnicityIntegrationTest {

    // Distinct from the fixture's own id: the Spring context (and its database) is shared with
    // ChapitreIntegrationTest, which ingests the fixture as 3e.
    private static final String ID = "unicite-218";

    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbcTemplate;

    private ObjectNode doc;

    @BeforeEach
    void ingest6e() throws Exception {
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            doc = (ObjectNode) objectMapper.readTree(is);
        }
        doc.put("id", ID);
        doc.put("level", "6e");
        ChapterResult first = chapitreIngestor.ingestDocument(doc, "6e", "mathematiques", 0);
        assertThat(first.status()).isIn(ChapterResult.Status.CREATED, ChapterResult.Status.SKIPPED);
    }

    @Test
    void shouldFailChapterWhoseIdBelongsToAnotherNiveau() {
        ObjectNode autreNiveau = doc.deepCopy();
        autreNiveau.put("level", "5e");
        autreNiveau.put("title", "Un autre chapitre de 5e");
        autreNiveau.withArray("sections").remove(0);

        ChapterResult result = chapitreIngestor.ingestDocument(autreNiveau, "5e", "mathematiques", 0);

        assertThat(result.status()).isEqualTo(ChapterResult.Status.FAILED);
        assertThat(result.message()).contains("already belongs to 6e/mathematiques");
        assertChapterUntouched();
    }

    @Test
    void shouldFailIdenticalChapterUnderAnotherNiveauInsteadOfSkippingIt() {
        JsonNode memeContenu = doc.deepCopy();

        ChapterResult result = chapitreIngestor.ingestDocument(memeContenu, "5e", "mathematiques", 0);

        assertThat(result.status()).isEqualTo(ChapterResult.Status.FAILED);
        assertChapterUntouched();
    }

    private void assertChapterUntouched() {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT niveau_code FROM contenu.chapitres WHERE id = ?", String.class, ID))
                .isEqualTo("6e");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.exercices WHERE chapitre_id = ? AND retired_at IS NOT NULL",
                Integer.class, ID))
                .isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM contenu.exercices WHERE chapitre_id = ?", Integer.class, ID))
                .isPositive();
    }
}
