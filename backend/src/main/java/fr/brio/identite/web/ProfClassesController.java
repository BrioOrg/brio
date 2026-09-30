package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.ClasseInfo;
import fr.brio.identite.api.CodeClasseCreee;
import fr.brio.identite.api.CreerMaClasseRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The connected teacher's own classes: listed for the course editor's publish screen (ADR 0019
 * §4, CDC §8.4), created and given a code by the teacher themselves (ADR 0029 §3). Gated to
 * {@code ENSEIGNANT} by {@code /api/prof/**} in SecurityConfig; the teacher is taken from the
 * session, so it can only ever reach the caller's classes.
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

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Crée une classe pour l'enseignant connecté",
            description = "L'enseignant en devient le professeur principal. L'année scolaire est "
                    + "calculée par le serveur.")
    @ApiResponse(responseCode = "201", description = "Classe créée")
    @ApiResponse(responseCode = "400", description = "Champs invalides")
    @ApiResponse(responseCode = "403", description = "L'enseignant n'est pas rattaché à cet établissement")
    ClasseInfo creer(@Valid @RequestBody CreerMaClasseRequest req, Authentication auth) {
        return classeService.creerClassePourEnseignant(
                UUID.fromString(auth.getName()), req.etablissementId(), req.niveauCode(), req.libelle());
    }

    @PostMapping(value = "/{id}/code", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Génère le code d'une classe de l'enseignant connecté",
            description = "Le code n'est renvoyé qu'une fois. Un nouveau code invalide le précédent.")
    @ApiResponse(responseCode = "201", description = "Code généré")
    @ApiResponse(responseCode = "403", description = "La classe n'est pas celle de l'enseignant")
    @ApiResponse(responseCode = "404", description = "Classe introuvable")
    CodeClasseCreee genererCode(@PathVariable UUID id, Authentication auth) {
        return classeService.genererCodePourEnseignant(id, UUID.fromString(auth.getName()));
    }
}
