package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.ClasseInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The connected teacher's own classes, for the course editor's publish screen (ADR 0019 §4,
 * CDC §8.4). Gated to {@code ENSEIGNANT} by {@code /api/prof/**} in SecurityConfig; the teacher
 * is taken from the session, so it can only ever return the caller's classes.
 */
@RestController
@RequestMapping("/api/prof/classes")
@Tag(name = "Édition de cours", description = "Composition et publication de cours par un enseignant")
class ProfClassesController {

    private final ClasseService classeService;

    ProfClassesController(ClasseService classeService) {
        this.classeService = classeService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Liste les classes de l'enseignant connecté",
            description = "Les classes actives dont l'enseignant est le professeur principal — "
                    + "les seules auxquelles il peut porter un cours.")
    @ApiResponse(responseCode = "200", description = "Classes de l'enseignant")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Réservé aux enseignants")
    List<ClasseInfo> mesClasses(Authentication auth) {
        return classeService.classesDeLEnseignant(UUID.fromString(auth.getName()));
    }
}
