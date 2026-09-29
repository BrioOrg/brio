package fr.brio.contenu.web;

import fr.brio.contenu.AnnaleDto;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.ExerciceEntrainementDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/annales")
@Tag(name = "Annales", description = "Sujets d'examen : parcours et entraînement par compétence (F7)")
class AnnaleController {

    private final ContenuService contenuService;

    AnnaleController(ContenuService contenuService) {
        this.contenuService = contenuService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Liste les annales",
            description = "Sujets d'examen, du plus récent au plus ancien. Filtres optionnels "
                    + "niveau/matière/année. Le sujet se lit via l'endpoint chapitre par triplet.")
    @ApiResponse(responseCode = "200", description = "Annales retournées")
    ResponseEntity<List<AnnaleDto>> lister(
            @RequestParam(required = false) String niveau,
            @RequestParam(required = false) String matiere,
            @RequestParam(required = false) Integer annee) {
        return ResponseEntity.ok(contenuService.listerAnnales(niveau, matiere, annee));
    }

    @GetMapping(value = "/entrainement", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Entraînement par compétence",
            description = "Les exercices d'annales portant la compétence donnée. La correction n'est "
                    + "jamais incluse ; la soumission passe par le flux exercices habituel.")
    @ApiResponse(responseCode = "200", description = "Exercices retournés")
    ResponseEntity<List<ExerciceEntrainementDto>> entrainement(@RequestParam String competence) {
        return ResponseEntity.ok(contenuService.entrainementParCompetence(competence));
    }
}
