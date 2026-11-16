package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.EleveInscritInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.InscriptionRepository;
import fr.brio.identite.infrastructure.ReinitialisationAccesRepository;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

/**
 * Teacher-led recovery of a student's access to their EXISTING account (ADR 0036, #364):
 * authorisation, one-time provisional password, expiry, single use, no enumeration, the forced
 * password change, rate limit, audit — and the student keeps their account and class.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReinitialisationAccesIntegrationTest {

    private static final String MOT_DE_PASSE = "motdepasse123";
    private static final String NOUVEAU = "mon-nouveau-secret";
    private static final String PROVISOIRE = "^[23456789abcdefghjkmnpqrstuvwxyz]{4}(-[23456789abcdefghjkmnpqrstuvwxyz]{4}){2}$";
    // One CGNAT (100.64/10) /24 per test: the per-IP login rate limit never mixes tests.
    private static final AtomicInteger IP = new AtomicInteger(1);

    @Autowired MockMvc mockMvc;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired CompteRepository comptes;
    @Autowired InscriptionRepository inscriptions;
    @Autowired ReinitialisationAccesRepository traces;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;

    private String ip;
    private UUID etabId;
    private UUID profId;
    private RequestPostProcessor prof;
    private UUID classeId;
    private EleveInscritInfo eleve;

    @BeforeEach
    void setup() {
        ip = "100.64." + IP.getAndIncrement() + ".10";
        etabId = classeService.creerEtablissement(
                "Collège Reset", null, "college", LocalDate.now().minusYears(1), "CONV-RESET").id();
        profId = creerProf();
        prof = user(profId.toString()).roles("ENSEIGNANT");
        classeId = classeService.creerClassePourEnseignant(profId, etabId, "5e", "5e C").id();
        String code = classeService.genererCodePourEnseignant(classeId, profId).code();
        eleve = classeService.rejoindreParCode(code, MOT_DE_PASSE, "Inès");
    }

    private UUID creerProf() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return compteService.creerEnseignant(
                MOT_DE_PASSE, "Prof " + suffix, "prof-" + suffix + "@example.fr", etabId).id();
    }

    private String url(UUID classe, UUID compte) {
        return "/api/classes/" + classe + "/inscriptions/" + compte + "/reinitialisation-acces";
    }

    private JsonNode reinitialiser() throws Exception {
        String body = mockMvc.perform(post(url(classeId, eleve.id())).with(prof).with(csrf()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private MockHttpServletResponse connexion(String identifiant, String motDePasse) throws Exception {
        return mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", identifiant)
                        .param("mot_de_passe", motDePasse)
                        .with(r -> {
                            r.setRemoteAddr(ip);
                            return r;
                        })
                        .with(csrf()))
                .andReturn().getResponse();
    }

    private Cookie session(MockHttpServletResponse res) {
        assertThat(res.getStatus()).isEqualTo(200);
        return res.getCookie(SessionCookies.NAME);
    }

    // ── The reset itself ─────────────────────────────────────────────────────

    @Test
    void shouldGiveTheTeacherTheIdentifierAndAOneTimeProvisionalPasswordOnce() throws Exception {
        Instant avant = Instant.now();
        var res = mockMvc.perform(post(url(classeId, eleve.id())).with(prof).with(csrf()))
                .andExpect(status().isOk())
                // The password is in the body: never cached.
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.identifiantConnexion").value(eleve.identifiantConnexion()))
                .andReturn().getResponse();
        JsonNode body = json.readTree(res.getContentAsString());

        assertThat(body.get("motDePasseProvisoire").asText()).matches(PROVISOIRE);
        Instant expireLe = Instant.parse(body.get("expireLe").asText());
        assertThat(expireLe).isBetween(avant.plus(Duration.ofDays(7)).minusSeconds(5),
                Instant.now().plus(Duration.ofDays(7)));

        // Stored hashed, never in clear.
        Compte compte = comptes.findById(eleve.id()).orElseThrow();
        assertThat(compte.getMotDePasseHash()).doesNotContain(body.get("motDePasseProvisoire").asText());
        assertThat(compte.isDoitChangerMotDePasse()).isTrue();

        // Audit: who, whom, through which class, until when — no password.
        var trace = traces.findByCompteId(eleve.id());
        assertThat(trace).hasSize(1);
        assertThat(trace.get(0).getParCompteId()).isEqualTo(profId);
        assertThat(trace.get(0).getClasseId()).isEqualTo(classeId);
        assertThat(trace.get(0).getExpireLe()).isEqualTo(expireLe);
    }

    @Test
    void shouldKeepTheSameAccountAndClassAndStopTheOldPassword() throws Exception {
        String provisoire = reinitialiser().get("motDePasseProvisoire").asText();

        assertThat(connexion(eleve.identifiantConnexion(), MOT_DE_PASSE).getStatus()).isEqualTo(401);
        MockHttpServletResponse ok = connexion(eleve.identifiantConnexion(), provisoire);
        assertThat(ok.getStatus()).isEqualTo(200);
        assertThat(json.readTree(ok.getContentAsString()).get("id").asText()).isEqualTo(eleve.id().toString());
        // Still enrolled in the same class: no new account, progression and classes kept.
        assertThat(inscriptions.findByIdCompteId(eleve.id())).extracting(i -> i.getId().classeId())
                .containsExactly(classeId);
    }

    // ── Authorisation ────────────────────────────────────────────────────────

    @Test
    void shouldForbidATeacherWhoDoesNotRunTheStudentsClass() throws Exception {
        UUID autreProfId = creerProf();
        var autreProf = user(autreProfId.toString()).roles("ENSEIGNANT");
        UUID autreClasse = classeService.creerClassePourEnseignant(autreProfId, etabId, "5e", "5e D").id();

        // Through the student's class: not theirs.
        mockMvc.perform(post(url(classeId, eleve.id())).with(autreProf).with(csrf()))
                .andExpect(status().isForbidden());
        // Through their own class: the student is not in it.
        mockMvc.perform(post(url(autreClasse, eleve.id())).with(autreProf).with(csrf()))
                .andExpect(status().isNotFound());
        assertThat(traces.findByCompteId(eleve.id())).isEmpty();
        assertThat(comptes.findById(eleve.id()).orElseThrow().isDoitChangerMotDePasse()).isFalse();
    }

    @Test
    void shouldForbidAStudent() throws Exception {
        mockMvc.perform(post(url(classeId, eleve.id()))
                        .with(user(eleve.id().toString()).roles("ELEVE")).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldLetAdminBrioResetAnEnrolledStudent() throws Exception {
        Compte admin = comptes.save(Compte.creerAdminBrio(
                "admin-" + UUID.randomUUID(), "{noop}x", "Admin", "admin-" + UUID.randomUUID() + "@brio.fr"));
        mockMvc.perform(post(url(classeId, eleve.id()))
                        .with(user(admin.getId().toString()).roles("ADMIN_BRIO")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identifiantConnexion").value(eleve.identifiantConnexion()));
    }

    @Test
    void shouldRateLimitResetsOfTheSameStudent() throws Exception {
        for (int i = 0; i < 5; i++) {
            reinitialiser();
        }
        mockMvc.perform(post(url(classeId, eleve.id())).with(prof).with(csrf()))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldCloseTheStudentsOpenSessions() throws Exception {
        Cookie avant = session(connexion(eleve.identifiantConnexion(), MOT_DE_PASSE));
        mockMvc.perform(get("/api/moi").cookie(avant)).andExpect(status().isOk());

        reinitialiser();

        mockMvc.perform(get("/api/moi").cookie(avant)).andExpect(status().isUnauthorized());
    }

    // ── Single use, expiry, no enumeration ──────────────────────────────────

    @Test
    void shouldAcceptTheProvisionalPasswordOnlyOnce() throws Exception {
        String provisoire = reinitialiser().get("motDePasseProvisoire").asText();
        String mauvais = connexion(eleve.identifiantConnexion(), "pas-le-bon").getContentAsString();

        assertThat(connexion(eleve.identifiantConnexion(), provisoire).getStatus()).isEqualTo(200);

        MockHttpServletResponse seconde = connexion(eleve.identifiantConnexion(), provisoire);
        assertThat(seconde.getStatus()).isEqualTo(401);
        assertThat(seconde.getContentAsString()).isEqualTo(mauvais);
    }

    @Test
    void shouldRefuseAnExpiredProvisionalPasswordExactlyLikeAWrongPassword() throws Exception {
        String provisoire = reinitialiser().get("motDePasseProvisoire").asText();
        em.flush();
        jdbc.update("UPDATE identite.comptes SET mot_de_passe_provisoire_expire_le = now() - interval '1 minute' "
                + "WHERE id = ?", eleve.id());
        em.clear();

        MockHttpServletResponse expire = connexion(eleve.identifiantConnexion(), provisoire);
        MockHttpServletResponse mauvais = connexion(eleve.identifiantConnexion(), "pas-le-bon");
        MockHttpServletResponse inconnu = connexion("inconnu-" + UUID.randomUUID(), provisoire);

        assertThat(expire.getStatus()).isEqualTo(401).isEqualTo(mauvais.getStatus()).isEqualTo(inconnu.getStatus());
        assertThat(expire.getContentAsString())
                .isEqualTo(mauvais.getContentAsString())
                .isEqualTo(inconnu.getContentAsString());
        assertThat(expire.getContentType()).isEqualTo(mauvais.getContentType());
        assertThat(expire.getCookie(SessionCookies.NAME)).isNull();
    }

    // ── The forced password change ──────────────────────────────────────────

    @Test
    void shouldHoldTheSessionToThePasswordChangeThenLetTheStudentIn() throws Exception {
        String provisoire = reinitialiser().get("motDePasseProvisoire").asText();
        MockHttpServletResponse login = connexion(eleve.identifiantConnexion(), provisoire);
        assertThat(json.readTree(login.getContentAsString()).get("doitChangerMotDePasse").asBoolean()).isTrue();
        Cookie cookie = session(login);

        // Everything but /api/moi and the change itself is refused while the change is pending.
        mockMvc.perform(get("/api/moi").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.doitChangerMotDePasse").value(true));
        mockMvc.perform(get("/api/moi/classes").cookie(cookie)).andExpect(status().isForbidden());

        // Too short, or the provisional password again: refused, nothing changes.
        changer(cookie, "court").andExpect(status().isBadRequest());
        changer(cookie, provisoire).andExpect(status().isUnprocessableEntity());

        changer(cookie, NOUVEAU).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/moi").cookie(cookie))
                .andExpect(jsonPath("$.doitChangerMotDePasse").value(false));
        mockMvc.perform(get("/api/moi/classes").cookie(cookie)).andExpect(status().isOk());

        // Only the student's own password opens the account now.
        assertThat(connexion(eleve.identifiantConnexion(), provisoire).getStatus()).isEqualTo(401);
        assertThat(connexion(eleve.identifiantConnexion(), NOUVEAU).getStatus()).isEqualTo(200);
    }

    @Test
    void shouldRefuseAPasswordChangeWhenNoneIsPending() throws Exception {
        Cookie cookie = session(connexion(eleve.identifiantConnexion(), MOT_DE_PASSE));
        changer(cookie, NOUVEAU).andExpect(status().isConflict());
        assertThat(connexion(eleve.identifiantConnexion(), MOT_DE_PASSE).getStatus()).isEqualTo(200);
    }

    @Test
    void shouldClearALockoutSoTheFirstTryWorks() throws Exception {
        for (int i = 0; i < 5; i++) {
            connexion(eleve.identifiantConnexion(), "pas-le-bon");
        }
        assertThat(connexion(eleve.identifiantConnexion(), MOT_DE_PASSE).getStatus()).isEqualTo(423);

        String provisoire = reinitialiser().get("motDePasseProvisoire").asText();

        assertThat(connexion(eleve.identifiantConnexion(), provisoire).getStatus()).isEqualTo(200);
    }

    private org.springframework.test.web.servlet.ResultActions changer(Cookie cookie, String nouveau)
            throws Exception {
        return mockMvc.perform(post("/api/moi/mot-de-passe").cookie(cookie).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("nouveauMotDePasse", nouveau))));
    }
}
