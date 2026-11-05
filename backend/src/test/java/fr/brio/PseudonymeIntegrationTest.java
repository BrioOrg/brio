package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.CompteService;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.Etablissement;
import fr.brio.identite.domain.Inscription;
import fr.brio.identite.infrastructure.ClasseRepository;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.EtablissementRepository;
import fr.brio.identite.infrastructure.InscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/** A student's two identities stay apart: nothing returns the pseudonym and the display name together (#325). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class PseudonymeIntegrationTest {

    static final String NOM_AFFICHE = "Camille D.";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CompteService compteService;
    @Autowired CompteRepository comptes;
    @Autowired EtablissementRepository etablissements;
    @Autowired ClasseRepository classes;
    @Autowired InscriptionRepository inscriptions;
    @Autowired ObjectMapper objectMapper;

    MockMvc mockMvc;
    Compte eleve;
    Compte prof;
    UUID classeId;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        String unique = UUID.randomUUID().toString();
        String uai = String.format("%07dA", Math.abs(unique.hashCode()) % 10_000_000);
        UUID etablissementId = etablissements.save(Etablissement.creer(
                "Collège " + unique, uai, "college", LocalDate.now(), "CONV-" + unique)).getId();
        prof = comptes.save(Compte.creerEnseignant(
                "prof." + unique, "{noop}motdepasse", "Mme Durand", unique + "@brio.test"));
        eleve = comptes.save(Compte.creerEleveMissionEtablissement(
                "eleve." + unique, "{noop}motdepasse", etablissementId, "Renard-" + unique));
        classeId = classes.save(Classe.creer(
                etablissementId, "4e", "4e B", "2026-2027", prof.getId())).getId();
        inscriptions.save(Inscription.creer(classeId, eleve.getId(), NOM_AFFICHE));
    }

    @Test
    void shouldAssignAUniquePseudonymToEveryNewStudent() {
        UUID premier = compteService.inscrireEleve("4e", "motdepasse-solide", "a@test.fr").id();
        UUID second = compteService.inscrireEleve("4e", "motdepasse-solide", "b@test.fr").id();

        String pseudonyme = comptes.findById(premier).orElseThrow().getPseudonyme();
        assertThat(pseudonyme).matches("[^-]+-[^-]+(-\\d+)?");
        assertThat(comptes.findById(second).orElseThrow().getPseudonyme()).isNotEqualTo(pseudonyme);
    }

    @Test
    void shouldExposeThePseudonymAndTheActiveClassLevelInMoi() throws Exception {
        mockMvc.perform(get("/api/moi").with(commeEleve()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pseudonyme").value(eleve.getPseudonyme()))
                .andExpect(jsonPath("$.niveau").value("4e"));
    }

    @Test
    void shouldFallBackOnTheDeclaredLevelForAStudentWithoutAClass() throws Exception {
        Compte seul = Compte.creerEleve("eleve." + UUID.randomUUID(), "{noop}motdepasse",
                "parent@test.fr", "5e", "Loup-" + UUID.randomUUID());
        seul.activer();
        UUID id = comptes.save(seul).getId();

        mockMvc.perform(get("/api/moi").with(user(id.toString()).roles("ELEVE")))
                .andExpect(jsonPath("$.niveau").value("5e"));
    }

    @Test
    void shouldNeverReturnThePseudonymAndTheDisplayNameTogether() throws Exception {
        List<String> reponses = List.of(
                corps("/api/moi", commeEleve()),
                corps("/api/moi/classes", commeEleve()),
                corps("/api/classes/" + classeId + "/inscriptions", commeProf()));

        assertThat(reponses).noneMatch(r -> r.contains(eleve.getPseudonyme()) && r.contains(NOM_AFFICHE));
        // The roster is the class's own space: the display name, never the pseudonym.
        assertThat(reponses.get(2)).contains(NOM_AFFICHE).doesNotContain(eleve.getPseudonyme());
    }

    /** Guards every endpoint at once, including those added later: fails if a new schema carries the pseudonym. */
    @Test
    void shouldKeepThePseudonymOutOfEveryOtherSchemaOfTheContract() throws Exception {
        JsonNode schemas = objectMapper
                .readTree(mockMvc.perform(get("/v3/api-docs")).andReturn().getResponse().getContentAsString())
                .path("components").path("schemas");

        List<String> avecPseudonyme = new ArrayList<>();
        schemas.fields().forEachRemaining(schema -> {
            JsonNode proprietes = schema.getValue().path("properties");
            if (proprietes.has("pseudonyme")) {
                avecPseudonyme.add(schema.getKey());
                assertThat(proprietes.has("nomAffiche")).as(schema.getKey()).isFalse();
            }
        });

        assertThat(avecPseudonyme).containsExactlyInAnyOrder("CompteInfo", "PseudonymeInfo");
    }

    @Test
    void shouldLetOnlyAdminBrioRegenerateAPseudonym() throws Exception {
        String url = "/api/admin/comptes/" + eleve.getId() + "/pseudonyme";

        mockMvc.perform(post(url).with(commeEleve()).with(csrf())).andExpect(status().isForbidden());
        mockMvc.perform(post(url).with(commeProf()).with(csrf())).andExpect(status().isForbidden());
        assertThat(comptes.findById(eleve.getId()).orElseThrow().getPseudonyme()).isEqualTo(eleve.getPseudonyme());

        Compte admin = comptes.save(Compte.creerAdminBrio("admin." + UUID.randomUUID(), "{noop}motdepasse",
                "Admin", UUID.randomUUID() + "@brio.test"));
        mockMvc.perform(post(url).with(user(admin.getId().toString()).roles("ADMIN_BRIO")).with(csrf()))
                .andExpect(status().isOk());
        assertThat(comptes.findById(eleve.getId()).orElseThrow().getPseudonyme()).isNotEqualTo(eleve.getPseudonyme());

        mockMvc.perform(post("/api/admin/comptes/" + prof.getId() + "/pseudonyme")
                        .with(user(admin.getId().toString()).roles("ADMIN_BRIO")).with(csrf()))
                .andExpect(status().isNotFound());
    }

    private String corps(String url, RequestPostProcessor qui) throws Exception {
        return mockMvc.perform(get(url).with(qui))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private RequestPostProcessor commeEleve() {
        return user(eleve.getId().toString()).roles("ELEVE");
    }

    private RequestPostProcessor commeProf() {
        return user(prof.getId().toString()).roles("ENSEIGNANT");
    }
}
