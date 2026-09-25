package fr.brio;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.EtablissementInfo;
import fr.brio.identite.domain.BaseLegale;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.StatutCompte;
import fr.brio.identite.infrastructure.CodeClasseRepository;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.InscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RejoindreClasseIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ClasseService classeService;
    @Autowired CompteRepository compteRepository;
    @Autowired CodeClasseRepository codeClasseRepository;
    @Autowired InscriptionRepository inscriptionRepository;

    private Compte adminCompte;
    private Compte enseignantCompte;
    private MockHttpSession adminSession;
    private MockHttpSession enseignantSession;

    private UUID classeId;
    private UUID etabId;
    private String rawCode;

    @BeforeEach
    void setup() throws Exception {
        adminCompte = compteRepository.save(
                Compte.creerAdminBrio("admin.brio.test", "{noop}admin123", "Admin Brio", "admin@brio.fr"));
        adminSession = login("admin.brio.test", "admin123");

        enseignantCompte = compteRepository.save(
                Compte.creerEnseignant("prof.test", "{noop}prof123", "Prof Test", "prof@test.fr"));
        enseignantSession = login("prof.test", "prof123");

        EtablissementInfo etab = classeService.creerEtablissement(
                "Collège Jean Valjean", null, "college",
                LocalDate.of(2026, 9, 1), "CONV-TEST-001");
        etabId = etab.id();

        var classe = classeService.creerClasse(etabId, "4e", "4e B", "2026-2027");
        classeId = classe.id();

        var code = classeService.genererCode(classeId, adminCompte.getId(), 14, 40);
        rawCode = code.code();
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    @Test
    void shouldCreateActifAccountAndInscriptionOnValidCode() throws Exception {
        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Léa"}
                                """.formatted(rawCode)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.identifiantConnexion").isNotEmpty())
                .andExpect(jsonPath("$.nomAffiche").value("Léa"))
                .andExpect(jsonPath("$.classeLibelle").value("4e B"));

        // Locate the élève created by this join via its inscription — filtering by the
        // freshly-created classeId isolates it from élèves committed by sibling tests.
        var inscription = inscriptionRepository.findAll().stream()
                .filter(i -> i.getId().classeId().equals(classeId) && i.getNomAffiche().equals("Léa"))
                .findFirst().orElseThrow();
        var compte = compteRepository.findById(inscription.getId().compteId()).orElseThrow();
        assertThat(compte.getStatut()).isEqualTo(StatutCompte.actif);
        assertThat(compte.getBaseLegale()).isEqualTo(BaseLegale.mission_etablissement);
        assertThat(compte.getEmailTitulaireLegal()).isNull();
    }

    @Test
    void shouldIncrementCodeUsageAfterSuccessfulJoin() throws Exception {
        int usagesBefore = codeClasseRepository.findByClasseId(classeId).orElseThrow().getUsages();

        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Tom"}
                                """.formatted(rawCode)))
                .andExpect(status().isCreated());

        assertThat(codeClasseRepository.findByClasseId(classeId).orElseThrow().getUsages())
                .isEqualTo(usagesBefore + 1);
    }

    @Test
    void shouldCreateInscription() throws Exception {
        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Zoé"}
                                """.formatted(rawCode)))
                .andExpect(status().isCreated());

        // Filter by the freshly-created classeId so élèves committed by sibling
        // (non-transactional) integration tests can't be mistaken for this join.
        assertThat(inscriptionRepository.findAll())
                .anyMatch(i -> i.getId().classeId().equals(classeId)
                               && i.getNomAffiche().equals("Zoé"));
    }

    @Test
    void identifiantConnexionReturnedOnceAtJoin() throws Exception {
        // ADR 0016 §4 + ADR 0018 §5: identifiantConnexion disclosed exactly once in EleveInscritInfo
        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Axel"}
                                """.formatted(rawCode)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.identifiantConnexion").isNotEmpty());
    }

    @Test
    void codeIsCaseAndSpaceInsensitive() throws Exception {
        String mixedCode = rawCode.toLowerCase().substring(0, 6) + " " + rawCode.substring(6);

        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Sam"}
                                """.formatted(mixedCode)))
                .andExpect(status().isCreated());
    }

    // ── Failure cases ─────────────────────────────────────────────────────────

    @Test
    void shouldReturn404OnUnknownCode() throws Exception {
        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"BADCODE12345","motDePasse":"monMotDePasse1","nomAffiche":"X"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturn403WhenEtablissementHasNoConvention() throws Exception {
        var etabSans = classeService.creerEtablissement(
                "École Sans Convention", null, "college", null, null);
        var classeSans = classeService.creerClasse(etabSans.id(), "5e", "5e A", "2026-2027");
        var codeSans = classeService.genererCode(classeSans.id(), adminCompte.getId(), 14, 40);

        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"Y"}
                                """.formatted(codeSans.code())))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn410WhenCodeExhausted() throws Exception {
        classeService.revoquerCode(classeId, adminCompte.getId(), true);
        var tightCode = classeService.genererCode(classeId, adminCompte.getId(), 14, 1);

        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse1","nomAffiche":"A1"}
                                """.formatted(tightCode.code())))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"monMotDePasse2","nomAffiche":"A2"}
                                """.formatted(tightCode.code())))
                .andExpect(status().isGone());
    }

    @Test
    void shouldReturn400WhenPasswordTooShort() throws Exception {
        mockMvc.perform(post("/api/classes/rejoindre")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","motDePasse":"court","nomAffiche":"Z"}
                                """.formatted(rawCode)))
                .andExpect(status().isBadRequest());
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @Test
    void shouldReturn201WhenAdminCreatesEtablissement() throws Exception {
        mockMvc.perform(post("/api/etablissements")
                        .session(adminSession)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Lycée Victor Hugo","type":"lycee",
                                 "conventionSigneeLe":"2026-09-01","conventionReference":"LVH-001"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pathAActif").value(true));
    }

    @Test
    void shouldReturn403WhenNonAdminTriesToCreateEtablissement() throws Exception {
        mockMvc.perform(post("/api/etablissements")
                        .session(enseignantSession)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Lycée Test","type":"lycee"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn201WhenAdminCreatesClasse() throws Exception {
        mockMvc.perform(post("/api/classes")
                        .session(adminSession)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etablissementId":"%s","niveauCode":"3e",
                                 "libelle":"3e C","anneeScolaire":"2026-2027"}
                                """.formatted(etabId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.libelle").value("3e C"));
    }

    @Test
    void shouldReturn403WhenNonAdminTriesToCreateClasse() throws Exception {
        mockMvc.perform(post("/api/classes")
                        .session(enseignantSession)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etablissementId":"%s","niveauCode":"3e",
                                 "libelle":"3e C","anneeScolaire":"2026-2027"}
                                """.formatted(etabId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn201WhenAdminGeneratesCode() throws Exception {
        classeService.revoquerCode(classeId, adminCompte.getId(), true);

        mockMvc.perform(post("/api/classes/{id}/codes", classeId)
                        .session(adminSession)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"expireDansJours":14,"usagesMax":30}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").isNotEmpty())
                .andExpect(jsonPath("$.usagesMax").value(30));
    }

    @Test
    void shouldReturn403WhenNonAdminTriesToGenerateCode() throws Exception {
        mockMvc.perform(post("/api/classes/{id}/codes", classeId)
                        .session(enseignantSession)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn204WhenAdminRevokesCode() throws Exception {
        mockMvc.perform(delete("/api/classes/{id}/codes/actif", classeId)
                        .session(adminSession)
                        .with(csrf()))
                .andExpect(status().isNoContent());

        assertThat(codeClasseRepository.findByClasseId(classeId)).isEmpty();
    }

    @Test
    void shouldReturn200WhenAdminReadsCodeInfo() throws Exception {
        mockMvc.perform(get("/api/classes/{id}/codes/actif", classeId)
                        .session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usages").value(0))
                .andExpect(jsonPath("$.usagesMax").value(40))
                .andExpect(jsonPath("$.code").doesNotExist());
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private MockHttpSession login(String identifiant, String motDePasse) throws Exception {
        var session = new MockHttpSession();
        mockMvc.perform(post("/api/sessions")
                        .session(session)
                        .contentType("application/x-www-form-urlencoded")
                        .param("identifiant", identifiant)
                        .param("mot_de_passe", motDePasse)
                        .with(csrf()))
                .andExpect(status().isOk());
        return session;
    }
}
