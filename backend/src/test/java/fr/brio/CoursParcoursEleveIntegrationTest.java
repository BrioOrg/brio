package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.ClasseInfo;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CoursParcoursEleveIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;

    private RequestPostProcessor teacher;
    private RequestPostProcessor student;
    private RequestPostProcessor autreEleve;
    private RequestPostProcessor autreProf;
    private RequestPostProcessor camarade;
    private UUID studentId;
    private UUID autreProfId;
    private ClasseInfo classe;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();

        var etab = classeService.creerEtablissement(
                "Collège Test", null, "college", LocalDate.now().minusYears(1), "CONV-2025");
        classe = classeService.creerClasse(etab.id(), "3e", "3e A", "2025-2026", null);

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID teacherId = compteService.creerEnseignant(
                "motdepasse123", "Prof " + suffix, "prof-" + suffix + "@example.fr", etab.id()).id();
        classeService.assignerEnseignantPrincipal(classe.id(), teacherId);
        teacher = user(teacherId.toString()).roles("ENSEIGNANT");

        var code = classeService.genererCode(classe.id(), teacherId, 14, 40);
        studentId = classeService.rejoindreParCode(code.code(), "motdepasse123", "Alice").id();
        student = user(studentId.toString()).roles("ELEVE");
        camarade = user(classeService.rejoindreParCode(code.code(), "motdepasse123", "Camille").id().toString())
                .roles("ELEVE");

        autreProfId = compteService.creerEnseignant(
                "motdepasse123", "Autre professeur", "autre-" + suffix + "@example.fr", etab.id()).id();
        autreProf = user(autreProfId.toString()).roles("ENSEIGNANT");
        var autreClasse = classeService.creerClasse(etab.id(), "3e", "3e B", "2025-2026", null);
        classeService.assignerEnseignantPrincipal(autreClasse.id(), autreProfId);
        var autreCode = classeService.genererCode(autreClasse.id(), autreProfId, 14, 40);
        autreEleve = user(classeService.rejoindreParCode(autreCode.code(), "motdepasse123", "Bob").id().toString())
                .roles("ELEVE");
    }

    @Test
    void unePhotoEstUneCopiePriveeEtLeRetourEstPubliePourSonAuteur() throws Exception {
        UUID coursId = creerEtPublier(content(fillBlank("[\"côté\", \"droit\"]")));
        String id = creerRedige(exerciceRedigePourRevue(coursId, true));
        publierRedige(id);
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isOk()).andExpect(jsonPath("$.modeCorrection").value("enseignant"))
                .andExpect(jsonPath("$.corrige").doesNotExist()).andExpect(jsonPath("$.copieModele").doesNotExist());

        remettrePhoto(id, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.soumission.photo").value(true))
                .andExpect(jsonPath("$.soumission.correct").doesNotExist())
                .andExpect(jsonPath("$.soumission.retour").doesNotExist())
                .andExpect(jsonPath("$.corrige").value("Justifier chaque étape avec une propriété."))
                .andExpect(jsonPath("$.copieModele").value("On énonce puis on applique la propriété."));

        byte[] cleaned = mockMvc.perform(get("/api/exercices-rediges/{id}/photo", id).with(student))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("Cache-Control", "no-store, private"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(ImageIO.read(new ByteArrayInputStream(cleaned)).getWidth()).isEqualTo(3);
        mockMvc.perform(get("/api/exercices-rediges/{id}/photo", id).with(camarade))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/exercices-rediges/{id}/photo", id).with(autreEleve))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/exercices-rediges/{id}/photo", id))
                .andExpect(status().isUnauthorized());

        String review = "/api/prof/exercices-rediges/{id}/copies";
        mockMvc.perform(get(review, id).with(teacher))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].eleveId").value(studentId.toString()))
                .andExpect(jsonPath("$[0].nomAffiche").value("Alice"));
        mockMvc.perform(get(review + "/{eleveId}/photo", id, studentId).with(autreProf))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(review + "/{eleveId}/photo", id, studentId).with(teacher))
                .andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options", "nosniff"));

        String feedback = "Pense à préciser la propriété appliquée.";
        String json = objectMapper.createObjectNode().put("commentaire", feedback).toString();
        mockMvc.perform(put(review + "/{eleveId}/retour", id, studentId).with(autreProf).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(review + "/{eleveId}/retour", id, studentId).with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andExpect(jsonPath("$.retour.commentaire").value(feedback));
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isOk()).andExpect(jsonPath("$.soumission.retour.commentaire").value(feedback));
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(camarade))
                .andExpect(status().isOk()).andExpect(jsonPath("$.soumission").doesNotExist())
                .andExpect(jsonPath("$.corrige").doesNotExist());

        classeService.assignerEnseignantPrincipal(classe.id(), autreProfId);
        mockMvc.perform(get(review + "/{eleveId}/photo", id, studentId).with(teacher))
                .andExpect(status().isForbidden());
    }

    @Test
    void laPhotoEstRefuseeHorsDesExercicesQuiLAutorisent() throws Exception {
        UUID coursId = creerEtPublier(content(fillBlank("[\"côté\", \"droit\"]")));
        String automatic = creerRedige(exerciceRedige(coursId));
        publierRedige(automatic);
        remettrePhoto(automatic, "2x+2").andExpect(status().isUnprocessableEntity());

        ObjectNode definition = exerciceRedigePourRevue(coursId, false);
        definition.remove("copieModele");
        String review = creerRedige(definition);
        publierRedige(review);
        remettrePhoto(review, "Le raisonnement.").andExpect(status().isUnprocessableEntity());
        remettreRedige(review, "On cite et applique la propriété.").andExpect(status().isOk())
                .andExpect(jsonPath("$.soumission.reponse").value("On cite et applique la propriété."))
                .andExpect(jsonPath("$.copieModele").doesNotExist())
                .andExpect(jsonPath("$.soumission.photo").value(false))
                .andExpect(jsonPath("$.soumission.correct").doesNotExist());
    }

    @Test
    void redigePublieSaCopieUneSeuleFoisEtMasqueLeCorrigeAvantRemise() throws Exception {
        UUID coursId = creerEtPublier(content(fillBlank("[\"côté\", \"droit\"]")));
        ObjectNode definition = exerciceRedige(coursId).put("corrige", "");
        String id = creerRedige(definition);
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/prof/exercices-rediges/{id}/publier", id).with(teacher).with(csrf()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("CORRIGE_INCOMPLET"));
        definition.put("corrige", "La dérivée est $2x + 2$.");
        mockMvc.perform(put("/api/prof/exercices-rediges/{id}", id).with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(definition.toString()))
                .andExpect(status().isOk());
        publierRedige(id);

        mockMvc.perform(get("/api/exercices-rediges").param("coursId", coursId.toString()).with(student))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(autreEleve))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(teacher))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reponseAttendue").doesNotExist())
                .andExpect(jsonPath("$.corrige").doesNotExist());
        remettreRedige(id, "(x").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("FORMULE_ILLISIBLE"));
        remettreRedige(id, "sin(x)").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("FORMULE_HORS_DOMAINE"));

        try (var threads = Executors.newFixedThreadPool(2)) {
            var first = threads.submit(() -> resultatRedige(id, "2(x+1)"));
            var second = threads.submit(() -> resultatRedige(id, "2x+2"));
            var remise = first.get(10, TimeUnit.SECONDS);
            assertThat(remise.path("soumission").path("correct").asBoolean()).isTrue();
            assertThat(second.get(10, TimeUnit.SECONDS).path("soumission")).isEqualTo(remise.path("soumission"));
            var relu = objectMapper.readTree(mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertThat(relu.path("soumission")).isEqualTo(remise.path("soumission"));
            assertThat(relu.path("corrige").asText()).isEqualTo("La dérivée est $2x + 2$.");
        }
    }

    @Test
    void seulLeProfesseurAuteurPeutOuvrirLeCorrigeEnCloturant() throws Exception {
        UUID coursId = creerEtPublier(content(fillBlank("[\"côté\", \"droit\"]")));
        String id = creerRedige(exerciceRedige(coursId).put("echeance", Instant.now().plus(1, ChronoUnit.DAYS).toString()));
        publierRedige(id);
        mockMvc.perform(post("/api/prof/exercices-rediges/{id}/cloturer", id).with(autreProf).with(csrf()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isOk()).andExpect(jsonPath("$.corrige").doesNotExist());
        mockMvc.perform(post("/api/prof/exercices-rediges/{id}/cloturer", id).with(teacher).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cloture").value(true));
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isOk()).andExpect(jsonPath("$.corrige").exists())
                .andExpect(jsonPath("$.soumission").doesNotExist());
        remettreRedige(id, "2x+2").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCICE_CLOS"));
    }

    @Test
    void unExerciceDuCatalogueNeReveleLeCorrigeQuApresLaRemise() throws Exception {
        var file = Path.of("../content/chapitres/5e/mathematiques/developper-reduire.json");
        var chapter = objectMapper.readTree(Files.readString(file));
        chapitreIngestor.ingestDocument(chapter, "5e", "mathematiques", 0);
        var list = objectMapper.readTree(mockMvc.perform(get("/api/exercices-rediges")
                        .param("niveau", "5e").param("matiere", "mathematiques")
                        .param("slug", "developper-reduire").with(student))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String id = list.get(0).path("id").asText();
        mockMvc.perform(get("/api/exercices-rediges/{id}", id).with(student))
                .andExpect(status().isOk()).andExpect(jsonPath("$.echeance").doesNotExist())
                .andExpect(jsonPath("$.corrige").doesNotExist());
        remettreRedige(id, "2(2x+3)").andExpect(status().isOk())
                .andExpect(jsonPath("$.soumission.correct").value(true))
                .andExpect(jsonPath("$.corrige").exists());
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
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.violations[0].code").value("ANSWER_NOT_IN_BANK"))
                .andExpect(jsonPath("$.violations[0].field").value("bank"))
                .andExpect(jsonPath("$.violations[0].blockId").isNotEmpty());
    }

    // --- HTTP steps --------------------------------------------------------------

    private ObjectNode exerciceRedige(UUID coursId) {
        return objectMapper.createObjectNode().put("coursId", coursId.toString())
                .put("titre", "Dériver un polynôme").put("enonce", "Calcule la dérivée de x² + 2x.")
                .put("reponseAttendue", "2x+2").put("corrige", "La dérivée est $2x + 2$.");
    }

    private ObjectNode exerciceRedigePourRevue(UUID coursId, boolean photoAutorisee) {
        return objectMapper.createObjectNode().put("coursId", coursId.toString())
                .put("titre", "Rédiger une justification").put("enonce", "Rédige une justification.")
                .put("modeCorrection", "enseignant").put("photoAutorisee", photoAutorisee)
                .put("corrige", "Justifier chaque étape avec une propriété.")
                .put("copieModele", "On énonce puis on applique la propriété.");
    }

    private ResultActions remettrePhoto(String id, String reponse) throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var request = multipart("/api/exercices-rediges/{id}/soumission-photo", id)
                .file(new MockMultipartFile("photo", "copie.png", "image/png", bytes.toByteArray()))
                .param("version", "1");
        if (reponse != null) {
            request.param("reponse", reponse);
        }
        return mockMvc.perform(request.with(student).with(csrf()));
    }

    private String creerRedige(ObjectNode definition) throws Exception {
        var body = mockMvc.perform(post("/api/prof/exercices-rediges").with(teacher).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(definition.toString()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("id").asText();
    }

    private void publierRedige(String id) throws Exception {
        mockMvc.perform(post("/api/prof/exercices-rediges/{id}/publier", id).with(teacher).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publie").value(true));
    }

    private ResultActions remettreRedige(String id, String reponse) throws Exception {
        var body = objectMapper.createObjectNode().put("version", 1).put("reponse", reponse);
        return mockMvc.perform(post("/api/exercices-rediges/{id}/soumission", id).with(student).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body.toString()));
    }

    private JsonNode resultatRedige(String id, String reponse) throws Exception {
        return objectMapper.readTree(remettreRedige(id, reponse).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

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
