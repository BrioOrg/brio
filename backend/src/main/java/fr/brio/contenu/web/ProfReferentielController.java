package fr.brio.contenu.web;

import fr.brio.contenu.ReferentielService;
import fr.brio.contenu.api.CompetenceDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes the competency referential (ADR 0009) to the teacher editor so codes can be picked by
 * their human label (issue #144). Gated to {@code ENSEIGNANT} by the {@code /api/prof/**} rule in
 * SecurityConfig — it is authoring reference data, not student-facing. Read-only; only active codes
 * are returned so the picker can never offer one that publication would reject.
 */
@RestController
@RequestMapping("/api/prof/referentiel")
@Tag(name = "Référentiel de compétences", description = "Lecture du référentiel pour l'édition de cours")
class ProfReferentielController {

    private final ReferentielService referentielService;

    ProfReferentielController(ReferentielService referentielService) {
        this.referentielService = referentielService;
    }

    @GetMapping(value = "/competences", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Liste les compétences actives du référentiel",
            description = "Chaque entrée porte son code, son libellé, son domaine et ses niveaux. "
                    + "Les codes dépréciés ne sont jamais renvoyés.")
    @ApiResponse(responseCode = "200", description = "Compétences actives")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Réservé aux enseignants")
    List<CompetenceDto> competences() {
        return referentielService.competencesActives();
    }
}
