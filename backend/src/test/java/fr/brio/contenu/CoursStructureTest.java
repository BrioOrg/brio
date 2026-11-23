package fr.brio.contenu;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.CoursPublie;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Which elements of a published course count toward its completion (ADR 0050 §1, §5). */
class CoursStructureTest {

    @Test
    void givenExercisesOfEveryKindThenOnlyTheGradableOnesCount() throws Exception {
        var contenu = new ObjectMapper().readTree("""
                { "sections": [
                    { "id": "s1", "blocks": [
                      { "id": "qcm", "type": "exercise", "exerciseType": "multiple-choice" },
                      { "id": "court", "type": "exercise", "exerciseType": "short-answer" },
                      { "id": "nombre", "type": "exercise", "exerciseType": "numeric" },
                      { "id": "trous", "type": "exercise", "exerciseType": "fill-blank" },
                      { "id": "feuille", "type": "exercise", "exerciseType": "paper" },
                      { "id": "libre", "type": "exercise", "exerciseType": "free-text" },
                      { "id": "ordre", "type": "exercise", "exerciseType": "ordering" },
                      { "id": "dessin", "type": "exercise", "exerciseType": "dessin" },
                      { "id": "p1", "type": "prose", "text": "…" } ] },
                    { "id": "s2", "blocks": [] } ] }""");

        CoursPublie publie = CoursStructure.de(UUID.randomUUID(), 3, contenu);

        assertThat(publie.version()).isEqualTo(3);
        assertThat(publie.sectionIds()).containsExactly("s1", "s2");
        assertThat(publie.exerciceCles()).containsExactly("qcm", "court", "nombre", "trous");
    }
}
