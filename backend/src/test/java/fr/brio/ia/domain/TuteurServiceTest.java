package fr.brio.ia.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.Block;
import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.ChapitreDocument;
import fr.brio.contenu.api.ExerciceContentApi;
import fr.brio.contenu.api.ExerciceDefinition;
import fr.brio.contenu.api.ExerciseBlock;
import fr.brio.contenu.api.Section;
import fr.brio.contenu.api.TextBlock;
import fr.brio.ia.infrastructure.AnthropicClient;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TuteurServiceTest {

    @Mock AnthropicClient anthropicClient;
    @Mock ChapitreContentApi chapitreContentApi;
    @Mock ExerciceContentApi exerciceContentApi;

    TuteurService service;
    ChapitreDocument doc;

    @BeforeEach
    void setUp() {
        service = new TuteurService(anthropicClient, chapitreContentApi, exerciceContentApi, new ObjectMapper());

        List<Block> blocks = List.of(
                new TextBlock("intro", "prose", "Le théorème de Pythagore"),
                new TextBlock("formule", "formula", "BC² = AB² + AC²"));
        doc = new ChapitreDocument("theoreme-de-pythagore",
                List.of(new Section("enonce", blocks)));
    }

    private void stubChapter() {
        when(chapitreContentApi.findByTriplet("3e", "mathematiques", "theoreme-de-pythagore"))
                .thenReturn(Optional.of(doc));
    }

    @Test
    void shouldReturnRefusalWhenModelSaysNotRepondable() {
        stubChapter();
        when(anthropicClient.ask(anyString(), anyString(), anyString()))
                .thenReturn(new TuteurModelResponse(false, "N/A", List.of()));

        TuteurResult result = service.ask("3e", "mathematiques", "theoreme-de-pythagore", "Question hors sujet", null);

        assertThat(result.reponse()).isEqualTo(TuteurService.REFUSAL_MESSAGE);
        assertThat(result.citations()).isEmpty();
    }

    @Test
    void shouldReturnRefusalWhenCitationListIsEmpty() {
        stubChapter();
        when(anthropicClient.ask(anyString(), anyString(), anyString()))
                .thenReturn(new TuteurModelResponse(true, "Réponse sans citation", List.of()));

        TuteurResult result = service.ask("3e", "mathematiques", "theoreme-de-pythagore", "Question", null);

        assertThat(result.reponse()).isEqualTo(TuteurService.REFUSAL_MESSAGE);
        assertThat(result.citations()).isEmpty();
    }

    @Test
    void shouldRegenerateOnceOnInvalidCitationThenRefuse() {
        stubChapter();
        TuteurModelResponse badCitation = new TuteurModelResponse(
                true, "Réponse", List.of("enonce/inexistant"));
        when(anthropicClient.ask(anyString(), anyString(), anyString()))
                .thenReturn(badCitation);

        TuteurResult result = service.ask("3e", "mathematiques", "theoreme-de-pythagore", "Question", null);

        assertThat(result.reponse()).isEqualTo(TuteurService.REFUSAL_MESSAGE);
        verify(anthropicClient, times(2)).ask(anyString(), anyString(), anyString());
    }

    @Test
    void shouldReturnResponseWhenAllCitationsAreValid() {
        stubChapter();
        TuteurModelResponse good = new TuteurModelResponse(
                true, "Bonne réponse", List.of("enonce/intro"));
        when(anthropicClient.ask(anyString(), anyString(), anyString())).thenReturn(good);

        TuteurResult result = service.ask("3e", "mathematiques", "theoreme-de-pythagore", "Question", null);

        assertThat(result.reponse()).isEqualTo("Bonne réponse");
        assertThat(result.citations()).containsExactly("enonce/intro");
    }

    @Test
    void shouldReturnRefusalWhenSecondAttemptStillHasInvalidCitations() {
        stubChapter();
        TuteurModelResponse bad = new TuteurModelResponse(
                true, "Réponse", List.of("enonce/inexistant"));
        when(anthropicClient.ask(anyString(), anyString(), anyString())).thenReturn(bad, bad);

        TuteurResult result = service.ask("3e", "mathematiques", "theoreme-de-pythagore", "Question", null);

        assertThat(result.reponse()).isEqualTo(TuteurService.REFUSAL_MESSAGE);
        verify(anthropicClient, times(2)).ask(anyString(), anyString(), anyString());
    }

    // ── Disclosure filter tests ───────────────────────────────────────────

    @Test
    void disclosureFilter_detectsNumericAnswerInPlainForm() {
        ExerciceDefinition def = new ExerciceDefinition(
                UUID.randomUUID(), "numeric", List.of(),
                "{\"answer\": \"10\", \"tolerance\": 0.01}");

        assertThat(service.disclosesAnswer("La réponse est 10.", def)).isTrue();
    }

    @Test
    void disclosureFilter_detectsNumericAnswerWithCommaDecimal() {
        ExerciceDefinition def = new ExerciceDefinition(
                UUID.randomUUID(), "numeric", List.of(),
                "{\"answer\": \"10\", \"tolerance\": 0.1}");

        assertThat(service.disclosesAnswer("Le résultat vaut 10,0 cm.", def)).isTrue();
    }

    @Test
    void disclosureFilter_detectsNumericAnswerWithUnit() {
        ExerciceDefinition def = new ExerciceDefinition(
                UUID.randomUUID(), "numeric", List.of(),
                "{\"answer\": \"10\", \"tolerance\": 0.01}");

        // "10" appears as standalone token before " cm"
        assertThat(service.disclosesAnswer("La longueur est 10 cm.", def)).isTrue();
    }

    @Test
    void disclosureFilter_doesNotFlagUnrelatedNumbers() {
        ExerciceDefinition def = new ExerciceDefinition(
                UUID.randomUUID(), "numeric", List.of(),
                "{\"answer\": \"10\", \"tolerance\": 0.01}");

        assertThat(service.disclosesAnswer("Il y a 3 côtés dans un triangle.", def)).isFalse();
    }

    @Test
    void disclosureFilter_detectsCorrectChoiceTextForMultipleChoice() throws Exception {
        String evalJson = "{\"choices\": ["
                + "{\"id\": \"a\", \"text\": \"Le côté [RT]\", \"correct\": true},"
                + "{\"id\": \"b\", \"text\": \"Le côté [RS]\", \"correct\": false}"
                + "]}";
        ExerciceDefinition def = new ExerciceDefinition(
                UUID.randomUUID(), "multiple-choice", List.of(), evalJson);

        assertThat(service.disclosesAnswer("La bonne réponse est Le côté [RT].", def)).isTrue();
    }

    @Test
    void disclosureFilter_doesNotFlagIncorrectChoiceText() throws Exception {
        String evalJson = "{\"choices\": ["
                + "{\"id\": \"a\", \"text\": \"Le côté [RT]\", \"correct\": true},"
                + "{\"id\": \"b\", \"text\": \"Le côté [RS]\", \"correct\": false}"
                + "]}";
        ExerciceDefinition def = new ExerciceDefinition(
                UUID.randomUUID(), "multiple-choice", List.of(), evalJson);

        assertThat(service.disclosesAnswer("Pense au côté opposé à l'angle droit.", def)).isFalse();
    }

    @Test
    void shouldReturnGenericHintAfterTwoDisclosures() {
        UUID exerciceId = UUID.randomUUID();
        // note: we register a fresh chapter stub here (not the default one)
        // since this test uses a different chapter document with an exercise block
        ExerciceDefinition def = new ExerciceDefinition(
                exerciceId, "numeric", List.of(),
                "{\"answer\": \"5\", \"tolerance\": 0.01}");

        // exercise block has the matching exerciceId
        ExerciseBlock exBlock = new ExerciseBlock("ex-1", "exercise", "Calcule BC.", exerciceId);
        ChapitreDocument docWithEx = new ChapitreDocument("chapitre",
                List.of(new Section("s1", List.of(
                        new TextBlock("intro", "prose", "Contenu"),
                        exBlock))));

        when(chapitreContentApi.findByTriplet("3e", "mathematiques", "chapitre"))
                .thenReturn(Optional.of(docWithEx));
        when(exerciceContentApi.findById(exerciceId)).thenReturn(Optional.of(def));

        TuteurModelResponse disclosingResponse = new TuteurModelResponse(
                true, "La réponse est 5 cm.", List.of("s1/intro"));
        when(anthropicClient.ask(anyString(), anyString(), anyString()))
                .thenReturn(disclosingResponse, disclosingResponse);

        TuteurResult result = service.ask("3e", "mathematiques", "chapitre", "Quelle est BC ?", exerciceId);

        assertThat(result.reponse()).isEqualTo(TuteurService.GENERIC_HINT);
        assertThat(result.citations()).isEmpty();
        verify(anthropicClient, times(2)).ask(anyString(), anyString(), anyString());
    }
}
