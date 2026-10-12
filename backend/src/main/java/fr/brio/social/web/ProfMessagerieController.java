package fr.brio.social.web;

import fr.brio.social.MessagerieService;
import fr.brio.social.NouveauSalon;
import fr.brio.social.SalonSignalementVue;
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
 * Messagerie de classe côté enseignant : créer un salon, modérer. Gated ENSEIGNANT par
 * {@code /api/prof/**} dans SecurityConfig ; l'appartenance à la classe est revérifiée
 * dans le service (ADR 0033).
 */
@RestController
@RequestMapping("/api/prof/salons")
@Tag(name = "Messagerie — enseignant", description = "Créer un salon, modérer")
class ProfMessagerieController {

    private final MessagerieService messagerie;

    ProfMessagerieController(MessagerieService messagerie) {
        this.messagerie = messagerie;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Créer un salon pour une de ses classes")
    ResponseEntity<Map<String, UUID>> creer(
            @Valid @RequestBody CreerSalonRequest req, @AuthenticationPrincipal UserDetails principal) {
        UUID id = messagerie.creerSalon(moi(principal), new NouveauSalon(req.classeId(), req.titre()));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @GetMapping(value = "/signalements", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "File des signalements en attente pour les classes modérées")
    List<SalonSignalementVue> signalements(@AuthenticationPrincipal UserDetails principal) {
        return messagerie.fileSignalements(moi(principal));
    }

    @PostMapping("/messages/{messageId}/masquer")
    @Operation(summary = "Masquer un message et clore ses signalements")
    ResponseEntity<Void> masquer(
            @PathVariable UUID messageId, @AuthenticationPrincipal UserDetails principal) {
        messagerie.masquer(moi(principal), messageId);
        return ResponseEntity.noContent().build();
    }

    private static UUID moi(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }
}
