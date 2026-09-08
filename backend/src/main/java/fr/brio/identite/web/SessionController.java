package fr.brio.identite.web;

import fr.brio.identite.CompteService;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api")
class SessionController {

    private final CompteService compteService;

    SessionController(CompteService compteService) {
        this.compteService = compteService;
    }

    @GetMapping("/moi")
    ResponseEntity<CompteInfo> moi(@AuthenticationPrincipal UserDetails principal) {
        UUID compteId = UUID.fromString(principal.getUsername());
        Compte compte = compteService.findById(compteId)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable"));

        return ResponseEntity.ok(new CompteInfo(
                compte.getId(),
                compte.getRole().name(),
                compte.getStatut().name(),
                compte.getNom(),
                compte.getEmail()));
    }
}
