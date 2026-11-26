package fr.brio.exercices.rediges;

import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeEleve;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeResume;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.RemiseExerciceRedige;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/exercices-rediges", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Exercices rédigés", description = "Lecture, remise et corrigé des exercices rédigés")
class ExercicesRedigesController {
    private final ExercicesRedigesService service;

    ExercicesRedigesController(ExercicesRedigesService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Liste les exercices rédigés publiés d’une leçon accessible")
    ResponseEntity<List<ExerciceRedigeResume>> listerExercicesRediges(
            @RequestParam(required = false) UUID coursId,
            @RequestParam(required = false) String niveau,
            @RequestParam(required = false) String matiere,
            @RequestParam(required = false) String slug,
            @AuthenticationPrincipal UserDetails principal) {
        return prive(service.listerEleve(eleve(principal), coursId, niveau, matiere, slug));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Ouvre un exercice rédigé et la copie de l’élève")
    ResponseEntity<ExerciceRedigeEleve> lireExerciceRedige(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return prive(service.lire(id, eleve(principal)));
    }

    @PostMapping(value = "/{id}/soumission", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Remet la première copie valide de l’exercice rédigé")
    ResponseEntity<ExerciceRedigeEleve> soumettreExerciceRedige(@PathVariable UUID id,
            @Valid @RequestBody RemiseExerciceRedige remise, @AuthenticationPrincipal UserDetails principal) {
        return prive(service.soumettre(id, eleve(principal), remise));
    }

    private static UUID eleve(UserDetails principal) {
        if (principal == null || principal.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_ELEVE"))) {
            throw new ExerciceRedigeException(HttpStatus.FORBIDDEN, "ACCES_REFUSE", "Réservé aux élèves.");
        }
        return UUID.fromString(principal.getUsername());
    }

    private static <T> ResponseEntity<T> prive(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
