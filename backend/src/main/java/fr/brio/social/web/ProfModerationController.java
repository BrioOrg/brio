package fr.brio.social.web;

import fr.brio.social.EntraideService;
import fr.brio.social.SignalementVue;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Modération de l'entraide par l'enseignant de la classe. Gated ENSEIGNANT par
 * {@code /api/prof/**} dans SecurityConfig ; l'appartenance fine à la classe est
 * revérifiée dans le service (ADR 0023).
 */
@RestController
@RequestMapping("/api/prof/entraide")
@Tag(name = "Entraide — modération", description = "File de signalements et actions du prof modérateur")
class ProfModerationController {

    private final EntraideService entraide;

    ProfModerationController(EntraideService entraide) {
        this.entraide = entraide;
    }

    @GetMapping(value = "/signalements", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "File des signalements en attente pour les classes modérées")
    List<SignalementVue> signalements(@AuthenticationPrincipal UserDetails principal) {
        return entraide.fileSignalements(moi(principal));
    }

    @PostMapping("/messages/{messageId}/masquer")
    @Operation(summary = "Masquer un message et clore ses signalements")
    ResponseEntity<Void> masquer(
            @PathVariable UUID messageId, @AuthenticationPrincipal UserDetails principal) {
        entraide.masquerMessage(moi(principal), messageId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/sanctions",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Appliquer une sanction à un élève de la classe")
    ResponseEntity<Map<String, UUID>> sanctionner(
            @Valid @RequestBody SanctionnerRequest req, @AuthenticationPrincipal UserDetails principal) {
        UUID id = entraide.sanctionner(
                moi(principal), req.compteId(), req.classeId(), req.type(), req.motif(), req.fin());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    private static UUID moi(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }
}
