package fr.brio.exercices.rediges;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.brio.exercices.rediges.ExerciceRedige.ModeCorrection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

final class ExercicesRedigesContrats {
    static final int MAX_REPONSE_TEXTE = 12_000;

    private ExercicesRedigesContrats() {}

    record ExerciceRedigeResume(UUID id, String titre) {}

    record EcritureExerciceRedige(
            @NotNull UUID coursId,
            @NotNull @Size(max = 160) String titre,
            @NotNull @Size(max = 8_000) String enonce,
            @Size(max = 512) String reponseAttendue,
            @NotNull @Size(max = 8_000) String corrige,
            Instant echeance,
            ModeCorrection modeCorrection,
            boolean photoAutorisee,
            @Size(max = MAX_REPONSE_TEXTE) String copieModele) {}

    record RemiseExerciceRedige(@Positive int version, @NotNull @Size(max = MAX_REPONSE_TEXTE) String reponse) {}

    record PublierRetour(@NotBlank @Size(max = 8_000) String commentaire) {}

    record RetourCopie(String commentaire, Instant publieAt) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record CopieExerciceRedige(
            String reponse, Boolean correct, Instant remisAt, boolean photo, RetourCopie retour) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record CopiePourRevue(
            UUID eleveId, String nomAffiche, String reponse, Instant remisAt, boolean photo, RetourCopie retour) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record ExerciceRedigeEleve(
            UUID id,
            int version,
            String titre,
            String enonce,
            UUID coursId,
            String niveau,
            String matiere,
            String slug,
            Instant echeance,
            boolean cloture,
            String corrige,
            ModeCorrection modeCorrection,
            boolean photoAutorisee,
            String copieModele,
            CopieExerciceRedige soumission) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record ExerciceRedigeProf(
            UUID id,
            UUID coursId,
            int version,
            String titre,
            String enonce,
            String reponseAttendue,
            String corrige,
            ModeCorrection modeCorrection,
            boolean photoAutorisee,
            String copieModele,
            Instant echeance,
            boolean publie,
            boolean cloture) {}
}
