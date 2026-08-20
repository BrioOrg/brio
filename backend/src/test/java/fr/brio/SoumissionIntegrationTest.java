package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.exercices.infrastructure.SoumissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = "testuser")
@Import(TestcontainersConfiguration.class)
class SoumissionIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ContenuService contenuService;
    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired SoumissionRepository soumissionRepository;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void seedChapter() throws Exception {
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            JsonNode doc = objectMapper.readTree(is);
            chapitreIngestor.ingestDocument(doc, "3e", "mathematiques", 0);
        }
    }

    // ---------- multiple-choice ----------

    @Test
    void shouldEvaluateCorrectMultipleChoiceAnswer() throws Exception {
        UUID id = exerciceId("ex-reconnaitre-hypotenuse");

        mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"choiceIds": ["choice-rt"]}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.score").value(1.0))
                .andExpect(jsonPath("$.soumissionId").exists())
                .andExpect(jsonPath("$.choiceFeedback").isArray());
    }

    @Test
    void shouldEvaluateIncorrectMultipleChoiceAnswer() throws Exception {
        UUID id = exerciceId("ex-reconnaitre-hypotenuse");

        mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"choiceIds": ["choice-rs"]}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(false))
                .andExpect(jsonPath("$.score").value(0.0));
    }

    @Test
    void shouldRecordEveryAttemptSeparately() throws Exception {
        UUID id = exerciceId("ex-reconnaitre-hypotenuse");
        long before = soumissionRepository.count();

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"answer": {"choiceIds": ["choice-rt"]}}
                                    """))
                    .andExpect(status().isOk());
        }

        assertThat(soumissionRepository.count()).isEqualTo(before + 3);
    }

    // ---------- numeric ----------

    @Test
    void shouldEvaluateCorrectNumericAnswer() throws Exception {
        UUID id = exerciceId("ex-calcul-hypotenuse");

        mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"value": 10.0}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.score").value(1.0))
                .andExpect(jsonPath("$.expectedValue").value(10.0));
    }

    @Test
    void shouldEvaluateIncorrectNumericAnswer() throws Exception {
        UUID id = exerciceId("ex-calcul-hypotenuse");

        mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"value": 9.0}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(false));
    }

    // ---------- error cases ----------

    @Test
    void shouldReturn404ForUnknownExerciceId() throws Exception {
        mockMvc.perform(post("/api/exercices/{id}/soumissions", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"choiceIds": ["choice-rt"]}}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturn422ForMalformedAnswer() throws Exception {
        UUID id = exerciceId("ex-reconnaitre-hypotenuse");

        mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"wrong_field": "bad"}}
                                """))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void shouldPersistStudentRefFromSecurityPrincipal() throws Exception {
        UUID id = exerciceId("ex-reconnaitre-hypotenuse");

        MvcResult result = mockMvc.perform(post("/api/exercices/{id}/soumissions", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer": {"choiceIds": ["choice-rt"]}}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        UUID soumissionId = UUID.fromString(
                objectMapper.readTree(result.getResponse().getContentAsString())
                        .get("soumissionId").asText());

        assertThat(soumissionRepository.findById(soumissionId))
                .isPresent()
                .hasValueSatisfying(s -> assertThat(s.getStudentRef()).isEqualTo("testuser"));
    }

    // ---------- helper ----------

    private UUID exerciceId(String slug) {
        return contenuService.findExerciceIdByChapitreAndSlug("theoreme-de-pythagore", slug)
                .orElseThrow(() -> new IllegalStateException("Exercise not seeded: " + slug));
    }
}
