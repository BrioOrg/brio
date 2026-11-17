package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.contenu.infrastructure.AnnaleIngestor;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

/**
 * #371 (PL-2, ADR 0037) : {@code GET /api/referentiel/lecon} relie une compétence à la section de
 * cours qui l'enseigne. Écrit depuis la fiche besoin et le plan technique (contrat : 200 DTO,
 * 204 sans corps si non rattachable, 401 sans session, 400 sans {@code competence}).
 *
 * <p>Chaque test utilise ses propres codes de compétence (actifs, absents de {@code content/}) et
 * ses propres identifiants de chapitre : la base est partagée avec d'autres tests d'intégration.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class LeconCompetenceIntegrationTest {

    private static final String URL = "/api/referentiel/lecon";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CompteRepository comptes;
    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired AnnaleIngestor annaleIngestor;
    @Autowired CoursEditionService coursEditionService;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    MockMvc mockMvc;
    RequestPostProcessor eleve;
    UUID coursCree;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        String suffixe = UUID.randomUUID().toString();
        Compte compte = Compte.creerEleve(
                "eleve.lecon." + suffixe, "{noop}motdepasse", "parent@test.fr", "5e", "Lecon-" + suffixe);
        compte.activer();
        eleve = user(comptes.save(compte).getId().toString()).roles("ELEVE");
    }

    /**
     * The database is shared with the other integration tests: leave nothing published behind
     * (ChapitreIntegrationTest reads the catalogue, whose first level must stay 3e).
     */
    @AfterEach
    void nettoyer() {
        if (coursCree != null) {
            jdbc.update("UPDATE contenu.cours SET version_publiee = NULL WHERE id = ?", coursCree);
            jdbc.update("DELETE FROM contenu.exercices WHERE cours_id = ?", coursCree);
            jdbc.update("DELETE FROM contenu.cours_portees WHERE cours_id = ?", coursCree);
            jdbc.update("DELETE FROM contenu.cours_versions WHERE cours_id = ?", coursCree);
            jdbc.update("DELETE FROM contenu.cours WHERE id = ?", coursCree);
            coursCree = null;
        }
        jdbc.update("DELETE FROM contenu.exercices WHERE chapitre_id LIKE 'lc-%'");
        jdbc.update("DELETE FROM contenu.annales WHERE chapitre_id LIKE 'lc-%'");
        jdbc.update("DELETE FROM progression.chapitres WHERE chapitre_id LIKE 'lc-%'");
        jdbc.update("DELETE FROM contenu.chapitres WHERE id LIKE 'lc-%'");
    }

    // critère 1 : le lien vise la bonne leçon, dans le chapitre du niveau de l'élève d'abord
    @Test
    void shouldPreferTheChapterOfTheRequestedLevel() throws Exception {
        String code = "c4.num.relatifs.addition-soustraction";
        ingerer("lc-prio-3e", "3e", "published", section("prio-3e-s", "Leçon 3e", "lesson", exo("prio-3e-e", code)));
        ingerer("lc-prio-5e", "5e", "published", section("prio-5e-s", "Leçon 5e", "lesson", exo("prio-5e-e", code)));

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "5e").with(eleve))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.niveauCode").value("5e"))
                .andExpect(jsonPath("$.matiereCode").value("mathematiques"))
                .andExpect(jsonPath("$.chapitreId").value("lc-prio-5e"))
                .andExpect(jsonPath("$.sectionId").value("prio-5e-s"))
                .andExpect(jsonPath("$.sectionTitre").value("Leçon 5e"));

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "3e").with(eleve))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value("lc-prio-3e"))
                .andExpect(jsonPath("$.sectionId").value("prio-3e-s"));
    }

    // critère 1 : le niveau n'est qu'une préférence ; sans chapitre à ce niveau, ordre du catalogue
    @Test
    void shouldFallBackToCatalogueOrderWhenNoChapterMatchesTheLevel() throws Exception {
        String code = "c4.num.relatifs.multiplication-division";
        ingerer("lc-ordre-3e", "3e", "published", section("ordre-3e-s", "Leçon 3e", "lesson", exo("ordre-3e-e", code)));
        ingerer("lc-ordre-5e", "5e", "published", section("ordre-5e-s", "Leçon 5e", "lesson", exo("ordre-5e-e", code)));

        // aucun chapitre en 6e : 5e passe avant 3e (6e, 5e, 4e, 3e)
        mockMvc.perform(get(URL).param("competence", code).param("niveau", "6e").with(eleve))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value("lc-ordre-5e"));
        // niveau facultatif
        mockMvc.perform(get(URL).param("competence", code).with(eleve))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value("lc-ordre-5e"));
    }

    // critère 2 : première section de cours (lesson), dans l'ordre du document
    @Test
    void shouldReturnTheFirstLessonSectionInDocumentOrder() throws Exception {
        String code = "c4.num.relatifs.enchainements";
        ingerer(
                "lc-premiere-section",
                "5e",
                "published",
                section("pm-intro", "Introduction", "lesson", exo("pm-intro-e", "c4.num.calcul.mental")),
                section("pm-entrainement", "Entraînement", "exercises", exo("pm-entrainement-e", code)),
                section("pm-notion", "La notion", "lesson", exo("pm-notion-e", code)),
                section("pm-suite", "Pour aller plus loin", "lesson", exo("pm-suite-e", code)));

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "5e").with(eleve))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapitreId").value("lc-premiere-section"))
                .andExpect(jsonPath("$.sectionId").value("pm-notion"))
                .andExpect(jsonPath("$.sectionTitre").value("La notion"));
    }

    // critère 3 : réponse limitée au contrat (aucun champ en plus)
    @Test
    void shouldExposeExactlyTheFiveContractFields() throws Exception {
        String code = "c4.num.calcul.instrumente";
        ingerer("lc-dto", "4e", "published", section("dto-s", "Leçon", "lesson", exo("dto-e", code)));

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "4e").with(eleve))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.*", hasSize(5)))
                .andExpect(jsonPath("$.niveauCode").value("4e"))
                .andExpect(jsonPath("$.sectionId").value("dto-s"));
    }

    // critère 4 : non rattachable (code seulement en section d'exercices) → 204 sans corps
    @Test
    void shouldReturnNoContentWhenTheCodeOnlyAppearsInAnExercisesSection() throws Exception {
        String code = "c4.num.fractions.egalite-simplifier";
        ingerer(
                "lc-seulement-exercices",
                "5e",
                "published",
                section("so-lecon", "Cours", "lesson", exo("so-lecon-e", "c4.num.calcul.mental")),
                section("so-exos", "Exercices", "exercises", exo("so-exos-e", code)));

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "5e").with(eleve))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    // critère 4 : un code inconnu du contenu → 204
    @Test
    void shouldReturnNoContentForACodeNoChapterCarries() throws Exception {
        mockMvc.perform(get(URL).param("competence", "c4.num.fractions.irreductible").with(eleve))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    // critère 4 : un chapitre d'annale n'est pas une leçon
    @Test
    void shouldReturnNoContentForAnAnnaleChapter(@TempDir Path contentDir) throws Exception {
        String code = "c4.num.fractions.comparer";
        Path dossier = Files.createDirectories(contentDir.resolve("annales/3e/mathematiques"));
        Files.writeString(dossier.resolve("_index.json"), "[\"lc-annale\"]");
        Files.writeString(
                dossier.resolve("lc-annale.meta.json"),
                """
                {"examen":"brevet","session":"juin","annee":2024,"centre":"Test",
                 "dureeMinutes":120,"licence":"Test","sourceUrl":"https://example.brio/annales/lc"}
                """);
        Files.writeString(
                dossier.resolve("lc-annale.json"),
                document("lc-annale", "3e", "published", section("an-s", "Sujet", "lesson", exo("an-e", code)))
                        .toString());
        annaleIngestor.ingestAll(contentDir);

        // Garde-fou : l'annale est bien ingérée et publiée, sinon le 204 passerait pour une autre raison.
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM contenu.annales WHERE chapitre_id = 'lc-annale'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM contenu.chapitres WHERE id = 'lc-annale' AND statut = 'published'",
                        Integer.class))
                .isEqualTo(1);

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "3e").with(eleve))
                .andExpect(status().isNoContent());
    }

    // critère 4 : un exercice de cours de prof n'est pas dans le contenu officiel
    @Test
    void shouldReturnNoContentForATeacherCourseExercise() throws Exception {
        String code = "c4.num.fractions.addition-soustraction";
        UUID auteur = UUID.randomUUID();
        UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                auteur,
                UUID.randomUUID(),
                "Cours de prof",
                "5e",
                "mathematiques",
                document("cours-prof-lecon", "5e", "published", section("cp-s", "Leçon", "lesson", exo("cp-e", code)))));
        coursCree = coursId;
        coursEditionService.definirPortees(coursId, auteur, Set.of(UUID.randomUUID()));
        coursEditionService.publier(coursId, auteur);

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "5e").with(eleve))
                .andExpect(status().isNoContent());
    }

    // critère 4 : chapitre non publié → 204
    @Test
    void shouldReturnNoContentForAChapterThatIsNotPublished() throws Exception {
        String code = "c4.num.fractions.multiplication-division";
        ingerer("lc-brouillon", "5e", "draft", section("br-s", "Leçon", "lesson", exo("br-e", code)));

        mockMvc.perform(get(URL).param("competence", code).param("niveau", "5e").with(eleve))
                .andExpect(status().isNoContent());
    }

    // critère 5 : accès authentifié uniquement
    @Test
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(get(URL).param("competence", "c4.geo.pythagore.calculer").param("niveau", "3e"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectARequestWithoutCompetence() throws Exception {
        mockMvc.perform(get(URL).param("niveau", "5e").with(eleve)).andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectABlankCompetence() throws Exception {
        mockMvc.perform(get(URL).param("competence", "").param("niveau", "5e").with(eleve))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(URL).param("competence", "  ").param("niveau", "5e").with(eleve))
                .andExpect(status().isBadRequest());
    }

    // --- fixtures ---------------------------------------------------------------------------

    private void ingerer(String id, String niveau, String statut, JsonNode... sections) {
        var resultat = chapitreIngestor.ingestDocument(document(id, niveau, statut, sections), niveau, "mathematiques", 0);
        assertThat(resultat.status()).as("ingestion de %s : %s", id, resultat.message()).isNotEqualTo(fr.brio.contenu.infrastructure.ChapterResult.Status.FAILED);
    }

    private JsonNode document(String id, String niveau, String statut, JsonNode... sections) {
        var doc = objectMapper.createObjectNode();
        doc.put("schemaVersion", 1);
        doc.put("id", id);
        doc.put("title", "Chapitre " + id);
        doc.put("subject", "mathematiques");
        doc.put("level", niveau);
        doc.put("difficulty", "standard");
        doc.put("estimatedDurationMinutes", 30);
        doc.put("status", statut);
        var tableau = doc.putArray("sections");
        for (JsonNode s : sections) {
            tableau.add(s);
        }
        return doc;
    }

    private JsonNode section(String id, String titre, String kind, JsonNode... blocs) {
        var s = objectMapper.createObjectNode();
        s.put("id", id);
        s.put("title", titre);
        s.put("kind", kind);
        s.put("estimatedDurationMinutes", 10);
        var tableau = s.putArray("blocks");
        var prose = objectMapper.createObjectNode();
        prose.put("id", id + "-prose");
        prose.put("type", "prose");
        prose.put("text", "Texte de la section " + titre + ".");
        tableau.add(prose);
        for (JsonNode b : blocs) {
            tableau.add(b);
        }
        return s;
    }

    private JsonNode exo(String id, String competence) {
        var b = objectMapper.createObjectNode();
        b.put("id", id);
        b.put("type", "exercise");
        b.put("exerciseType", "numeric");
        b.put("prompt", "Combien font 2 + 3 ?");
        b.putArray("competencies").add(competence);
        b.put("difficulty", "introduction");
        b.put("estimatedDurationMinutes", 2);
        b.put("answer", 5);
        b.put("tolerance", 0.01);
        return b;
    }
}
