package fr.brio.devoirs.domain;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Agrégation du tableau de bord d'un devoir (ADR 0020 §5), côté domaine et pure (testable sans DB).
 * La « réussite par compétence » se calcule à partir des scores des exercices soumis par toute la
 * classe : chaque exercice soumis contribue son score [0,1] à chacune de ses compétences.
 */
public final class TableauDeBord {

    private TableauDeBord() {}

    /** Un score d'exercice soumis rattaché à une compétence (aplati : une entrée par compétence). */
    public record ScoreCompetence(String code, double score) {}

    /** La réussite agrégée d'une compétence sur la classe. */
    public record ReussiteCompetence(String code, double tauxReussite, int nombreReponses) {}

    /**
     * Taux de réussite moyen par code de compétence (moyenne des scores [0,1]), trié par code.
     * Une compétence sans réponse n'apparaît pas.
     */
    public static List<ReussiteCompetence> parCompetence(Collection<ScoreCompetence> scores) {
        Map<String, List<ScoreCompetence>> parCode =
                scores.stream().collect(Collectors.groupingBy(ScoreCompetence::code));
        return parCode.entrySet().stream()
                .map(
                        e -> {
                            double taux =
                                    e.getValue().stream()
                                            .mapToDouble(ScoreCompetence::score)
                                            .average()
                                            .orElse(0.0);
                            return new ReussiteCompetence(e.getKey(), taux, e.getValue().size());
                        })
                .sorted(Comparator.comparing(ReussiteCompetence::code))
                .toList();
    }
}
