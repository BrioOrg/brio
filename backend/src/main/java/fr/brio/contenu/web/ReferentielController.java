package fr.brio.contenu.web;

import fr.brio.contenu.LeconCompetenceService;
import fr.brio.contenu.ReferentielService;
import fr.brio.contenu.api.CompetenceLibelle;
import fr.brio.contenu.api.LeconCompetence;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The referential's labels for any logged-in account (#324): progression only knows competency
 * codes, and a student must read a name, never a code. The authoring view stays
 * {@link ProfReferentielController}.
 */
@RestController
@RequestMapping("/api/referentiel")
@Tag(name = "Référentiel de compétences", description = "Lecture du référentiel pour l'édition de cours")
class ReferentielController {

    private final ReferentielService referentielService;
    private final LeconCompetenceService leconCompetenceService;

    ReferentielController(ReferentielService referentielService, LeconCompetenceService leconCompetenceService) {
        this.referentielService = referentielService;
        this.leconCompetenceService = leconCompetenceService;
    }

    @GetMapping(value = "/libelles", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Liste le libellé de chaque compétence",
            description = "Codes dépréciés compris : un élève peut les avoir travaillés.")
    @ApiResponse(responseCode = "200", description = "Libellés des compétences")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    List<CompetenceLibelle> libelles() {
        return referentielService.libelles();
    }

    @GetMapping(value = "/lecon", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Trouve la leçon qui enseigne une compétence",
            description = "Première section de leçon portant la compétence ; les chapitres du niveau demandé"
                    + " passent d'abord (ADR 0043).")
    @ApiResponse(responseCode = "200", description = "Leçon à revoir")
    @ApiResponse(responseCode = "204", description = "Aucune leçon rattachable à cette compétence", content = @Content)
    @ApiResponse(responseCode = "400", description = "Compétence absente ou vide", content = @Content)
    @ApiResponse(responseCode = "401", description = "Authentification requise", content = @Content)
    ResponseEntity<LeconCompetence> lecon(
            
            @Parameter(required = true, description = "Code de la compétence ; 400 s'il est absent ou vide")
                    @RequestParam(required = false) String competence,
            @RequestParam(required = false) String niveau) {
        if (competence == null || competence.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Compétence requise");
        }
        return leconCompetenceService
                .trouver(competence, niveau)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
