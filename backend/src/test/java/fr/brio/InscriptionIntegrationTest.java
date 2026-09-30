package fr.brio;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.domain.StatutCompte;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class InscriptionIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired CompteRepository compteRepository;

    @Test
    void shouldCreateEnseignantAndReturnActif() throws Exception {
        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasse":"motdepasse123",
                                 "nom":"Martin",
                                 "email":"Prof.Martin@ecole.fr"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("enseignant"))
                .andExpect(jsonPath("$.statut").value("actif"))
                .andExpect(jsonPath("$.nom").value("Martin"))
                .andExpect(jsonPath("$.email").value("prof.martin@ecole.fr"))
                .andExpect(jsonPath("$.identifiantConnexion").doesNotExist());

        // No identifiant to choose: the normalised e-mail is the login.
        var compte = compteRepository.findByIdentifiantConnexion("prof.martin@ecole.fr");
        assertThat(compte).isPresent();
        assertThat(compte.get().getStatut()).isEqualTo(StatutCompte.actif);
    }

    @Test
    void shouldLetANewEnseignantLogInWithTheirEmail() throws Exception {
        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasse":"motdepasse123",
                                 "nom":"Leroy",
                                 "email":"leroy@ecole.fr"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", "leroy@ecole.fr")
                        .param("mot_de_passe", "motdepasse123")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("enseignant"));
    }

    @Test
    void shouldReturn409OnDuplicateEmail() throws Exception {
        String body = """
                {"motDePasse":"motdepasse123",
                 "nom":"Dupont",
                 "email":"dupont@ecole.fr"}
                """;

        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldReturn409WhenEmailDiffersOnlyByCase() throws Exception {
        // An account created before e-mail became the login: its identifiant is not its e-mail.
        compteRepository.save(
                Compte.creerEnseignant("prof.ancien", "{noop}motdepasse", "Ancien", "Ancien@ecole.fr"));

        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasse":"motdepasse123",
                                 "nom":"Autre",
                                 "email":"ancien@ECOLE.fr"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldReturn400WhenPasswordTooShort() throws Exception {
        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasse":"court",
                                 "nom":"X",
                                 "email":"x@ecole.fr"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn400WhenEmailInvalid() throws Exception {
        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasse":"motdepasse123",
                                 "nom":"Y",
                                 "email":"pas-un-email"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
