package fr.brio.contenu;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.LeconCompetence;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** ADR 0043 : résolution d'une compétence vers la première section « lesson » qui l'enseigne. */
@ExtendWith(MockitoExtension.class)
class LeconCompetenceServiceTest {

    private static final String CODE = "c4.num.fractions.comparer";

    @Mock ExerciceRepository repository;

    private LeconCompetenceService service() {
        return new LeconCompetenceService(repository, new ObjectMapper());
    }

    private static Chapitre chapitre(String id, String niveau, String matiere, String contentJson) {
        return new Chapitre(id, contentJson, niveau, matiere, 0, "published", id, 10, "h-" + id);
    }

    private static String exo(String... codes) {
        String liste = codes.length == 0
                ? ""
                : "\"" + String.join("\",\"", codes) + "\"";
        return "{\"type\":\"exercise\",\"competencies\":[" + liste + "]}";
    }

    private static String section(String id, String title, String kind, String... blocks) {
        return "{\"id\":\"" + id + "\",\"title\":\"" + title + "\",\"kind\":\"" + kind
                + "\",\"blocks\":[" + String.join(",", blocks) + "]}";
    }

    private static String doc(String... sections) {
        return "{\"sections\":[" + String.join(",", sections) + "]}";
    }

    private void candidats(Chapitre... chapitres) {
        when(repository.findPublishedChapitresByCompetence(CODE)).thenReturn(List.of(chapitres));
    }

    @Test
    void shouldPreferTheRequestedNiveauOverCatalogueOrder() {
        candidats(
                chapitre("ch-5e", "5e", "mathematiques", doc(section("s5", "T5", "lesson", exo(CODE)))),
                chapitre("ch-4e", "4e", "mathematiques", doc(section("s4", "T4", "lesson", exo(CODE)))));

        Optional<LeconCompetence> r = service().trouver(CODE, "4e");

        assertThat(r).contains(new LeconCompetence("4e", "mathematiques", "ch-4e", "s4", "T4"));
    }

