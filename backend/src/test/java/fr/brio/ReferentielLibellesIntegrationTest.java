package fr.brio;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

/** A student reads competency labels by code (#324), deprecated codes included. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ReferentielLibellesIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CompteRepository comptes;

    MockMvc mockMvc;
    private UUID eleve;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        String suffixe = UUID.randomUUID().toString();
        Compte compte = Compte.creerEleve(
                "eleve.libelles." + suffixe, "{noop}motdepasse", "parent@test.fr", "3e", "Test-" + suffixe);
        compte.activer();
        eleve = comptes.save(compte).getId();
    }

    @Test
    void shouldGiveAStudentTheLabelOfACompetency() throws Exception {
        mockMvc.perform(get("/api/referentiel/libelles")
                        .with(user(eleve.toString()).roles("ELEVE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'c4.geo.pythagore.calculer')].intitule")
                        .value(hasItem(containsString("Pythagore"))));
    }

    @Test
    void shouldIncludeDeprecatedCodes() throws Exception {
        // c3.num.entiers.lire-ecrire is a deprecated cycle3-2020 entry (superseded in 2025).
        mockMvc.perform(get("/api/referentiel/libelles")
                        .with(user(eleve.toString()).roles("ELEVE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'c3.num.entiers.lire-ecrire')]").isNotEmpty());
    }

    @Test
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/referentiel/libelles")).andExpect(status().isUnauthorized());
    }
}
