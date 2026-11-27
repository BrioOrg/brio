package fr.brio.exercices.rediges;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.brio.exercices.rediges.ExerciceRedige.ModeCorrection;
import fr.brio.exercices.rediges.RetourExerciceApi.Etat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
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
            @Size(max = MAX_REPONSE_TEXTE) String copieModele,
            @Valid CleCorrection cleCorrection) {}

    enum TypeCle { traduction, liste }

    record CritereCorrection(
            @NotNull @Size(max = 180) String attendu,
            @NotNull @Size(max = 4) List<@NotBlank @Size(max = 100) String> variantes) {}

    record CleCorrection(
            @NotNull TypeCle type,
            @Positive int minimum,
            @NotNull @Size(min = 1, max = 6) List<@NotNull @Valid CritereCorrection> criteres,
            @Size(max = 500) String extraitLecon,
            boolean confirmee) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record CritereEvalue(String attendu, Etat etat, String extrait) {}

    enum EtatRetourIa { en_attente, disponible, indisponible }

    record RetourIa(EtatRetourIa etat, int minimum, List<CritereEvalue> criteres) {
        static RetourIa enAttente() {
            return new RetourIa(EtatRetourIa.en_attente, 0, List.of());
        }

        static RetourIa indisponible() {
            return new RetourIa(EtatRetourIa.indisponible, 0, List.of());
        }
    }

    record RemiseExerciceRedige(@Positive int version, @NotNull @Size(max = MAX_REPONSE_TEXTE) String reponse) {}

    record PublierRetour(@NotBlank @Size(max = 8_000) String commentaire) {}

    record RetourCopie(String commentaire, Instant publieAt) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record CopieExerciceRedige(
            String reponse, Boolean correct, Instant remisAt, boolean photo, RetourCopie retour, RetourIa retourIa) {}

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
            CleCorrection cleCorrection,
            Instant echeance,
            boolean publie,
            boolean cloture) {}
}
