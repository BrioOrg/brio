package fr.brio;

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
                                {"identifiantConnexion":"prof.martin",
                                 "motDePasse":"motdepasse123",
                                 "nom":"Martin",
                                 "email":"prof.martin@ecole.fr"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("enseignant"))
                .andExpect(jsonPath("$.statut").value("actif"))
                .andExpect(jsonPath("$.nom").value("Martin"))
                .andExpect(jsonPath("$.identifiantConnexion").doesNotExist());

        var compte = compteRepository.findByIdentifiantConnexion("prof.martin");
        assertThat(compte).isPresent();
        assertThat(compte.get().getStatut()).isEqualTo(StatutCompte.actif);
    }

    @Test
    void shouldReturn409OnDuplicateIdentifiant() throws Exception {
        String body = """
                {"identifiantConnexion":"prof.dupont",
                 "motDePasse":"motdepasse123",
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
    void shouldReturn400WhenPasswordTooShort() throws Exception {
        mockMvc.perform(post("/api/comptes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiantConnexion":"prof.x",
                                 "motDePasse":"court",
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
                                {"identifiantConnexion":"prof.y",
                                 "motDePasse":"motdepasse123",
                                 "nom":"Y",
                                 "email":"pas-un-email"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
