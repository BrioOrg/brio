package fr.brio.exercices.web;

import fr.brio.exercices.ExercicesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Exercices", description = "Soumission et évaluation des exercices")
class SoumissionController {

    private final ExercicesService exercicesService;

    SoumissionController(ExercicesService exercicesService) {
        this.exercicesService = exercicesService;
    }

    @PostMapping(
            value = "/exercices/{id}/soumissions",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Soumettre une réponse à un exercice",
            description = "Évalue la réponse et retourne le résultat avec la correction. Requiert une authentification.")
    @ApiResponse(responseCode = "200", description = "Réponse évaluée")
    @ApiResponse(responseCode = "401", description = "Non authentifié")
    @ApiResponse(responseCode = "404", description = "Exercice introuvable")
    @ApiResponse(responseCode = "422", description = "Format de réponse invalide ou type d'exercice non supporté")
    ResponseEntity<SoumissionResponse> soumettre(
            @PathVariable UUID id,
            @Valid @RequestBody SoumissionRequest request) {
        return ResponseEntity.ok(SoumissionResponse.from(exercicesService.soumettre(id, request.answer())));
    }
}
