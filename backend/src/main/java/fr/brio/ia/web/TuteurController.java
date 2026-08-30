package fr.brio.ia.web;

import fr.brio.ia.domain.TuteurResult;
import fr.brio.ia.domain.TuteurService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "IA", description = "Tuteur IA par chapitre")
class TuteurController {

    // Authentication is required here, unlike the read-only /chapitres endpoints.
    // Reason: this endpoint calls a paid third-party API on every request; an
    // unauthenticated surface is a scriptable cost-and-abuse vector.
    private final TuteurService tuteurService;

    TuteurController(TuteurService tuteurService) {
        this.tuteurService = tuteurService;
    }

    @PostMapping(
            value = "/chapitres/{niveau}/{matiere}/{slug}/tuteur",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Pose une question au tuteur IA du chapitre",
            description = "Répond à partir du contenu du chapitre uniquement, avec citations vérifiées côté serveur.")
    @ApiResponse(responseCode = "200", description = "Réponse du tuteur")
    @ApiResponse(responseCode = "400", description = "Requête invalide")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "404", description = "Chapitre introuvable")
    ResponseEntity<TuteurResponse> ask(
            @PathVariable String niveau,
            @PathVariable String matiere,
            @PathVariable String slug,
            @RequestBody @Valid TuteurRequest request) {
        TuteurResult result = tuteurService.ask(
                niveau, matiere, slug, request.question(), request.exerciceId());
        return ResponseEntity.ok(new TuteurResponse(result.reponse(), result.citations()));
    }
}
