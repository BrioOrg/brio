package fr.brio.social.web;

import fr.brio.social.MessagerieService;
import fr.brio.social.SalonMessageVue;
import fr.brio.social.SalonVue;
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

/** Messagerie de classe côté membre (élève ou enseignant). ADR 0033. */
@RestController
@RequestMapping("/api/salons")
@Tag(name = "Messagerie", description = "Salons de classe")
class EleveMessagerieController {

    private final MessagerieService messagerie;

    EleveMessagerieController(MessagerieService messagerie) {
        this.messagerie = messagerie;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Lister les salons de mes classes")
    List<SalonVue> lister(@AuthenticationPrincipal UserDetails principal) {
        return messagerie.listerSalons(moi(principal));
    }

    @GetMapping(value = "/{salonId}/messages", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Lire les messages d'un salon")
    List<SalonMessageVue> messages(
            @PathVariable UUID salonId, @AuthenticationPrincipal UserDetails principal) {
        return messagerie.messagesDuSalon(salonId, moi(principal));
    }

    @PostMapping(value = "/{salonId}/messages",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Publier un message dans un salon")
    ResponseEntity<Map<String, UUID>> publier(
            @PathVariable UUID salonId,
            @Valid @RequestBody PublierRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        UUID id = messagerie.publier(salonId, moi(principal), req.corps());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @PostMapping(value = "/messages/{messageId}/signalement", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Signaler un message au modérateur de la classe")
    ResponseEntity<Void> signaler(
            @PathVariable UUID messageId,
            @RequestBody(required = false) SignalerRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        messagerie.signaler(messageId, moi(principal), req == null ? null : req.motif());
        return ResponseEntity.noContent().build();
    }

    private static UUID moi(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }
}
