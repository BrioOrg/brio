package fr.brio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.identite.ClasseService;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

/**
 * End-to-end HTTP wiring of GET /api/cours/{coursId} (ADR 0019 §1): a scoped student reads
 * the course, a non-scoped student is refused, an unknown/unpublished course is 404, and an
 * anonymous request is 401. Students are seeded through the real identite enrolment path so
 * the InscriptionsQuery → cours_portees intersection is exercised against real data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CoursControllerIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ClasseService classeService;
    @Autowired CoursEditionService coursEditionService;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;

    private UUID studentInScope;
    private UUID studentOutOfScope;
    private UUID coursId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();

        // UAI left null (VARCHAR(8) UNIQUE, nullable): @BeforeEach runs per test with real commits
        // and no rollback, so a fixed UAI would collide across tests.
        var etab = classeService.creerEtablissement(
                "Collège Test", null, "college", LocalDate.now().minusYears(1), "CONV-2025");
        var classeA = classeService.creerClasse(etab.id(), "3e", "3e A", "2025-2026");
        var classeB = classeService.creerClasse(etab.id(), "3e", "3e B", "2025-2026");

        var codeA = classeService.genererCode(classeA.id(), UUID.randomUUID(), 14, 40);
        var codeB = classeService.genererCode(classeB.id(), UUID.randomUUID(), 14, 40);

        studentInScope = classeService.rejoindreParCode(codeA.code(), "motdepasse123", "Alice").id();
        studentOutOfScope = classeService.rejoindreParCode(codeB.code(), "motdepasse123", "Bob").id();

        coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), etab.id(), "Mon cours", "3e", "mathematiques", draftContent()));
        coursEditionService.definirPortees(coursId, Set.of(classeA.id()));
        coursEditionService.publier(coursId);
    }

    @Test
    void shouldServeTheCourseToAStudentInAScopedClass() throws Exception {
        mockMvc.perform(get("/api/cours/{id}", coursId).with(user(studentInScope.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Mon cours"))
                .andExpect(jsonPath("$.sections").isArray());
    }

    @Test
    void shouldRefuseAStudentNotInAScopedClass() throws Exception {
        mockMvc.perform(get("/api/cours/{id}", coursId).with(user(studentOutOfScope.toString())))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn404ForAnUnknownCourse() throws Exception {
        mockMvc.perform(get("/api/cours/{id}", UUID.randomUUID()).with(user(studentInScope.toString())))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/cours/{id}", coursId))
                .andExpect(status().isUnauthorized());
    }

    private JsonNode draftContent() throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-enseignant",
                  "title": "Mon cours",
                  "sections": [
                    { "id": "s1", "title": "Leçon", "kind": "lesson", "blocks": [
                      { "id": "p1", "type": "prose", "text": "Bonjour" },
                      { "id": "img1", "type": "image", "asset": "a.svg", "alt": "un schéma" },
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
