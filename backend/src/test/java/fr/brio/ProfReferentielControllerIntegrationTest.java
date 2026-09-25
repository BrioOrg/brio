package fr.brio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import fr.brio.identite.CompteService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

/**
 * HTTP wiring of the competency picker endpoint (issue #144): a teacher reads the referential to
 * pick codes by label. The endpoint is ENSEIGNANT-gated ({@code /api/prof/**}) and never surfaces
 * deprecated codes, which publication would reject.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProfReferentielControllerIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CompteService compteService;

    MockMvc mockMvc;
    private UUID teacher;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        teacher = compteService.creerEnseignant(
                "prof-" + suffix, "motdepasse123", "Prof " + suffix, "prof-" + suffix + "@example.fr").id();
    }

    @Test
    void shouldReturnActiveCompetenciesWithLabelToATeacher() throws Exception {
        mockMvc.perform(get("/api/prof/referentiel/competences")
                        .with(user(teacher.toString()).roles("ENSEIGNANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'c4.geo.pythagore.calculer')].intitule")
                        .value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("Pythagore"))))
                .andExpect(jsonPath("$[?(@.code == 'c4.geo.pythagore.calculer')].niveaux")
                        .exists());
    }

    @Test
    void shouldNeverIncludeDeprecatedCodes() throws Exception {
        // c3.num.entiers.lire-ecrire is a deprecated cycle3-2020 entry (superseded in 2025).
        mockMvc.perform(get("/api/prof/referentiel/competences")
                        .with(user(teacher.toString()).roles("ENSEIGNANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'c3.num.entiers.lire-ecrire')]")
                        .isEmpty());
    }

    @Test
    void shouldRequireAuthentication() throws Exception {
        // The endpoint lives under /api/prof/** (ENSEIGNANT-only); an anonymous request is rejected
        // before it ever reaches the controller.
        mockMvc.perform(get("/api/prof/referentiel/competences"))
                .andExpect(status().isUnauthorized());
    }
}
