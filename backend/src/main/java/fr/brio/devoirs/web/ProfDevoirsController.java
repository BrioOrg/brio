package fr.brio.devoirs.web;

import fr.brio.devoirs.DevoirService;
import fr.brio.devoirs.NouveauDevoir;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Création de devoirs par l'enseignant (F4). Gated {@code ENSEIGNANT} par {@code /api/prof/**} dans
 * SecurityConfig ; l'auteur est pris dans la session, on ne peut créer que pour ses propres classes.
 */
@RestController
@RequestMapping("/api/prof/devoirs")
@Tag(name = "Devoirs", description = "Devoirs assignés par un enseignant à sa classe (F4)")
class ProfDevoirsController {

    private final DevoirService devoirs;

    ProfDevoirsController(DevoirService devoirs) {
        this.devoirs = devoirs;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Crée un devoir pour une de ses classes")
    @ApiResponse(responseCode = "201", description = "Devoir créé")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Réservé à l'enseignant de la classe")
    ResponseEntity<Map<String, UUID>> creer(
            @Valid @RequestBody CreerDevoirRequest req, Authentication auth) {
        UUID id =
                devoirs.creerDevoir(
                        UUID.fromString(auth.getName()),
                        new NouveauDevoir(
                                req.classeId(),
                                req.titre(),
                                req.consigne(),
                                req.sourceType(),
                                req.sourceRef(),
                                req.sourceVersion(),
                                req.exerciceIds(),
                                req.ouvreAt(),
                                req.echeanceAt()));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }
}
