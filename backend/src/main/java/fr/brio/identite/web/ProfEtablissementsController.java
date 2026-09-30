package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.EtablissementPublicInfo;
import fr.brio.identite.api.RattacherEtablissementRequest;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The établissements the connected teacher is attached to (ADR 0029 §2). A teacher picks
 * among existing établissements and never creates one. Gated to {@code ENSEIGNANT} by
 * {@code /api/prof/**} in SecurityConfig.
 */
@RestController
@RequestMapping("/api/prof/etablissements")
@Tag(name = "Classes de l'enseignant", description = "Établissements et classes de l'enseignant connecté")
class ProfEtablissementsController {

    private final ClasseService classeService;

    ProfEtablissementsController(ClasseService classeService) {
        this.classeService = classeService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Liste les établissements de l'enseignant connecté")
    @ApiResponse(responseCode = "200", description = "Établissements de l'enseignant")
    List<EtablissementPublicInfo> mesEtablissements(Authentication auth) {
        return classeService.etablissementsDeLEnseignant(UUID.fromString(auth.getName()));
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Rattache l'enseignant connecté à un établissement supplémentaire")
    @ApiResponse(responseCode = "201", description = "Rattachement enregistré")
    @ApiResponse(responseCode = "404", description = "Établissement introuvable")
    EtablissementPublicInfo rattacher(@Valid @RequestBody RattacherEtablissementRequest req,
                                      Authentication auth) {
        return classeService.rattacher(UUID.fromString(auth.getName()), req.etablissementId());
    }
}
