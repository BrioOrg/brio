package fr.brio.devoirs.web;

import fr.brio.devoirs.DevoirClasseVue;
import fr.brio.devoirs.DevoirService;
import fr.brio.devoirs.NouveauDevoir;
import fr.brio.devoirs.TableauDeBordDevoir;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Liste les devoirs d'une de ses classes")
    @ApiResponse(responseCode = "200", description = "Devoirs de la classe")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Réservé à l'enseignant de la classe")
    List<DevoirClasseVue> listerClasse(@RequestParam UUID classeId, Authentication auth) {
        return devoirs.listerPourClasse(classeId, UUID.fromString(auth.getName()));
    }

    @GetMapping(value = "/{id}/tableau-de-bord", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Le tableau de bord d'un devoir (qui a rendu, réussite par compétence)")
    @ApiResponse(responseCode = "200", description = "Tableau de bord")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Réservé à l'enseignant de la classe")
    @ApiResponse(responseCode = "404", description = "Devoir introuvable")
    TableauDeBordDevoir tableauDeBord(@PathVariable UUID id, Authentication auth) {
        return devoirs.tableauDeBord(id, UUID.fromString(auth.getName()));
    }
}
