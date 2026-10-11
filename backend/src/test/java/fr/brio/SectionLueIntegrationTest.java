package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.progression.infrastructure.SectionLueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * The "section read" signal end to end (#252): the endpoint publishes {@code SectionTerminee},
 * and progression's after-commit listener records it. Calling the service directly (as the
 * progression tests do) would not catch an event published outside a transaction.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SectionLueIntegrationTest {

    static final String CHAPITRE = "theoreme-de-pythagore";
    static final String SECTION = "enonce-du-theoreme";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired SectionLueRepository sectionsLues;
    @Autowired CompteRepository compteRepository;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;
    UUID eleve;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .defaultRequest(MockMvcRequestBuilders.post("/**").with(csrf()))
                .build();

        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            JsonNode doc = objectMapper.readTree(is);
            chapitreIngestor.ingestDocument(doc, "3e", "mathematiques", 0);
        }

        // A real, active account: StatutCheckFilter re-checks it on every request.
        Compte compte = Compte.creerEleve(
                "eleve.lu." + UUID.randomUUID(), "{noop}motdepasse", "parent@test.fr", "3e");
        compte.activer();
        eleve = compteRepository.save(compte).getId();
    }

    @Test
    void shouldRecordTheSectionReadOnceInProgression() throws Exception {
        mockMvc.perform(post("/api/chapitres/{id}/sections/{s}/lu", CHAPITRE, SECTION).with(user(eleve.toString()).roles("ELEVE")))
                .andExpect(status().isNoContent());
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(
                sectionsLues.existsByEleveIdAndChapitreIdAndSectionId(eleve, CHAPITRE, SECTION)).isTrue());

        mockMvc.perform(post("/api/chapitres/{id}/sections/{s}/lu", CHAPITRE, SECTION).with(user(eleve.toString()).roles("ELEVE")))
                .andExpect(status().isNoContent());
        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(3)).untilAsserted(() ->
                assertThat(sectionsLues.countByEleveIdAndChapitreId(eleve, CHAPITRE)).isEqualTo(1));
    }

    @Test
    void shouldAnswer404ForAnUnknownSection() throws Exception {
        mockMvc.perform(post("/api/chapitres/{id}/sections/{s}/lu", CHAPITRE, "section-fantome").with(user(eleve.toString()).roles("ELEVE")))
                .andExpect(status().isNotFound());
    }
}
