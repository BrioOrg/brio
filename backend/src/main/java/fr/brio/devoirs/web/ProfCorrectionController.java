package fr.brio.devoirs.web;

import fr.brio.devoirs.DevoirService;
import fr.brio.devoirs.PieceInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Correction des copies par l'enseignant (F5, ADR 0028). Gated {@code ENSEIGNANT} par
 * {@code /api/prof/**} ; l'accès à une classe précise est revérifié dans le service.
 */
@RestController
@RequestMapping("/api/prof/devoirs")
@Tag(name = "Devoirs", description = "Correction des copies déposées (F5)")
class ProfCorrectionController {

    private final DevoirService devoirs;

    ProfCorrectionController(DevoirService devoirs) {
        this.devoirs = devoirs;
    }

    @GetMapping(value = "/{devoirId}/rendus/{eleveId}/pieces", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Liste les copies déposées par un élève, pour l'enseignant du devoir")
    @ApiResponse(responseCode = "200", description = "Copies de l'élève")
    @ApiResponse(responseCode = "403", description = "Réservé à l'enseignant de la classe")
    List<PieceInfo> pieces(
            @PathVariable UUID devoirId, @PathVariable UUID eleveId, Authentication auth) {
        return devoirs.listerPiecesPourProf(devoirId, eleveId, UUID.fromString(auth.getName()));
    }

    @PostMapping(
            value = "/{devoirId}/rendus/{eleveId}/correction",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Corrige le rendu d'un élève (note, appréciation)")
    @ApiResponse(responseCode = "204", description = "Correction enregistrée")
    @ApiResponse(responseCode = "403", description = "Réservé à l'enseignant de la classe")
    ResponseEntity<Void> corriger(
            @PathVariable UUID devoirId,
            @PathVariable UUID eleveId,
            @Valid @RequestBody CorrectionRequest req,
            Authentication auth) {
        devoirs.corrigerRendu(
                devoirId, eleveId, UUID.fromString(auth.getName()), req.note(), req.appreciation());
        return ResponseEntity.noContent().build();
    }
}
