package fr.brio.devoirs.domain;

import java.util.Collection;

/**
 * Dérive le statut et le score d'un rendu à partir des exercices déjà soumis, sans base de données
 * (ADR 0020 §3). Le rendu est « dérivé » : l'élève ne « rend » pas explicitement, il fait les
 * exercices dans l'app, et le statut suit ses soumissions. Logique pure, testable sans le DOM ni la DB.
 */
public final class DerivationRendu {

    /** Codes de statut du rendu (colonne devoirs.rendus.statut). */
    public static final String NON_COMMENCE = "non_commence";

    public static final String EN_COURS = "en_cours";
    public static final String RENDU = "rendu";

    private DerivationRendu() {}

    public record Resultat(String statut, Double score) {}

    /**
     * @param scoresSoumis les scores [0,1] des exercices du devoir déjà soumis par l'élève
     * @param nombreExercices le nombre total d'exercices du devoir
     * @return le statut ({@code non_commence} → {@code en_cours} → {@code rendu}) et le score moyen
     *     des exercices soumis (nul tant qu'aucun n'est soumis)
     */
    public static Resultat deriver(Collection<Double> scoresSoumis, int nombreExercices) {
        int soumis = scoresSoumis.size();
        if (soumis == 0) {
            return new Resultat(NON_COMMENCE, null);
        }
        double moyenne = scoresSoumis.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        String statut = soumis >= nombreExercices ? RENDU : EN_COURS;
        return new Resultat(statut, moyenne);
    }
}
