package fr.brio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.api.CreerBrouillonCommand;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

/**
 * HTTP wiring of the teacher authoring endpoints (ADR 0019 §4): a teacher creates, saves, scopes
 * and publishes a course; ownership and role are enforced. The teacher↔class link
 * ({@code enseignant_principal_id}) has no service path yet, so it is set directly here — that
 * assignment is separate "auth prof" work; this test proves the controller given the link exists.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProfCoursControllerIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired CoursEditionService coursEditionService;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;

    private UUID teacher;
    private ClasseInfo classeA;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();

        var etab = classeService.creerEtablissement(
                "Collège Test", null, "college", LocalDate.now().minusYears(1), "CONV-2025");
        classeA = classeService.creerClasse(etab.id(), "3e", "3e A", "2025-2026");

        // A real, active teacher account — StatutCheckFilter re-checks statut on every request.
        teacher = creerEnseignant();
        // No service assigns a principal teacher yet; wire the link at the persistence level.
        jdbc.update("UPDATE identite.classes SET enseignant_principal_id = ? WHERE id = ?",
                teacher, classeA.id());
    }

    private UUID creerEnseignant() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return compteService.creerEnseignant(
                "prof-" + suffix, "motdepasse123", "Prof " + suffix, "prof-" + suffix + "@example.fr").id();
    }

    @Test
    void shouldCreateSaveScopeAndPublishACourse() throws Exception {
        UUID coursId = creerCours();

        mockMvc.perform(put("/api/prof/cours/{id}", coursId).with(user(teacher.toString()).roles("ENSEIGNANT"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                objectMapper.createObjectNode().put("titre", "Pythagore")
                                        .set("content", draftContent()))))
                .andExpect(status().isNoContent());

        mockMvc.perform(put("/api/prof/cours/{id}/portees", coursId).with(user(teacher.toString()).roles("ENSEIGNANT"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classeIds\":[\"" + classeA.id() + "\"]}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/prof/cours/{id}/publier", coursId).with(user(teacher.toString()).roles("ENSEIGNANT"))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));
    }

    @Test
    void shouldRefuseScopingToAClassTheTeacherDoesNotRun() throws Exception {
        UUID coursId = creerCours();

        mockMvc.perform(put("/api/prof/cours/{id}/portees", coursId).with(user(teacher.toString()).roles("ENSEIGNANT"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classeIds\":[\"" + UUID.randomUUID() + "\"]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRejectPublishingSomeoneElsesCourse() throws Exception {
        UUID foreignCours = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), UUID.randomUUID(), "Pas à moi", "3e", "mathematiques", draftContent()));

        mockMvc.perform(post("/api/prof/cours/{id}/publier", foreignCours)
                        .with(user(teacher.toString()).roles("ENSEIGNANT")).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn422WhenTeacherHasNoClass() throws Exception {
        UUID teacherWithoutClass = creerEnseignant();
        mockMvc.perform(post("/api/prof/cours").with(user(teacherWithoutClass.toString()).roles("ENSEIGNANT"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(creerBody()))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void shouldRejectANonTeacher() throws Exception {
        var code = classeService.genererCode(classeA.id(), teacher, 14, 40);
        UUID eleve = classeService.rejoindreParCode(code.code(), "motdepasse123", "Alice").id();

        mockMvc.perform(post("/api/prof/cours").with(user(eleve.toString()).roles("ELEVE"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(creerBody()))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(post("/api/prof/cours").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(creerBody()))
                .andExpect(status().isUnauthorized());
    }

    private UUID creerCours() throws Exception {
        String body = mockMvc.perform(post("/api/prof/cours").with(user(teacher.toString()).roles("ENSEIGNANT"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(creerBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coursId").exists())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).path("coursId").asText());
    }

    private String creerBody() {
        return "{\"titre\":\"Pythagore\",\"niveauCode\":\"3e\",\"matiereCode\":\"mathematiques\"}";
    }

    private JsonNode draftContent() throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-enseignant",
                  "title": "Pythagore",
                  "sections": [
                    { "id": "s1", "title": "Leçon", "kind": "lesson", "blocks": [
                      { "id": "p1", "type": "prose", "text": "Bonjour" },
                      { "id": "ex-num", "type": "exercise", "exerciseType": "numeric",
                        "prompt": "Hypoténuse de 3 et 4 ?",
                        "competencies": ["c4.geo.pythagore.calculer"],
                        "answer": 5, "tolerance": 0.01 }
                    ] }
                  ]
                }
                """);
    }
}
