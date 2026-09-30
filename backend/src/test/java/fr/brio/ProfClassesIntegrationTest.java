package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.domain.AnneeScolaire;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

/**
 * Teacher self-service (ADR 0029): a teacher picks among existing établissements, creates
 * their own classes and generates their codes — and can do none of it for anyone else.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ProfClassesIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired CompteRepository compteRepository;
    @Autowired ObjectMapper objectMapper;

    private UUID etabConventionne;
    private UUID autreEtab;
    private UUID enseignantId;
    private RequestPostProcessor enseignant;

    @BeforeEach
    void setup() {
        etabConventionne = classeService.creerEtablissement(
                "Collège Pilote", null, "college", LocalDate.of(2026, 9, 1), "CONV-TEST").id();
        autreEtab = classeService.creerEtablissement(
                "Lycée Voisin", null, "lycee", null, null).id();
        enseignantId = creerEnseignant(etabConventionne);
        enseignant = user(enseignantId.toString()).roles("ENSEIGNANT");
    }

    private UUID creerEnseignant(UUID etablissementId) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return compteService.creerEnseignant(
                "motdepasse123", "Prof " + suffix, "prof-" + suffix + "@example.fr", etablissementId).id();
    }

    private String creerClasse(RequestPostProcessor qui, UUID etablissementId) throws Exception {
        String json = mockMvc.perform(post("/api/prof/classes").with(qui).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etablissementId":"%s","niveauCode":"4e","libelle":"4e B"}
                                """.formatted(etablissementId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asText();
    }

    // ── Établissements ────────────────────────────────────────────────────────

    @Test
    void shouldListEtablissementsPubliclyWithoutConventionFields() throws Exception {
        mockMvc.perform(get("/api/etablissements"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '%s')].nom".formatted(etabConventionne))
                        .value("Collège Pilote"))
                .andExpect(jsonPath("$[0].conventionReference").doesNotExist())
                .andExpect(jsonPath("$[0].conventionSigneeLe").doesNotExist())
                .andExpect(jsonPath("$[0].uai").doesNotExist());
    }

    @Test
    void shouldNotLetATeacherCreateAnEtablissement() throws Exception {
        mockMvc.perform(post("/api/etablissements").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Mon collège","type":"college"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldLetATeacherJoinASecondEtablissement() throws Exception {
        mockMvc.perform(post("/api/prof/etablissements").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"etablissementId\":\"" + autreEtab + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nom").value("Lycée Voisin"));

        // Joining twice changes nothing.
        mockMvc.perform(post("/api/prof/etablissements").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"etablissementId\":\"" + autreEtab + "\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/prof/etablissements").with(enseignant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void shouldReturn404WhenJoiningAnUnknownEtablissement() throws Exception {
        mockMvc.perform(post("/api/prof/etablissements").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"etablissementId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isNotFound());
    }

    // ── Classes ───────────────────────────────────────────────────────────────

    @Test
    void shouldCreateAClassOwnedByTheCallerForTheCurrentSchoolYear() throws Exception {
        mockMvc.perform(post("/api/prof/classes").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etablissementId":"%s","niveauCode":"4e","libelle":"4e B"}
                                """.formatted(etabConventionne)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.libelle").value("4e B"))
                .andExpect(jsonPath("$.enseignantPrincipalId").value(enseignantId.toString()))
                .andExpect(jsonPath("$.anneeScolaire").value(AnneeScolaire.du(LocalDate.now())));

        mockMvc.perform(get("/api/prof/classes").with(enseignant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void shouldRefuseAClassInAnEtablissementTheTeacherDoesNotBelongTo() throws Exception {
        mockMvc.perform(post("/api/prof/classes").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etablissementId":"%s","niveauCode":"2de","libelle":"2de 3"}
                                """.formatted(autreEtab)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRejectABlankLibelle() throws Exception {
        mockMvc.perform(post("/api/prof/classes").with(enseignant).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etablissementId":"%s","niveauCode":"4e","libelle":" "}
                                """.formatted(etabConventionne)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReserveClassCreationToTeachers() throws Exception {
        Compte admin = compteRepository.save(
                Compte.creerAdminBrio("admin.prof-classes", "{noop}x", "Admin", "admin-pc@brio.fr"));
        String body = """
                {"etablissementId":"%s","niveauCode":"4e","libelle":"4e B"}
                """.formatted(etabConventionne);

        mockMvc.perform(post("/api/prof/classes").with(user(admin.getId().toString()).roles("ADMIN_BRIO"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/prof/classes").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
    }

    // ── Codes ─────────────────────────────────────────────────────────────────

    @Test
    void shouldNotGenerateACodeForSomeoneElsesClass() throws Exception {
        String classeId = creerClasse(enseignant, etabConventionne);
        UUID intrus = creerEnseignant(etabConventionne);

        mockMvc.perform(post("/api/prof/classes/{id}/code", classeId)
                        .with(user(intrus.toString()).roles("ENSEIGNANT")).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn404WhenGeneratingACodeForAnUnknownClass() throws Exception {
        mockMvc.perform(post("/api/prof/classes/{id}/code", UUID.randomUUID())
                        .with(enseignant).with(csrf()))
                .andExpect(status().isNotFound());
    }

    // ── The whole chain, with no administrator ────────────────────────────────

    @Test
    void shouldTakeATeacherFromSignupToAStudentInTheirClass() throws Exception {
        String classeId = creerClasse(enseignant, etabConventionne);

        String codeJson = mockMvc.perform(post("/api/prof/classes/{id}/code", classeId)
                        .with(enseignant).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usagesMax").value(40))
                .andReturn().getResponse().getContentAsString();
        String code = objectMapper.readTree(codeJson).get("code").asText();
        assertThat(code).hasSize(12);

        String eleveJson = mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Léa"}
                                """.formatted(code)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String eleveId = objectMapper.readTree(eleveJson).get("id").asText();

        mockMvc.perform(get("/api/classes/{id}/codes/actif", classeId).with(enseignant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usages").value(1));

        mockMvc.perform(get("/api/classes/{id}/inscriptions", classeId).with(enseignant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nomAffiche").value("Léa"));

        mockMvc.perform(patch("/api/classes/{id}/inscriptions/{compteId}", classeId, eleveId)
                        .with(enseignant).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nomAffiche\":\"Léa B.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomAffiche").value("Léa B."));
    }

    @Test
    void shouldKeepTheConventionGateOnATeacherGeneratedCode() throws Exception {
        UUID prof = creerEnseignant(autreEtab);
        RequestPostProcessor qui = user(prof.toString()).roles("ENSEIGNANT");
        String classeId = creerClasse(qui, autreEtab);
        String codeJson = mockMvc.perform(post("/api/prof/classes/{id}/code", classeId).with(qui).with(csrf()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Tom"}
                                """.formatted(objectMapper.readTree(codeJson).get("code").asText())))
                .andExpect(status().isForbidden());
    }
}