    @Test
    void shouldKeepCatalogueOrderWithinAndAcrossNiveauxWhenNiveauIsNull() {
        candidats(
                chapitre("ch-5e", "5e", "mathematiques", doc(section("s5", "T5", "lesson", exo(CODE)))),
                chapitre("ch-4e", "4e", "mathematiques", doc(section("s4", "T4", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, null).orElseThrow().chapitreId()).isEqualTo("ch-5e");
    }

    @Test
    void shouldKeepCatalogueOrderForAnUnknownNiveau() {
        candidats(
                chapitre("ch-5e", "5e", "mathematiques", doc(section("s5", "T5", "lesson", exo(CODE)))),
                chapitre("ch-4e", "4e", "mathematiques", doc(section("s4", "T4", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, "terminale").orElseThrow().chapitreId()).isEqualTo("ch-5e");
    }

    @Test
    void shouldKeepCatalogueOrderAmongChaptersOfTheRequestedNiveau() {
        candidats(
                chapitre("ch-a", "5e", "mathematiques", doc(section("sa", "TA", "lesson", exo(CODE)))),
                chapitre("ch-b", "4e", "mathematiques", doc(section("sb", "TB", "lesson", exo(CODE)))),
                chapitre("ch-c", "4e", "mathematiques", doc(section("sc", "TC", "lesson", exo(CODE)))),
                chapitre("ch-d", "5e", "mathematiques", doc(section("sd", "TD", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, "5e").orElseThrow().chapitreId()).isEqualTo("ch-a");
        assertThat(service().trouver(CODE, "4e").orElseThrow().chapitreId()).isEqualTo("ch-b");
    }

    @Test
    void shouldFallBackToAnotherNiveauWhenTheRequestedOneHasNoLesson() {
        // The 5e chapter is first (requested niveau) but has no matching section: next candidate wins.
        candidats(
                chapitre("ch-4e", "4e", "mathematiques", doc(section("s4", "T4", "lesson", exo(CODE)))),
                chapitre("ch-5e", "5e", "mathematiques", doc(section("s5", "T5", "lesson", exo("autre")))));

        assertThat(service().trouver(CODE, "5e").orElseThrow().chapitreId()).isEqualTo("ch-4e");
    }

    @Test
    void shouldReturnTheFirstMatchingLessonSectionInDocumentOrder() {
        candidats(chapitre(
                "ch",
                "5e",
                "mathematiques",
                doc(
                        section("s1", "Autre", "lesson", exo("autre")),
                        section("s2", "Première", "lesson", exo(CODE)),
                        section("s3", "Seconde", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, "5e"))
                .contains(new LeconCompetence("5e", "mathematiques", "ch", "s2", "Première"));
    }

    @Test
    void shouldFindTheCodeAmongSeveralCompetenciesAndBlocks() {
        candidats(chapitre(
                "ch",
                "5e",
                "mathematiques",
                doc(section(
                        "s1",
                        "Mixte",
                        "lesson",
                        "{\"type\":\"text\"}",
                        exo("x", "y"),
                        exo("z", CODE, "w")))));

        assertThat(service().trouver(CODE, "5e").orElseThrow().sectionId()).isEqualTo("s1");
    }

    @Test
    void shouldIgnoreExercisesSections() {
        candidats(chapitre(
                "ch",
                "5e",
                "mathematiques",
                doc(
                        section("se", "Exercices", "exercises", exo(CODE)),
                        section("sl", "Leçon", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, "5e").orElseThrow().sectionId()).isEqualTo("sl");
    }

    @Test
    void shouldReturnEmptyWhenOnlyAnExercisesSectionCarriesTheCode() {
        candidats(chapitre("ch", "5e", "mathematiques", doc(section("se", "Exercices", "exercises", exo(CODE)))));

        assertThat(service().trouver(CODE, "5e")).isEmpty();
    }

    @Test
    void shouldIgnoreANonExerciseBlockCarryingTheCode() {
        candidats(chapitre(
                "ch",
                "5e",
                "mathematiques",
                doc(
                        section(
                                "s1",
                                "Pas un exo",
                                "lesson",
                                "{\"type\":\"text\",\"competencies\":[\"" + CODE + "\"]}"),
                        section("s2", "Exo", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, "5e").orElseThrow().sectionId()).isEqualTo("s2");
    }

    @Test
    void shouldReturnEmptyWhenOnlyANonExerciseBlockCarriesTheCode() {
        candidats(chapitre(
                "ch",
                "5e",
                "mathematiques",
                doc(section("s1", "Pas un exo", "lesson", "{\"type\":\"text\",\"competencies\":[\"" + CODE + "\"]}"))));

        assertThat(service().trouver(CODE, "5e")).isEmpty();
    }

    @Test
    void shouldMoveToTheNextCandidateWhenAChapterHasNoMatchingSection() {
        candidats(
                chapitre("ch-vide", "5e", "mathematiques", doc(section("s1", "Rien", "lesson", exo("autre")))),
                chapitre("ch-ok", "5e", "mathematiques", doc(section("s2", "Oui", "lesson", exo(CODE)))));

        assertThat(service().trouver(CODE, "5e").orElseThrow().chapitreId()).isEqualTo("ch-ok");
    }

    @Test
    void shouldReturnEmptyWhenThereIsNoCandidate() {
        candidats();

        assertThat(service().trouver(CODE, "5e")).isEmpty();
        assertThat(service().trouver(CODE, null)).isEmpty();
    }

    @Test
    void shouldNotFailOnIncompleteJson() {
        candidats(
                chapitre("ch-vide", "5e", "mathematiques", "{}"),
                chapitre("ch-nosec", "5e", "mathematiques", "{\"sections\":[{\"id\":\"s\",\"kind\":\"lesson\"}]}"),
                chapitre(
                        "ch-nocomp",
                        "5e",
                        "mathematiques",
                        "{\"sections\":[{\"id\":\"s\",\"kind\":\"lesson\",\"blocks\":[{\"type\":\"exercise\"}]}]}"),
                chapitre(
                        "ch-nokind",
                        "5e",
                        "mathematiques",
                        "{\"sections\":[{\"id\":\"s\",\"blocks\":[" + exo(CODE) + "]}]}"));

        assertThatCode(() -> assertThat(service().trouver(CODE, "5e")).isEmpty()).doesNotThrowAnyException();
    }

    @Test
    void shouldNotFailOnAMissingSectionIdOrTitle() {
        candidats(chapitre(
                "ch",
                "5e",
                "mathematiques",
                "{\"sections\":[{\"kind\":\"lesson\",\"blocks\":[" + exo(CODE) + "]}]}"));

        LeconCompetence r = service().trouver(CODE, "5e").orElseThrow();
        assertThat(r.chapitreId()).isEqualTo("ch");
        assertThat(r.sectionId()).isEmpty();
        assertThat(r.sectionTitre()).isEmpty();
    }

    @Test
    void shouldWrapMalformedJsonInAnUncheckedException() {
        candidats(chapitre("ch", "5e", "mathematiques", "{pas du json"));

        assertThatThrownBy(() -> service().trouver(CODE, "5e")).isInstanceOf(UncheckedIOException.class);
    }
}
