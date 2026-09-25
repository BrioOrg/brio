package fr.brio.contenu.web;

import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.contenu.api.ModifierBrouillonCommand;
import fr.brio.contenu.api.PublicationResult;
import fr.brio.identite.api.EnseignantContexteQuery;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Teacher-facing authoring endpoints (ADR 0019 §4, CDC §8.4): create/save a draft, choose the
 * classes it is scoped to, and publish it. The whole path is gated to {@code ENSEIGNANT}
 * (SecurityConfig). The acting teacher is taken from the session — never trusted from the body —
 * and course ownership is enforced in {@link CoursEditionService}. Reading a course back is a
 * separate concern (drafts are not yet listed/served here; only publication freezes a version
 * served by {@code GET /api/cours/{id}}).
 */
@RestController
@RequestMapping("/api/prof/cours")
@Tag(name = "Édition de cours", description = "Composition et publication de cours par un enseignant")
class ProfCoursController {

    private final CoursEditionService editionService;
    private final EnseignantContexteQuery enseignantContexte;

    ProfCoursController(CoursEditionService editionService, EnseignantContexteQuery enseignantContexte) {
        this.editionService = editionService;
        this.enseignantContexte = enseignantContexte;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Crée un brouillon de cours",
            description = "L'auteur et l'établissement sont déduits de l'enseignant connecté, "
                    + "jamais lus dans la requête. Le contenu est validé à la publication, pas ici.")
    @ApiResponse(responseCode = "201", description = "Brouillon créé")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Réservé aux enseignants")
    @ApiResponse(responseCode = "422", description = "L'enseignant n'a aucune classe : établissement indéterminé")
    ResponseEntity<CoursCreeResponse> creer(
            @Valid @RequestBody CreerCoursRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        UUID auteurId = auteurId(principal);
        UUID etablissementId = enseignantContexte.etablissementDeLEnseignant(auteurId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Aucune classe rattachée : impossible de déterminer l'établissement du cours."));

        UUID coursId = editionService.creerBrouillon(new CreerBrouillonCommand(
                auteurId, etablissementId, req.titre(), req.niveauCode(), req.matiereCode(), req.content()));
        return ResponseEntity.status(HttpStatus.CREATED).body(new CoursCreeResponse(coursId));
    }

    @PutMapping(value = "/{coursId}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Enregistre le brouillon (titre + contenu)")
    @ApiResponse(responseCode = "204", description = "Brouillon enregistré")
    @ApiResponse(responseCode = "403", description = "Le cours ne vous appartient pas")
    @ApiResponse(responseCode = "404", description = "Cours introuvable")
    ResponseEntity<Void> enregistrer(
            @PathVariable UUID coursId,
            @Valid @RequestBody ModifierCoursRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        editionService.enregistrerBrouillon(
                coursId, auteurId(principal), new ModifierBrouillonCommand(req.titre(), req.content()));
        return ResponseEntity.noContent().build();
    }

    @PutMapping(value = "/{coursId}/portees", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Définit les classes auxquelles le cours est porté",
            description = "Chaque classe doit être une classe de l'enseignant connecté.")
    @ApiResponse(responseCode = "204", description = "Portées enregistrées")
    @ApiResponse(responseCode = "403", description = "Cours non détenu, ou classe hors de vos classes")
    @ApiResponse(responseCode = "404", description = "Cours introuvable")
    ResponseEntity<Void> definirPortees(
            @PathVariable UUID coursId,
            @Valid @RequestBody DefinirPorteesRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        UUID auteurId = auteurId(principal);
        var sesClasses = enseignantContexte.classesEnseignees(auteurId);
        if (!sesClasses.containsAll(req.classeIds())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Un cours ne peut être porté qu'à vos propres classes.");
        }
        editionService.definirPortees(coursId, auteurId, req.classeIds());
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{coursId}/publier", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Publie le cours",
            description = "Valide le brouillon et fige une version immuable visible des classes portées. "
                    + "Les réponses de correction sont retirées du contenu figé.")
    @ApiResponse(responseCode = "200", description = "Cours publié ; version figée")
    @ApiResponse(responseCode = "403", description = "Le cours ne vous appartient pas")
    @ApiResponse(responseCode = "404", description = "Cours introuvable")
    @ApiResponse(responseCode = "422", description = "Le brouillon ne respecte pas le schéma / le référentiel")
    ResponseEntity<PublicationResult> publier(
            @PathVariable UUID coursId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(editionService.publier(coursId, auteurId(principal)));
    }

    private static UUID auteurId(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }
}
