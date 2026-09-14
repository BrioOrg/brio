package fr.brio.identite.web;

import fr.brio.identite.ConsentementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api")
class ConsentementController {

    private final ConsentementService consentementService;

    ConsentementController(ConsentementService consentementService) {
        this.consentementService = consentementService;
    }

    /** Parent confirms consent via the bearer token from their email. */
    @PostMapping("/consentements/{token}/validation")
    ResponseEntity<Void> validerConsentement(@PathVariable String token) {
        consentementService.validerConsentement(token);
        return ResponseEntity.ok().build();
    }

    /** Parent revokes consent via the long-lived revocation token from the confirmation email. */
    @PostMapping("/consentements/revocation/{token}")
    ResponseEntity<Void> revoquerConsentementParent(@PathVariable String token) {
        consentementService.revoquerConsentementParent(token);
        return ResponseEntity.ok().build();
    }

    /**
     * Admin revokes consent for a specific compte.
     * Requires ROLE_ADMIN_BRIO or ROLE_ADMIN_ETAB (enforced in SecurityConfig).
     */
    @DeleteMapping("/comptes/{id}/consentement")
    ResponseEntity<Void> revoquerConsentementAdmin(@PathVariable UUID id) {
        consentementService.revoquerConsentementAdmin(id);
        return ResponseEntity.ok().build();
    }
}
