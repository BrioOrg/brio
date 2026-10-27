package fr.brio;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SessionIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired CompteRepository compteRepository;

    private Compte enseignant;
    private Compte eleveEnAttente;

    @BeforeEach
    void seedComptes() {
        // {noop} prefix: DelegatingPasswordEncoder skips BCrypt — fast in tests
        enseignant = compteRepository.save(
                Compte.creerEnseignant("prof.test", "{noop}motdepasse", "Dupont", "prof@test.fr"));

        eleveEnAttente = compteRepository.save(
                Compte.creerEleve("eleve.test", "{noop}motdepasse", "parent@test.fr", "4e"));
    }

    @Test
    void shouldLoginAndReturnCompteInfo() throws Exception {
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "prof.test")
                        .param("mot_de_passe", "motdepasse")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("enseignant"))
                .andExpect(jsonPath("$.statut").value("actif"))
                .andExpect(jsonPath("$.nom").value("Dupont"))
                // identifiant_connexion must never appear (ADR 0016 §4)
                .andExpect(jsonPath("$.identifiantConnexion").doesNotExist());
    }

    @Test
    void shouldLoginWithEmailWhateverItsCase() throws Exception {
        // prof.test predates e-mail logins: its identifiant is not its e-mail.
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "Prof@Test.fr")
                        .param("mot_de_passe", "motdepasse")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("enseignant"));
    }

    @Test
    void shouldNotLoginWithAParentEmail() throws Exception {
        // email_titulaire_legal is a contact address, never a login.
        eleveEnAttente.activer();
        compteRepository.save(eleveEnAttente);

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "parent@test.fr")
                        .param("mot_de_passe", "motdepasse")
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturnCurrentUserOnMoi() throws Exception {
        var session = SessionCookies.login(mockMvc, "prof.test", "motdepasse");

        mockMvc.perform(get("/api/moi").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    void shouldReturn401ForWrongPassword() throws Exception {
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "prof.test")
                        .param("mot_de_passe", "mauvais_mot_de_passe")
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldLockIdentifiantAfterFiveFailedAttempts() throws Exception {
        for (int i = 0; i < 5; i++) {
            tenterConnexion("prof.test", "mauvais").andExpect(status().isUnauthorized());
        }
        // Even the right password is refused while locked — and the lock is checked before it.
        tenterConnexion("prof.test", "motdepasse").andExpect(status().isLocked());
    }

    @Test
    void shouldClearTheLockoutCounterOnSuccessfulLogin() throws Exception {
        for (int i = 0; i < 4; i++) {
            tenterConnexion("prof.test", "mauvais").andExpect(status().isUnauthorized());
        }
        // A success before the threshold resets the counter...
        tenterConnexion("prof.test", "motdepasse").andExpect(status().isOk());
        // ...so four more failures still do not lock (would be the 8th failure without the reset).
        for (int i = 0; i < 4; i++) {
            tenterConnexion("prof.test", "mauvais").andExpect(status().isUnauthorized());
        }
        tenterConnexion("prof.test", "motdepasse").andExpect(status().isOk());
    }

    @Test
    void shouldRateLimitPerIpRegardlessOfLockout() throws Exception {
        // Distinct unknown identifiants so no single one locks: this isolates the per-IP cap (20/min).
        for (int i = 0; i < 20; i++) {
            tenterConnexion("inconnu" + i, "peu-importe").andExpect(status().isUnauthorized());
        }
        tenterConnexion("inconnu-de-trop", "peu-importe").andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldReturn401ForEleveEnAttenteConsentement() throws Exception {
        // en_attente_consentement accounts must not be able to authenticate (ADR 0016 §5)
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "eleve.test")
                        .param("mot_de_passe", "motdepasse")
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldLogout() throws Exception {
        var session = SessionCookies.login(mockMvc, "prof.test", "motdepasse");

        mockMvc.perform(delete("/api/sessions").cookie(session).with(csrf()))
                .andExpect(status().isNoContent());

        // Session should be invalidated
        mockMvc.perform(get("/api/moi").cookie(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldExpireSessionCookieOnLogout() throws Exception {
        var session = SessionCookies.login(mockMvc, "prof.test", "motdepasse");

        // The browser must drop the cookie: the web middleware only checks its presence.
        mockMvc.perform(delete("/api/sessions").cookie(session).with(csrf()))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("JSESSIONID", 0));
    }

    @Test
    void shouldLogoutWithoutSession() throws Exception {
        // Idempotent: a session that already expired must not make the logout button fail.
        mockMvc.perform(delete("/api/sessions").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void shouldRejectLogoutWithoutCsrfTokenAndKeepSession() throws Exception {
        var session = SessionCookies.login(mockMvc, "prof.test", "motdepasse");

        mockMvc.perform(delete("/api/sessions").cookie(session))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/moi").cookie(session))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn401OnMoiWithoutSession() throws Exception {
        mockMvc.perform(get("/api/moi"))
                .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions tenterConnexion(String identifiant,
                                                                               String motDePasse) throws Exception {
        return mockMvc.perform(post("/api/sessions")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("identifiant", identifiant)
                .param("mot_de_passe", motDePasse)
                .with(csrf()));
    }
}
