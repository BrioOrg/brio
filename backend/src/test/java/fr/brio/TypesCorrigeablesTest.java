package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.contenu.CoursStructure;
import fr.brio.exercices.domain.Evaluator;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * The types a course counts toward its completion are exactly those exercices can grade (ADR 0050
 * §5). contenu cannot ask exercices (that would close a module cycle), so this test holds the two
 * lists together: a new evaluator, or a removed one, fails here until CoursStructure follows.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class TypesCorrigeablesTest {

    @Autowired List<Evaluator> evaluateurs;

    @Test
    void theCourseCountsExactlyTheTypesExercicesCanGrade() {
        assertThat(evaluateurs.stream().map(Evaluator::exerciseType).collect(Collectors.toSet()))
                .isEqualTo(CoursStructure.TYPES_CORRIGEABLES);
    }
}
