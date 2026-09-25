package fr.brio;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.domain.StatutCompte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.RecordingEmailSender;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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
class InscriptionEleveIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired CompteRepository compteRepository;
    @Autowired RecordingEmailSender emailSender;

    @BeforeEach
    void setup() {
        emailSender.clear();
    }

    @Test
    void shouldCreateEleveEnAttenteAndSendConsentEmail() throws Exception {
        var result = mockMvc.perform(post("/api/comptes/eleve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "niveauDeclare": "4e",
                                  "motDePasse": "motdepasse123",
                                  "emailParent": "parent@example.com"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.identifiantConnexion").isNotEmpty())
                .andExpect(jsonPath("$.statut").value("en_attente_consentement"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn();

        // Account is in the database in the expected state. Look it up by the id the response
        // returned — other (committed) tests may leave élèves around, so findFirst() is not safe.
        UUID eleveId = UUID.fromString(
                new ObjectMapper().readTree(result.getResponse().getContentAsString()).path("id").asText());
        var eleve = compteRepository.findById(eleveId).orElseThrow();
        assertThat(eleve.getStatut()).isEqualTo(StatutCompte.en_attente_consentement);
        assertThat(eleve.getNiveauDeclare()).isEqualTo("4e");
        assertThat(eleve.getEmailTitulaireLegal()).isEqualTo("parent@example.com");

        // Consent email was sent to the parent
        assertThat(emailSender.getSent()).hasSize(1);
        assertThat(emailSender.getSent().get(0).to()).isEqualTo("parent@example.com");
        assertThat(emailSender.getSent().get(0).kind()).isEqualTo("consent-request");
    }

    @Test
    void shouldRejectUnknownField() throws Exception {
        mockMvc.perform(post("/api/comptes/eleve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "niveauDeclare": "4e",
                                  "motDePasse": "motdepasse123",
                                  "emailParent": "parent@example.com",
                                  "prenom": "Léa"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectInvalidNiveau() throws Exception {
        mockMvc.perform(post("/api/comptes/eleve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "niveauDeclare": "terminale",
                                  "motDePasse": "motdepasse123",
                                  "emailParent": "parent@example.com"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectWeakPassword() throws Exception {
        mockMvc.perform(post("/api/comptes/eleve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "niveauDeclare": "4e",
                                  "motDePasse": "court",
                                  "emailParent": "parent@example.com"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectMissingEmailParent() throws Exception {
        mockMvc.perform(post("/api/comptes/eleve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "niveauDeclare": "4e",
                                  "motDePasse": "motdepasse123"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectInvalidEmailFormat() throws Exception {
        mockMvc.perform(post("/api/comptes/eleve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "niveauDeclare": "4e",
                                  "motDePasse": "motdepasse123",
                                  "emailParent": "pas-un-email"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
