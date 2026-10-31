package fr.brio.contenu.web;

import fr.brio.contenu.ReferentielService;
import fr.brio.contenu.api.CompetenceLibelle;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    ReferentielController(ReferentielService referentielService) {
        this.referentielService = referentielService;
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
}
