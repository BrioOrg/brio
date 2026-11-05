package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

/** Réglage désactivé, la Communauté n'existe pas pour personne (ADR 0035 §10). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommunauteDesactiveeIntegrationTest {

    private static final String ID = UUID.randomUUID().toString();
    private static final String CORPS = """
            {"titre":"t","corps":[{"id":"a","type":"prose","text":"x"}]}""";

    @Autowired WebApplicationContext context;
    @Autowired CompteRepository comptes;

    MockMvc mockMvc;
    RequestPostProcessor eleve;
    RequestPostProcessor prof;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(context).apply(springSecurity()).build();
        String unique = UUID.randomUUID().toString();
        Compte compteEleve = Compte.creerEleve("eleve." + unique, "{noop}mdp", "p@test.fr", "4e", "Loup-" + unique);
        compteEleve.activer();
        eleve = user(comptes.save(compteEleve).getId().toString()).roles("ELEVE");
        prof = user(comptes.save(Compte.creerEnseignant("prof." + unique, "{noop}mdp", "Mme D", unique + "@t.fr"))
                .getId().toString()).roles("ENSEIGNANT");
    }

    @Test
    void shouldAnswerLikeAnUnknownRouteOnEveryEndpointWhateverTheCaller() throws Exception {
        List<String> routes = List.of(
                "POST /questions",
                "GET /questions",
                "GET /questions/" + ID,
                "PUT /questions/" + ID,
                "DELETE /questions/" + ID,
                "POST /questions/" + ID + "/reponses",
                "POST /questions/" + ID + "/reponses/" + ID + "/resolution",
                "PUT /questions/" + ID + "/vote",
                "DELETE /questions/" + ID + "/vote",
                "POST /reponses/" + ID + "/commentaires",
                "PUT /reponses/" + ID,
                "DELETE /reponses/" + ID,
                "PUT /reponses/" + ID + "/vote",
                "DELETE /reponses/" + ID + "/vote");

        for (String route : routes) {
            HttpMethod methode = HttpMethod.valueOf(route.split(" ")[0]);
            String chemin = "/api/communaute" + route.split(" ")[1];

            MockHttpServletResponse commeEleve = appel(methode, chemin, eleve);
            assertThat(commeEleve.getStatus()).as(route).isEqualTo(404);
            assertPareil(route, commeEleve, appel(methode, "/api/nexiste-pas", eleve));
            assertPareil(route, appel(methode, chemin, prof), appel(methode, "/api/nexiste-pas", prof));
            assertPareil(route, appel(methode, chemin, null), appel(methode, "/api/nexiste-pas", null));
        }
    }

    @Test
    void shouldTellTheWebServerItIsOffWithoutASession() throws Exception {
        mockMvc.perform(request(HttpMethod.GET, "/api/reglages/communaute"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    /** Le fichier de test masque celui de production : c'est bien ce dernier qu'on lit ici. */
    @Test
    void shouldBeOffInTheProductionDefaults() throws Exception {
        Properties production = new Properties();
        try (var fichier = Files.newBufferedReader(Path.of("src/main/resources/application.properties"))) {
            production.load(fichier);
        }
        assertThat(production.getProperty("brio.communaute.active")).isEqualTo("${BRIO_COMMUNAUTE_ACTIVE:false}");
    }

    private MockHttpServletResponse appel(HttpMethod methode, String chemin, RequestPostProcessor qui)
            throws Exception {
        MockHttpServletRequestBuilder requete = request(methode, chemin).with(csrf());
        if (methode != HttpMethod.GET && methode != HttpMethod.DELETE) {
            requete.contentType("application/json").content(CORPS);
        }
        if (qui != null) {
            requete.with(qui);
        }
        return mockMvc.perform(requete).andReturn().getResponse();
    }

    private static void assertPareil(String route, MockHttpServletResponse reel, MockHttpServletResponse inconnu)
            throws Exception {
        assertThat(reel.getStatus()).as(route).isEqualTo(inconnu.getStatus());
        assertThat(reel.getContentAsString()).as(route).isEqualTo(inconnu.getContentAsString());
    }
}
