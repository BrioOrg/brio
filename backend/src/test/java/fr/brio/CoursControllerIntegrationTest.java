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
import fr.brio.identite.CompteService;
import fr.brio.identite.api.ClasseInfo;
import fr.brio.identite.domain.Inscription;
import fr.brio.identite.infrastructure.InscriptionRepository;
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
    @Autowired CompteService compteService;
    @Autowired InscriptionRepository inscriptionRepository;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;

    private UUID studentInScope;
    private UUID studentOutOfScope;
    private UUID coursId;
    private UUID auteur;
    private UUID etablissementId;
    private ClasseInfo classeA;
    private ClasseInfo classeB;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();

        // UAI left null (VARCHAR(8) UNIQUE, nullable): @BeforeEach runs per test with real commits
        // and no rollback, so a fixed UAI would collide across tests.
        var etab = classeService.creerEtablissement(
                "Collège Test", null, "college", LocalDate.now().minusYears(1), "CONV-2025");
        etablissementId = etab.id();
        classeA = classeService.creerClasse(etab.id(), "3e", "3e A", "2025-2026", null);
        classeB = classeService.creerClasse(etab.id(), "3e", "3e B", "2025-2026", null);

        var codeA = classeService.genererCode(classeA.id(), UUID.randomUUID(), 14, 40);
        var codeB = classeService.genererCode(classeB.id(), UUID.randomUUID(), 14, 40);

        studentInScope = classeService.rejoindreParCode(codeA.code(), "motdepasse123", "Alice").id();
        studentOutOfScope = classeService.rejoindreParCode(codeB.code(), "motdepasse123", "Bob").id();

        // A real teacher account, so the course list can show the author's name.
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        auteur = compteService.creerEnseignant(
                "motdepasse123", "Mme Durand", "prof-" + suffix + "@example.fr", etablissementId).id();
        coursId = publierCours("Mon cours", Set.of(classeA.id()));
    }

    private UUID publierCours(String titre, Set<UUID> classes) throws Exception {
        UUID id = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                auteur, etablissementId, titre, "3e", "mathematiques", draftContent()));
        coursEditionService.definirPortees(id, auteur, classes);
        coursEditionService.publier(id, auteur);
        return id;
    }

    // --- GET /api/cours: the student's list (#160) ----------------------------------

    @Test
    void shouldListThePublishedCourseWithItsTeacherToAStudentInScope() throws Exception {
        mockMvc.perform(get("/api/cours").with(user(studentInScope.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(coursId.toString()))
                .andExpect(jsonPath("$[0].titre").value("Mon cours"))
                .andExpect(jsonPath("$[0].matiereCode").value("mathematiques"))
                .andExpect(jsonPath("$[0].enseignant").value("Mme Durand"))
                .andExpect(jsonPath("$[0].publieAt").exists());
    }

    @Test
    void shouldListNothingToAStudentOutOfScope() throws Exception {
        mockMvc.perform(get("/api/cours").with(user(studentOutOfScope.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void shouldNotListADraft() throws Exception {
        UUID brouillon = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                auteur, etablissementId, "Brouillon", "3e", "mathematiques", draftContent()));
        coursEditionService.definirPortees(brouillon, auteur, Set.of(classeA.id()));

        mockMvc.perform(get("/api/cours").with(user(studentInScope.toString())))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(coursId.toString()));
    }

    @Test
    void shouldListACourseScopedToSeveralOfTheStudentsClassesOnceNewestFirst() throws Exception {
        // The student also joins class B; a newer course is scoped to both classes.
        inscriptionRepository.save(Inscription.creer(classeB.id(), studentInScope, "Alice"));
        UUID recent = publierCours("Cours récent", Set.of(classeA.id(), classeB.id()));

        mockMvc.perform(get("/api/cours").with(user(studentInScope.toString())))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(recent.toString()))
                .andExpect(jsonPath("$[1].id").value(coursId.toString()));
    }

    @Test
    void shouldRequireAuthenticationToList() throws Exception {
        mockMvc.perform(get("/api/cours")).andExpect(status().isUnauthorized());
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
