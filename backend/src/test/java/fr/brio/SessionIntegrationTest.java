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
import org.springframework.mock.web.MockHttpSession;
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
        var session = new MockHttpSession();

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "prof.test")
                        .param("mot_de_passe", "motdepasse")
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/moi").session(session))
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
        var session = new MockHttpSession();

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "prof.test")
                        .param("mot_de_passe", "motdepasse")
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/sessions").session(session).with(csrf()))
                .andExpect(status().isNoContent());

        // Session should be invalidated
        mockMvc.perform(get("/api/moi").session(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldExpireSessionCookieOnLogout() throws Exception {
        var session = new MockHttpSession();

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "prof.test")
                        .param("mot_de_passe", "motdepasse")
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        // The browser must drop the cookie: the web middleware only checks its presence.
        mockMvc.perform(delete("/api/sessions").session(session).with(csrf()))
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
        var session = new MockHttpSession();

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "prof.test")
                        .param("mot_de_passe", "motdepasse")
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/sessions").session(session))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/moi").session(session))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn401OnMoiWithoutSession() throws Exception {
        mockMvc.perform(get("/api/moi"))
                .andExpect(status().isUnauthorized());
    }
}
