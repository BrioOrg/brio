package fr.brio.social.web;

import fr.brio.social.ContestationModerationVue;
import fr.brio.social.MessageInvalideException;
import fr.brio.social.ModerationCommunauteService;
import fr.brio.social.SignalementCommunauteVue;
import fr.brio.social.domain.CibleCommunaute;
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
 * Console de modération de la Communauté, réservée à {@code admin_brio} (gated
 * {@code /api/admin/communaute/**} dans SecurityConfig, suivi #338). Contrairement aux routes
 * membres, elle n'est pas conditionnée par {@code brio.communaute.active} : traiter des
 * signalements reste possible même réglage coupé, et le rôle admin est déjà un secret bien gardé.
 */
@RestController
@RequestMapping(value = "/api/admin/communaute", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Communauté — modération", description = "File de signalements, décisions, contestations, révocation d'XP")
class AdminModerationController {

    private final ModerationCommunauteService moderation;

    AdminModerationController(ModerationCommunauteService moderation) {
        this.moderation = moderation;
    }

    @GetMapping("/signalements")
    @Operation(summary = "File des contenus signalés, agrégés par cible")
    List<SignalementCommunauteVue> signalements() {
        return moderation.fileSignalements();
    }

    @PostMapping(value = "/{cibleType}/{cibleId}/decision", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Décider sur un contenu : masquer, supprimer, rejeter, restaurer, révoquer l'XP")
    ResponseEntity<Map<String, UUID>> decider(
            @PathVariable String cibleType,
            @PathVariable UUID cibleId,
            @Valid @RequestBody DeciderRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        UUID id = moderation.decider(cible(cibleType), cibleId, moi(principal), req.action(), req.motif());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @GetMapping("/contestations")
    @Operation(summary = "File des contestations à trancher")
    List<ContestationModerationVue> contestations() {
        return moderation.fileContestations();
    }

    @PostMapping(value = "/contestations/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Trancher une contestation (accepter = restaurer le contenu)")
    ResponseEntity<Void> trancher(
            @PathVariable UUID id,
            @Valid @RequestBody TrancherContestationRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        moderation.trancherContestation(id, moi(principal), req.accepter(), req.reponse());
        return ResponseEntity.noContent().build();
    }

    private static CibleCommunaute cible(String cibleType) {
        try {
            return CibleCommunaute.depuisCode(cibleType);
        } catch (IllegalArgumentException inconnu) {
            throw new MessageInvalideException("Type de contenu inconnu : " + cibleType);
        }
    }

    private static UUID moi(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }
}
