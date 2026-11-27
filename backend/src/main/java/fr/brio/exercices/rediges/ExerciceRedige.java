package fr.brio.exercices.rediges;

import fr.brio.exercices.rediges.ExercicesRedigesContrats.CleCorrection;
import java.time.Instant;
import java.util.UUID;

record ExerciceRedige(
        UUID id,
        int version,
        UUID coursId,
        UUID auteurId,
        String niveau,
        String matiere,
        String slug,
        String titre,
        String enonce,
        String reponseAttendue,
        String corrige,
        ModeCorrection modeCorrection,
        boolean photoAutorisee,
        String copieModele,
        Instant echeance,
        Instant publieAt,
        Instant clotureAt,
        CleCorrection cleCorrection) {

    enum ModeCorrection {
        automatique,
        enseignant,
        ia
    }

    boolean publie() {
        return coursId == null || publieAt != null;
    }

    Instant echeanceEffective() {
        return clotureAt == null ? echeance : clotureAt;
    }

    boolean closA(Instant instant) {
        Instant effective = echeanceEffective();
        return effective != null && !instant.isBefore(effective);
    }
}
