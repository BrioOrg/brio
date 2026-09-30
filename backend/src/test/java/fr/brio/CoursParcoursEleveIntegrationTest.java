package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.ClasseInfo;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

/**
 * The API side of the F3 definition of done (CDC §8.7), end to end over HTTP: a teacher
 * composes a course, scopes it to their class and publishes it; an enrolled student reads it
 * and answers its exercises. Focused on the fill-blank and paper types added in #151 — the
 * other types' paths are covered by {@link ProfCoursControllerIntegrationTest} and
 * {@link CoursControllerIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CoursParcoursEleveIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;

    private RequestPostProcessor teacher;
    private RequestPostProcessor student;
    private ClasseInfo classe;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();

        var etab = classeService.creerEtablissement(
                "Collège Test", null, "college", LocalDate.now().minusYears(1), "CONV-2025");
        classe = classeService.creerClasse(etab.id(), "3e", "3e A", "2025-2026", null);

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID teacherId = compteService.creerEnseignant(
                "motdepasse123", "Prof " + suffix, "prof-" + suffix + "@example.fr").id();
        classeService.assignerEnseignantPrincipal(classe.id(), teacherId);
        teacher = user(teacherId.toString()).roles("ENSEIGNANT");

        var code = classeService.genererCode(classe.id(), teacherId, 14, 40);
        UUID studentId = classeService.rejoindreParCode(code.code(), "motdepasse123", "Alice").id();
        student = user(studentId.toString());
    }

    @Test
    void shouldLetAStudentReadAndAnswerAFillBlankExerciseFromAPublishedCourse() throws Exception {
        UUID coursId = creerEtPublier(content(fillBlank("[\"côté\", \"droit\"]")));

        JsonNode served = objectMapper.readTree(mockMvc.perform(get("/api/cours/{id}", coursId).with(student))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        JsonNode trous = block(served, "ex-trous");
        assertThat(trous.has("expected")).as("the correction never reaches the student").isFalse();
        assertThat(trous.has("caseSensitive")).isFalse();
        assertThat(trous.path("template").asText()).isEqualTo("Le {} opposé à l'angle {}.");
        assertThat(trous.path("bank")).hasSize(3);

        // Paper is self-assessed: its model solution is meant for the student and is served.
        JsonNode feuille = block(served, "ex-feuille");
        assertThat(feuille.path("solution").asText()).isEqualTo("On applique Pythagore.");

        String exerciceId = trous.path("exerciceId").asText();
        soumettre(exerciceId, "{\"answer\": {\"blanks\": [\"côté\", \"droit\"]}}")
                .andExpect(jsonPath("$.correct").value(true));
        soumettre(exerciceId, "{\"answer\": {\"blanks\": [\"droit\", \"côté\"]}}")
                .andExpect(jsonPath("$.correct").value(false))
                .andExpect(jsonPath("$.score").value(0.0));
    }

    @Test
    void shouldRefuseToPublishAFillBlankWhoseAnswerIsNotInTheBank() throws Exception {
        UUID coursId = creerCours();
        enregistrer(coursId, content(fillBlank("[\"côté\", \"obtus\"]")));
        definirPortees(coursId);

        mockMvc.perform(post("/api/prof/cours/{id}/publier", coursId).with(teacher).with(csrf()))
                .andExpect(status().isUnprocessableEntity());
    }

    // --- HTTP steps --------------------------------------------------------------

    private UUID creerEtPublier(JsonNode content) throws Exception {
        UUID coursId = creerCours();
        enregistrer(coursId, content);
        definirPortees(coursId);
        mockMvc.perform(post("/api/prof/cours/{id}/publier", coursId).with(teacher).with(csrf()))
                .andExpect(status().isOk());
        return coursId;
    }

    private UUID creerCours() throws Exception {
        String body = mockMvc.perform(post("/api/prof/cours").with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"titre\":\"Pythagore\",\"niveauCode\":\"3e\",\"matiereCode\":\"mathematiques\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).path("coursId").asText());
    }

    private void enregistrer(UUID coursId, JsonNode content) throws Exception {
        ObjectNode body = objectMapper.createObjectNode().put("titre", "Pythagore");
        body.set("content", content);
        mockMvc.perform(put("/api/prof/cours/{id}", coursId).with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNoContent());
    }

    private void definirPortees(UUID coursId) throws Exception {
        mockMvc.perform(put("/api/prof/cours/{id}/portees", coursId).with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classeIds\":[\"" + classe.id() + "\"]}"))
                .andExpect(status().isNoContent());
    }

    private ResultActions soumettre(String exerciceId, String body) throws Exception {
        return mockMvc.perform(post("/api/exercices/{id}/soumissions", exerciceId).with(student).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    // --- Content -------------------------------------------------------------------

    /** A fill-blank whose bank is sorted, as the editor serves it (the answers are not first). */
    private static String fillBlank(String expected) {
        return """
                { "id": "ex-trous", "type": "exercise", "exerciseType": "fill-blank",
                  "prompt": "Complète la phrase.", "template": "Le {} opposé à l'angle {}.",
                  "bank": ["aigu", "côté", "droit"], "expected": %s }
                """.formatted(expected);
    }

    private JsonNode content(String fillBlank) throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-enseignant",
                  "title": "Pythagore",
                  "sections": [
                    { "id": "s1", "title": "Exercices", "kind": "exercises", "blocks": [
                      %s,
                      { "id": "ex-feuille", "type": "exercise", "exerciseType": "paper",
                        "prompt": "Calcule l'hypoténuse.", "solution": "On applique Pythagore." }
                    ] }
                  ]
                }
                """.formatted(fillBlank));
    }

    private static JsonNode block(JsonNode content, String id) {
        for (JsonNode section : content.path("sections")) {
            for (JsonNode block : section.path("blocks")) {
                if (id.equals(block.path("id").asText())) {
                    return block;
                }
            }
        }
        throw new AssertionError("No block '" + id + "' in served content");
    }
}
