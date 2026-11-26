package fr.brio.exercices.rediges;

import fr.brio.exercices.rediges.ExercicesRedigesContrats.EcritureExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeProf;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/prof/exercices-rediges", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Exercices rédigés enseignant", description = "Édition, publication et clôture des exercices rédigés")
class ProfExercicesRedigesController {
    private final ExercicesRedigesService service;

    ProfExercicesRedigesController(ExercicesRedigesService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Liste les exercices rédigés de l’enseignant connecté")
    ResponseEntity<List<ExerciceRedigeProf>> listerExercicesRedigesProf(@AuthenticationPrincipal UserDetails principal) {
        return prive(service.listerProf(auteur(principal)));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Crée un brouillon d’exercice rédigé")
    ResponseEntity<ExerciceRedigeProf> creerExerciceRedige(
            @Valid @RequestBody EcritureExerciceRedige entree, @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(service.creer(auteur(principal), entree));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Met à jour un brouillon d’exercice rédigé")
    ResponseEntity<ExerciceRedigeProf> modifierExerciceRedige(@PathVariable UUID id,
            @Valid @RequestBody EcritureExerciceRedige entree, @AuthenticationPrincipal UserDetails principal) {
        return prive(service.enregistrer(id, auteur(principal), entree));
    }

    @PostMapping("/{id}/publier")
    @Operation(summary = "Vérifie et publie un exercice rédigé")
    ResponseEntity<ExerciceRedigeProf> publierExerciceRedige(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return prive(service.publier(id, auteur(principal)));
    }

    @PostMapping("/{id}/cloturer")
    @Operation(summary = "Clôture plus tôt un exercice rédigé qui possède une échéance")
    ResponseEntity<ExerciceRedigeProf> cloturerExerciceRedige(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return prive(service.cloturer(id, auteur(principal)));
    }

    private static UUID auteur(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }

    private static <T> ResponseEntity<T> prive(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
