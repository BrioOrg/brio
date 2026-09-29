package fr.brio.devoirs;

import fr.brio.devoirs.domain.TableauDeBord.ReussiteCompetence;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Le tableau de bord d'un devoir pour l'enseignant (ADR 0020 §5) : qui a rendu, et la réussite par
 * compétence sur la classe. Les scores/corrections restent côté enseignant (jamais renvoyés à l'élève
 * avant l'échéance — c'est une vue prof).
 */
public record TableauDeBordDevoir(
        UUID devoirId,
        String titre,
        Instant echeanceAt,
        int total,
        int nbRendu,
        int nbEnCours,
        int nbNonCommence,
        Double moyenne,
        List<LigneEleve> eleves,
        List<ReussiteCompetence> parCompetence) {

    /** Une ligne élève du tableau de bord. */
    public record LigneEleve(UUID eleveId, String nomAffiche, String statut, Double score) {}
}
