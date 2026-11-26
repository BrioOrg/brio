package fr.brio.exercices.rediges;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

final class ExercicesRedigesContrats {
    private ExercicesRedigesContrats() {}

    record ExerciceRedigeResume(UUID id, String titre) {}

    record EcritureExerciceRedige(
            @NotNull UUID coursId,
            @NotNull @Size(max = 160) String titre,
            @NotNull @Size(max = 8_000) String enonce,
            @NotNull @Size(max = 512) String reponseAttendue,
            @NotNull @Size(max = 8_000) String corrige,
            Instant echeance) {}

    record RemiseExerciceRedige(@Positive int version, @NotNull String reponse) {}

    record CopieExerciceRedige(String reponse, boolean correct, Instant remisAt) {}

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
            Instant echeance,
            boolean publie,
            boolean cloture) {}
}
