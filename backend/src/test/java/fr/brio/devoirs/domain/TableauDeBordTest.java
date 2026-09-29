package fr.brio.devoirs.domain;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.devoirs.domain.TableauDeBord.ReussiteCompetence;
import fr.brio.devoirs.domain.TableauDeBord.ScoreCompetence;
import java.util.List;
import org.junit.jupiter.api.Test;

class TableauDeBordTest {

    @Test
    void aucun_score_donne_aucune_competence() {
        assertThat(TableauDeBord.parCompetence(List.of())).isEmpty();
    }

    @Test
    void moyenne_le_taux_par_code_et_trie_par_code() {
        List<ScoreCompetence> scores =
                List.of(
                        new ScoreCompetence("geo.pythagore", 1.0),
                        new ScoreCompetence("geo.pythagore", 0.0),
                        new ScoreCompetence("calc.fractions", 0.5));

        List<ReussiteCompetence> parCompetence = TableauDeBord.parCompetence(scores);

        // trié par code : calc avant geo
        assertThat(parCompetence)
                .containsExactly(
                        new ReussiteCompetence("calc.fractions", 0.5, 1),
                        new ReussiteCompetence("geo.pythagore", 0.5, 2));
    }

    @Test
    void compte_les_reponses_par_competence() {
        List<ScoreCompetence> scores =
                List.of(
                        new ScoreCompetence("c1", 1.0),
                        new ScoreCompetence("c1", 1.0),
                        new ScoreCompetence("c1", 1.0));

        assertThat(TableauDeBord.parCompetence(scores))
                .containsExactly(new ReussiteCompetence("c1", 1.0, 3));
    }
}
