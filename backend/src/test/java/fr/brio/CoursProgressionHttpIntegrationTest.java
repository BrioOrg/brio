package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
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
import fr.brio.contenu.api.ChapitrePublie;
import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.contenu.api.SectionTerminee;
import fr.brio.progression.ProgressionService;
import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.ClasseInfo;
import fr.brio.identite.domain.InscriptionId;
import fr.brio.identite.infrastructure.InscriptionRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

/**
 * Teacher-course progression end to end (ADR 0050): the « section lue » endpoint and its access
 * rules, the scope check on a course exercise submission (V5 I3), the gauge (V5 I4) and
 * « Reprendre » filtered by the course page's own visibility rule (C11, S1, S3). Events are
 * delivered after commit, asynchronously: reads are awaited.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class CoursProgressionHttpIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired ObjectMapper objectMapper;
    @Autowired InscriptionRepository inscriptions;
    @Autowired CoursAccesApi coursAcces;
    @Autowired JdbcTemplate jdbc;
    @Autowired ProgressionService progression;
    @Autowired org.springframework.context.ApplicationContext context;

    MockMvc mockMvc;

    private RequestPostProcessor teacher;
    private RequestPostProcessor alice; // class A, the course is scoped to it
    private RequestPostProcessor bob;   // class B, never scoped
    private UUID aliceId;
    private UUID bobId;
    private ClasseInfo classeA;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();

        var etab = classeService.creerEtablissement(
                "Collège Test", null, "college", LocalDate.now().minusYears(1), "CONV-2025");
        classeA = classeService.creerClasse(etab.id(), "3e", "3e A", "2025-2026", null);
        ClasseInfo classeB = classeService.creerClasse(etab.id(), "3e", "3e B", "2025-2026", null);

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID teacherId = compteService.creerEnseignant(
                "motdepasse123", "Prof " + suffix, "prof-" + suffix + "@example.fr", etab.id()).id();
        classeService.assignerEnseignantPrincipal(classeA.id(), teacherId);
        classeService.assignerEnseignantPrincipal(classeB.id(), teacherId);
        teacher = user(teacherId.toString()).roles("ENSEIGNANT");

        aliceId = classeService.rejoindreParCode(
                classeService.genererCode(classeA.id(), teacherId, 14, 40).code(), "motdepasse123", "Alice").id();
        bobId = classeService.rejoindreParCode(
                classeService.genererCode(classeB.id(), teacherId, 14, 40).code(), "motdepasse123", "Bob").id();
        alice = user(aliceId.toString());
        bob = user(bobId.toString());
    }

    // ── POST /api/cours/{coursId}/sections/{sectionId}/lu ─────────────────────

    @Test
    void givenAScopedStudentWhenSheMarksASectionReadThenHerGaugeMovesAndOnlyHers() throws Exception {
        UUID coursId = creerEtPublier();

        lu(coursId, "s1", alice).andExpect(status().isNoContent());

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                mockMvc.perform(get("/api/progression/cours/{id}", coursId).with(alice))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.coursId").value(coursId.toString()))
                        .andExpect(jsonPath("$.sectionsLues").value(1))
                        .andExpect(jsonPath("$.sectionsTotal").value(2))
                        .andExpect(jsonPath("$.termine").value(false)));
        // I4 / C12: a student with no row learns nothing about the course, even its size.
        mockMvc.perform(get("/api/progression/cours/{id}", coursId).with(bob)).andExpect(status().isNoContent());
    }

    @Test
    void givenTheAccessRulesOfTheCoursePageWhenMarkingASectionReadThenTheSameAnswersAreGiven() throws Exception {
        UUID coursId = creerEtPublier();
        UUID brouillon = creerCours(); // never published

        lu(coursId, "s1", bob).andExpect(status().isForbidden());
        lu(coursId, "s1", teacher).andExpect(status().isForbidden()); // a teacher has no student class
        lu(brouillon, "s1", alice).andExpect(status().isNotFound());
        lu(UUID.randomUUID(), "s1", alice).andExpect(status().isNotFound());
        lu(coursId, "inconnue", alice).andExpect(status().isNotFound());
        lu(coursId, "a".repeat(128), alice).andExpect(status().isNotFound()); // within the bound: unknown
        lu(coursId, "a".repeat(129), alice).andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/cours/{c}/sections/{s}/lu", coursId, "s1").with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    // ── I3: scope check on a course exercise ──────────────────────────────────

    @Test
    void givenAStudentOutOfScopeWhenSheSubmitsACourseExerciseThenItIsRefusedAndNothingIsRecorded() throws Exception {
        UUID coursId = creerEtPublier();
        String exerciceId = exerciceId(coursId);

        mockMvc.perform(post("/api/exercices/{id}/soumissions", exerciceId).with(bob).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answer\": {\"blanks\": [\"côté\", \"droit\"]}}"))
                .andExpect(status().isForbidden());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM exercices.soumissions WHERE student_ref = ?",
                Integer.class, bobId.toString())).isZero();
        // Progression writes after commit, asynchronously: let a legitimate solve land first, so the
        // checks below cannot pass merely because they looked too early (V5 S-c).
        soumettre(exerciceId, "[\"côté\", \"droit\"]", alice);
        await().atMost(Duration.ofSeconds(10)).until(() -> jdbc.queryForObject(
                "SELECT count(*) FROM progression.cours_exercices_reussis WHERE eleve_id = ?", Integer.class,
                aliceId) == 1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM progression.cours_exercices_reussis WHERE eleve_id = ?",
                Integer.class, bobId)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM progression.cours_suivis WHERE eleve_id = ?",
                Integer.class, bobId)).isZero();
    }

    @Test
    void givenAScopedStudentWhenSheSolvesTheExerciseAndReadsEverythingThenTheCourseIsDone() throws Exception {
        UUID coursId = creerEtPublier();
        mockMvc.perform(post("/api/exercices/{id}/soumissions", exerciceId(coursId)).with(alice).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answer\": {\"blanks\": [\"côté\", \"droit\"]}}"))
                .andExpect(status().isOk());
        lu(coursId, "s1", alice).andExpect(status().isNoContent());
        lu(coursId, "s2", alice).andExpect(status().isNoContent());

        // The paper exercise is not counted: 2/2 sections and 1/1 gradable exercise is done.
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                mockMvc.perform(get("/api/progression/cours/{id}", coursId).with(alice))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.termine").value(true))
                        .andExpect(jsonPath("$.pourcentage").value(100)));
        mockMvc.perform(get("/api/progression/reprendre").with(alice)).andExpect(status().isNoContent());
    }

    // ── « Reprendre » (C10, C11, S1) ──────────────────────────────────────────

    @Test
    void givenAnUnfinishedCourseWhenTheStudentComesBackThenItIsProposedWithItsPublishedTitle() throws Exception {
        UUID coursId = creerEtPublier();
        lu(coursId, "s1", alice).andExpect(status().isNoContent());
        attendreReprendre(alice);

        enregistrer(coursId, "Titre du brouillon"); // not republished

        mockMvc.perform(get("/api/progression/reprendre").with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("cours"))
                .andExpect(jsonPath("$.coursId").value(coursId.toString()))
                .andExpect(jsonPath("$.titre").value("Pythagore"))
                .andExpect(jsonPath("$.sectionsLues").value(1))
                .andExpect(jsonPath("$.sectionsTotal").value(2))
                .andExpect(jsonPath("$.niveauCode").doesNotExist());
    }

    @Test
    void givenACourseWithdrawnFromTheClassWhenTheStudentComesBackThenItIsNeverProposed() throws Exception {
        UUID coursId = creerEtPublier();
        lu(coursId, "s1", alice).andExpect(status().isNoContent());
        attendreReprendre(alice);

        definirPortees(coursId, "");

        mockMvc.perform(get("/api/progression/reprendre").with(alice)).andExpect(status().isNoContent());
    }

    @Test
    void givenAStudentWhoLeftHerClassWhenSheComesBackThenTheCourseIsNeverProposed() throws Exception {
        UUID coursId = creerEtPublier();
        lu(coursId, "s1", alice).andExpect(status().isNoContent());
        attendreReprendre(alice);

        inscriptions.deleteById(new InscriptionId(classeA.id(), aliceId));

        mockMvc.perform(get("/api/progression/reprendre").with(alice)).andExpect(status().isNoContent());
    }

    @Test
    void givenAChapterAndACourseInProgressThenReprendreProposesTheLatestRead() throws Exception {
        String chapitre = "chapitre-" + UUID.randomUUID();
        progression.enregistrerChapitre(new ChapitrePublie(
                chapitre, "3e", "mathematiques", 1, "published", 3, 0, "Les fractions"));
        progression.onSectionTerminee(new SectionTerminee(aliceId, chapitre, "s1", Instant.now().minusSeconds(3600)));
        UUID coursId = creerEtPublier();

        lu(coursId, "s1", alice).andExpect(status().isNoContent());
        attendreReprendre(alice); // the course was read last

        progression.onSectionTerminee(new SectionTerminee(aliceId, chapitre, "s2", Instant.now().plusSeconds(3600)));
        mockMvc.perform(get("/api/progression/reprendre").with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("chapitre"))
                .andExpect(jsonPath("$.chapitreId").value(chapitre));
    }

    // ── first attempt across versions (S3 I-2) ────────────────────────────────

    @Test
    void givenAMissOnVersionOneWhenSolvedOnVersionTwoThenItIsNotAFirstTry() throws Exception {
        UUID coursId = creerEtPublier();
        soumettre(exerciceId(coursId), "[\"droit\", \"côté\"]", alice); // wrong, on v1
        mockMvc.perform(post("/api/prof/cours/{id}/publier", coursId).with(teacher).with(csrf()))
                .andExpect(status().isOk()); // v2: new exercise UUIDs, same block id

        soumettre(exerciceId(coursId), "[\"côté\", \"droit\"]", alice); // right, on v2

        await().atMost(Duration.ofSeconds(10)).until(() -> jdbc.queryForObject(
                "SELECT coalesce(sum(points), 0) FROM progression.evenements_xp WHERE eleve_id = ? "
                        + "AND source_type = 'cours_exercice'", Integer.class, aliceId) > 0);
        assertThat(jdbc.queryForObject(
                "SELECT motif FROM progression.evenements_xp WHERE eleve_id = ? AND source_type = 'cours_exercice'",
                String.class, aliceId)).isEqualTo("reussi_apres_erreur");
    }

    @Test
    void givenAnExerciseOfAnOlderVersionOfAVisibleCourseThenItIsStillAnswerableAndCountsOnce() throws Exception {
        UUID coursId = creerEtPublier();
        String exerciceV1 = exerciceId(coursId); // a homework can pin this version
        mockMvc.perform(post("/api/prof/cours/{id}/publier", coursId).with(teacher).with(csrf()))
                .andExpect(status().isOk());
        assertThat(exerciceId(coursId)).isNotEqualTo(exerciceV1);

        soumettre(exerciceV1, "[\"côté\", \"droit\"]", alice);
        soumettre(exerciceId(coursId), "[\"côté\", \"droit\"]", alice);

        await().atMost(Duration.ofSeconds(10)).until(() -> jdbc.queryForObject(
                "SELECT count(*) FROM progression.cours_exercices_reussis WHERE eleve_id = ?", Integer.class,
                aliceId) == 1);
        assertThat(jdbc.queryForObject(
                "SELECT coalesce(sum(points), 0) FROM progression.evenements_xp WHERE eleve_id = ? "
                        + "AND source_type = 'cours_exercice'", Integer.class, aliceId)).isEqualTo(10);
    }

    @Test
    void givenAStudentOutOfScopeThenTheRefusalCarriesItsOwnCode() throws Exception {
        UUID coursId = creerEtPublier();
        mockMvc.perform(post("/api/exercices/{id}/soumissions", exerciceId(coursId)).with(bob).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answer\": {\"blanks\": [\"côté\", \"droit\"]}}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("cours_hors_portee"));
    }

    // ── S3: one visibility rule ───────────────────────────────────────────────

    @Test
    void givenCoursesInEveryStateThenTheCoursePageAndTitresVisiblesAlwaysAgree() throws Exception {
        UUID visible = creerEtPublier();
        UUID horsPortee = creerEtPublier();
        definirPortees(horsPortee, "");
        UUID brouillon = creerCours();

        Map<UUID, String> titres = coursAcces.titresVisiblesPourEleve(aliceId, Set.of(visible, horsPortee, brouillon));

        for (UUID coursId : new UUID[] {visible, horsPortee, brouillon}) {
            int statut = mockMvc.perform(get("/api/cours/{id}", coursId).with(alice))
                    .andReturn().getResponse().getStatus();
            assertThat(statut == 200).as("course %s", coursId).isEqualTo(titres.containsKey(coursId));
        }
        assertThat(titres).containsOnlyKeys(visible);
    }

    // ── amorce : rattrapage au démarrage ──────────────────────────────────────

    @Test
    void givenAPublishedCourseMissingFromTheProjectionWhenTheAppStartsThenItIsProjectedAgain() throws Exception {
        UUID coursId = creerEtPublier();
        await().atMost(Duration.ofSeconds(10)).until(() -> projete(coursId) == 2);
        jdbc.update("DELETE FROM progression.cours WHERE cours_id = ?", coursId); // as before ADR 0050

        Object amorce = context.getBean("coursProjectionAmorce");
        java.lang.reflect.Method amorcer = amorce.getClass().getMethod("amorcer");
        amorcer.setAccessible(true);
        amorcer.invoke(amorce);

        await().atMost(Duration.ofSeconds(10)).until(() -> projete(coursId) == 2);
        assertThat(jdbc.queryForList("SELECT cle FROM progression.cours_elements WHERE cours_id = ? AND nature = 'exercice'",
                String.class, coursId)).as("paper is not counted").containsExactly("ex-trous");
    }

    /** Number of sections projected for the course, 0 when it is not projected. */
    private int projete(UUID coursId) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM progression.cours_elements WHERE cours_id = ? AND nature = 'section'",
                Integer.class, coursId);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private org.springframework.test.web.servlet.ResultActions lu(UUID coursId, String section, RequestPostProcessor qui)
            throws Exception {
        return mockMvc.perform(post("/api/cours/{c}/sections/{s}/lu", coursId, section).with(qui).with(csrf()));
    }

    private void soumettre(String exerciceId, String blanks, RequestPostProcessor qui) throws Exception {
        mockMvc.perform(post("/api/exercices/{id}/soumissions", exerciceId).with(qui).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answer\": {\"blanks\": " + blanks + "}}"))
                .andExpect(status().isOk());
    }

    private void attendreReprendre(RequestPostProcessor qui) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                mockMvc.perform(get("/api/progression/reprendre").with(qui))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.type").value("cours")));
    }

    private UUID creerEtPublier() throws Exception {
        UUID coursId = creerCours();
        enregistrer(coursId, "Pythagore");
        definirPortees(coursId, "\"" + classeA.id() + "\"");
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

    private void enregistrer(UUID coursId, String titre) throws Exception {
        ObjectNode body = objectMapper.createObjectNode().put("titre", titre);
        body.set("content", content(titre));
        mockMvc.perform(put("/api/prof/cours/{id}", coursId).with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNoContent());
    }

    private void definirPortees(UUID coursId, String classeIds) throws Exception {
        mockMvc.perform(put("/api/prof/cours/{id}/portees", coursId).with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classeIds\":[" + classeIds + "]}"))
                .andExpect(status().isNoContent());
    }

    private String exerciceId(UUID coursId) throws Exception {
        JsonNode served = objectMapper.readTree(mockMvc.perform(get("/api/cours/{id}", coursId).with(alice))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        for (JsonNode block : served.path("sections").get(1).path("blocks")) {
            if ("ex-trous".equals(block.path("id").asText())) {
                return block.path("exerciceId").asText();
            }
        }
        throw new AssertionError("no ex-trous block");
    }

    private JsonNode content(String titre) throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-enseignant",
                  "title": "%s",
                  "sections": [
                    { "id": "s1", "title": "Leçon", "kind": "lesson", "blocks": [
                      { "id": "p1", "type": "prose", "text": "Dans un triangle rectangle…" }
                    ] },
                    { "id": "s2", "title": "Exercices", "kind": "exercises", "blocks": [
                      { "id": "ex-trous", "type": "exercise", "exerciseType": "fill-blank",
                        "prompt": "Complète la phrase.", "template": "Le {} opposé à l'angle {}.",
                        "bank": ["aigu", "côté", "droit"], "expected": ["côté", "droit"] },
                      { "id": "ex-feuille", "type": "exercise", "exerciseType": "paper",
                        "prompt": "Calcule l'hypoténuse.", "solution": "On applique Pythagore." }
                    ] }
                  ]
                }
                """.formatted(titre));
    }
}
