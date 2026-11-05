package fr.brio;

import fr.brio.contenu.api.ChapitrePublie;
import fr.brio.contenu.api.SectionTerminee;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.progression.ProgressionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReprendreIntegrationTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ProgressionService progression;
    @Autowired CompteRepository comptes;

    MockMvc mockMvc;
    UUID eleve;
    Instant maintenant = Instant.now();

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        Compte compte = Compte.creerEleve(
                "eleve.reprendre." + UUID.randomUUID(), "{noop}motdepasse", "parent@test.fr", "3e", "Test-" + UUID.randomUUID());
        compte.activer();
        eleve = comptes.save(compte).getId();
    }

    @Test
    void shouldReturnTheChapterWithTwoSectionsReadOutOfFive() throws Exception {
        String chapitre = chapitre(5, 0, "published");
        lire(chapitre, 2, maintenant);

        reprendre().andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value(chapitre))
                .andExpect(jsonPath("$.titre").value("Titre de " + chapitre))
                .andExpect(jsonPath("$.niveauCode").value("3e"))
                .andExpect(jsonPath("$.matiereCode").value("mathematiques"))
                .andExpect(jsonPath("$.sectionsLues").value(2))
                .andExpect(jsonPath("$.sectionsTotal").value(5))
                .andExpect(jsonPath("$.derniereActivite", notNullValue()));
    }

    @Test
    void shouldReturnNoContentWhenNothingWasRead() throws Exception {
        reprendre().andExpect(status().isNoContent());
    }

    @Test
    void shouldNoLongerReturnAFinishedChapter() throws Exception {
        String chapitre = chapitre(5, 0, "published");
        lire(chapitre, 5, maintenant);

        reprendre().andExpect(status().isNoContent());
    }

    @Test
    void shouldKeepAChapterWhoseSectionsAreReadButExercisesAreNotDone() throws Exception {
        String chapitre = chapitre(2, 4, "published");
        lire(chapitre, 2, maintenant);

        reprendre().andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value(chapitre))
                .andExpect(jsonPath("$.sectionsLues").value(2));
    }

    @Test
    void shouldReturnTheMostRecentlyReadUnfinishedChapter() throws Exception {
        String ancien = chapitre(5, 0, "published");
        String recent = chapitre(5, 0, "published");
        String termine = chapitre(1, 0, "published");
        lire(ancien, 1, maintenant.minusSeconds(7200));
        lire(recent, 1, maintenant.minusSeconds(3600));
        lire(termine, 1, maintenant);

        reprendre().andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value(recent));
    }

    @Test
    void shouldSkipAnUnpublishedChapter() throws Exception {
        String chapitre = chapitre(5, 0, "draft");
        lire(chapitre, 1, maintenant);

        reprendre().andExpect(status().isNoContent());
    }

    private ResultActions reprendre() throws Exception {
        return mockMvc.perform(get("/api/progression/reprendre")
                .with(user(eleve.toString()).roles("ELEVE")));
    }

    private String chapitre(int sections, int exercices, String statut) {
        String id = "chapitre-" + UUID.randomUUID();
        progression.enregistrerChapitre(new ChapitrePublie(
                id, "3e", "mathematiques", 0, statut, sections, exercices, "Titre de " + id));
        return id;
    }

    private void lire(String chapitre, int sections, Instant quand) {
        for (int i = 0; i < sections; i++) {
            progression.onSectionTerminee(new SectionTerminee(eleve, chapitre, "section-" + i, quand));
        }
    }
}
