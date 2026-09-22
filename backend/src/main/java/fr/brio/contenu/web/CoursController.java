package fr.brio.contenu.web;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.contenu.CoursLectureService;
import fr.brio.identite.api.InscriptionsQuery;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves a published teacher course to a scoped student (ADR 0019 §1). Unlike the public
 * catalogue, this endpoint is authenticated: we must know the student to enforce the course's
 * portées ({@code cours_portees}). The returned JSON is the same client-facing shape as a
 * catalogue chapter, so {@code <ChapterView/>} renders it identically (§8.6).
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Contenu", description = "Accès aux cours d'enseignant publiés")
class CoursController {

    private final CoursLectureService coursLectureService;
    private final InscriptionsQuery inscriptionsQuery;

    CoursController(CoursLectureService coursLectureService, InscriptionsQuery inscriptionsQuery) {
        this.coursLectureService = coursLectureService;
        this.inscriptionsQuery = inscriptionsQuery;
    }

    @GetMapping(value = "/cours/{coursId}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Récupère un cours d'enseignant publié",
            description = "Retourne la version publiée du cours, dans le même format qu'un chapitre de "
                    + "catalogue. Réservé aux élèves des classes portées. Les réponses correctes des "
                    + "exercices ne sont jamais incluses.")
    @ApiResponse(responseCode = "200", description = "Cours trouvé et accessible")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Cours non accessible à l'élève (hors portée)")
    @ApiResponse(responseCode = "404", description = "Cours introuvable ou non publié")
    ResponseEntity<JsonNode> getCoursPublie(
            @PathVariable UUID coursId,
            @AuthenticationPrincipal UserDetails principal) {
        JsonNode contenu = coursLectureService.contenuPublie(coursId).orElse(null);
        if (contenu == null) {
            return ResponseEntity.notFound().build();
        }
        Set<UUID> classesEleve = inscriptionsQuery.classesDeLEleve(UUID.fromString(principal.getUsername()));
        if (!coursLectureService.estVisiblePour(coursId, classesEleve)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(contenu);
    }
}
