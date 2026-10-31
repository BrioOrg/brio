package fr.brio.social.web;

import fr.brio.social.AccesCommunauteRefuseException;
import fr.brio.social.CommunauteService;
import fr.brio.social.PageQuestionsCommunaute;
import fr.brio.social.QuestionCommunauteDetail;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * API de la Communauté, réservée aux comptes élèves (ADR 0035).
 *
 * <p>Réglage désactivé, ce contrôleur n'existe pas : les routes répondent comme n'importe quelle
 * route inconnue. C'est pourquoi le rôle se vérifie ici et non dans {@code SecurityConfig}, où un
 * enseignant recevrait un 403 même réglage désactivé, et saurait donc que la route existe.
 */
@RestController
@ConditionalOnProperty(name = "brio.communaute.active", havingValue = "true")
@RequestMapping(value = "/api/communaute", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Communauté", description = "Questions et réponses entre élèves, sous pseudonyme")
class CommunauteController {

    private static final String ROLE_ELEVE = "ROLE_ELEVE";

    private final CommunauteService communaute;

    CommunauteController(CommunauteService communaute) {
        this.communaute = communaute;
    }

    @GetMapping("/questions")
    @Operation(summary = "Lister les questions, les plus récentes d'abord")
    PageQuestionsCommunaute lister(
            @RequestParam(required = false) String niveau,
            @RequestParam(required = false) String matiere,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int taille,
            @AuthenticationPrincipal UserDetails principal) {
        return communaute.lister(eleve(principal), niveau, matiere, page, taille);
    }

    @PostMapping("/questions")
    @Operation(summary = "Poser une question")
    ResponseEntity<Map<String, UUID>> poser(
            @Valid @RequestBody PoserQuestionRequest req, @AuthenticationPrincipal UserDetails principal) {
        return cree(communaute.poserQuestion(eleve(principal), req.titre(), req.corps(), req.matiere()));
    }

    @GetMapping("/questions/{questionId}")
    @Operation(summary = "Détailler une question, ses réponses et leurs commentaires")
    QuestionCommunauteDetail consulter(
            @PathVariable UUID questionId, @AuthenticationPrincipal UserDetails principal) {
        return communaute.consulter(questionId, eleve(principal));
    }

    @PutMapping("/questions/{questionId}")
    @Operation(summary = "Modifier sa question")
    ResponseEntity<Void> modifierQuestion(
            @PathVariable UUID questionId,
            @Valid @RequestBody ModifierQuestionRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        communaute.modifierQuestion(questionId, eleve(principal), req.titre(), req.corps());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/questions/{questionId}")
    @Operation(summary = "Supprimer sa question")
    ResponseEntity<Void> supprimerQuestion(
            @PathVariable UUID questionId, @AuthenticationPrincipal UserDetails principal) {
        communaute.supprimerQuestion(questionId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/questions/{questionId}/reponses")
    @Operation(summary = "Répondre à une question")
    ResponseEntity<Map<String, UUID>> repondre(
            @PathVariable UUID questionId,
            @Valid @RequestBody CorpsCommunauteRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return cree(communaute.repondre(questionId, eleve(principal), req.corps()));
    }

    @PostMapping("/questions/{questionId}/reponses/{reponseId}/resolution")
    @Operation(summary = "Marquer la réponse qui a résolu la question (auteur de la question uniquement)")
    ResponseEntity<Void> resoudre(
            @PathVariable UUID questionId,
            @PathVariable UUID reponseId,
            @AuthenticationPrincipal UserDetails principal) {
        communaute.resoudre(questionId, reponseId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/questions/{questionId}/vote")
    @Operation(summary = "Voter « Utile » pour une question")
    ResponseEntity<Void> voterQuestion(
            @PathVariable UUID questionId, @AuthenticationPrincipal UserDetails principal) {
        communaute.voterQuestion(questionId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/questions/{questionId}/vote")
    @Operation(summary = "Retirer son vote sur une question")
    ResponseEntity<Void> retirerVoteQuestion(
            @PathVariable UUID questionId, @AuthenticationPrincipal UserDetails principal) {
        communaute.retirerVoteQuestion(questionId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reponses/{reponseId}/commentaires")
    @Operation(summary = "Commenter une réponse")
    ResponseEntity<Map<String, UUID>> commenter(
            @PathVariable UUID reponseId,
            @Valid @RequestBody CorpsCommunauteRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return cree(communaute.commenter(reponseId, eleve(principal), req.corps()));
    }

    @PutMapping("/reponses/{reponseId}")
    @Operation(summary = "Modifier sa réponse ou son commentaire")
    ResponseEntity<Void> modifierReponse(
            @PathVariable UUID reponseId,
            @Valid @RequestBody CorpsCommunauteRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        communaute.modifierReponse(reponseId, eleve(principal), req.corps());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/reponses/{reponseId}")
    @Operation(summary = "Supprimer sa réponse ou son commentaire")
    ResponseEntity<Void> supprimerReponse(
            @PathVariable UUID reponseId, @AuthenticationPrincipal UserDetails principal) {
        communaute.supprimerReponse(reponseId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reponses/{reponseId}/vote")
    @Operation(summary = "Voter « Utile » pour une réponse (pas un commentaire)")
    ResponseEntity<Void> voterReponse(
            @PathVariable UUID reponseId, @AuthenticationPrincipal UserDetails principal) {
        communaute.voterReponse(reponseId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/reponses/{reponseId}/vote")
    @Operation(summary = "Retirer son vote sur une réponse")
    ResponseEntity<Void> retirerVoteReponse(
            @PathVariable UUID reponseId, @AuthenticationPrincipal UserDetails principal) {
        communaute.retirerVoteReponse(reponseId, eleve(principal));
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity<Map<String, UUID>> cree(UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    private static UUID eleve(UserDetails principal) {
        boolean estEleve = principal.getAuthorities().stream()
                .anyMatch(a -> ROLE_ELEVE.equals(a.getAuthority()));
        if (!estEleve) {
            throw new AccesCommunauteRefuseException("La Communauté est réservée aux élèves.");
        }
        return UUID.fromString(principal.getUsername());
    }
}
