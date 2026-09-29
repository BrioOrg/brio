package fr.brio.contenu.web;

import fr.brio.contenu.AnnaleDto;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.ExamenActif;
import fr.brio.contenu.ExamenDemarre;
import fr.brio.contenu.ExamenService;
import fr.brio.contenu.ExerciceEntrainementDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/annales")
@Tag(name = "Annales", description = "Sujets d'examen : parcours, entraînement par compétence, mode examen (F7)")
class AnnaleController {

  private final ContenuService contenuService;
  private final ExamenService examenService;

  AnnaleController(ContenuService contenuService, ExamenService examenService) {
    this.contenuService = contenuService;
    this.examenService = examenService;
  }

  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Liste les annales",
      description =
          "Sujets d'examen, du plus récent au plus ancien. Filtres optionnels "
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
      description =
          "Les exercices d'annales portant la compétence donnée. La correction n'est "
              + "jamais incluse ; la soumission passe par le flux exercices habituel.")
  @ApiResponse(responseCode = "200", description = "Exercices retournés")
  ResponseEntity<List<ExerciceEntrainementDto>> entrainement(@RequestParam String competence) {
    return ResponseEntity.ok(contenuService.entrainementParCompetence(competence));
  }

  @PostMapping(value = "/{id}/examen", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Démarre un examen sur une annale (mode examen, ADR 0027)",
      description = "Ouvre une session chronométrée ; le tuteur est coupé jusqu'à la fin.")
  @ApiResponse(responseCode = "200", description = "Session démarrée (ou déjà en cours)")
  @ApiResponse(responseCode = "401", description = "Authentification requise")
  @ApiResponse(responseCode = "404", description = "Annale introuvable")
  ExamenDemarre demarrerExamen(@PathVariable String id, Authentication auth) {
    return examenService.demarrer(UUID.fromString(auth.getName()), id);
  }

  @PostMapping(value = "/examen/{sessionId}/rendre", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(summary = "Termine une session d'examen (rendu)")
  @ApiResponse(responseCode = "200", description = "Session terminée")
  @ApiResponse(responseCode = "401", description = "Authentification requise")
  @ApiResponse(responseCode = "404", description = "Session introuvable")
  ResponseEntity<Void> rendreExamen(@PathVariable UUID sessionId, Authentication auth) {
    examenService.rendre(sessionId, UUID.fromString(auth.getName()));
    return ResponseEntity.noContent().build();
  }

  @GetMapping(value = "/examen-actif", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(summary = "L'examen en cours de l'élève (pour le chrono + verrou tuteur), le cas échéant")
  @ApiResponse(responseCode = "200", description = "Examen actif (ou aucun)")
  @ApiResponse(responseCode = "401", description = "Authentification requise")
  ExamenActif examenActif(Authentication auth) {
    return examenService.actif(UUID.fromString(auth.getName()));
  }
}
