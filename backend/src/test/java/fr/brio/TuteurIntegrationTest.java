package fr.brio;

import fr.brio.ia.domain.TuteurResult;
import fr.brio.ia.domain.TuteurService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Live integration test against the real Anthropic API.
 * Requires BRIO_IA_API_KEY to be set and a running database (Testcontainers).
 * Tagged "integration-api" — excluded from the default surefire run.
 * Run manually: ./mvnw test -Dgroups=integration-api
 */
@Tag("integration-api")
@EnabledIfEnvironmentVariable(named = "BRIO_IA_API_KEY", matches = ".+")
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TuteurIntegrationTest {

    @Autowired TuteurService tuteurService;

    @Test
    void shouldAnswerGroundedQuestionWithCitations() {
        TuteurResult result = tuteurService.ask(
                "3e", "mathematiques", "theoreme-de-pythagore",
                "Qu'est-ce que l'hypoténuse ?", null);

        assertThat(result.reponse()).isNotBlank();
        assertThat(result.reponse()).isNotEqualTo(TuteurService.REFUSAL_MESSAGE);
        assertThat(result.citations()).isNotEmpty();
    }

    @Test
    void shouldRefuseOffTopicQuestion() {
        TuteurResult result = tuteurService.ask(
                "3e", "mathematiques", "theoreme-de-pythagore",
                "Explique-moi la révolution française.", null);

        assertThat(result.reponse()).isEqualTo(TuteurService.REFUSAL_MESSAGE);
        assertThat(result.citations()).isEmpty();
    }
}
