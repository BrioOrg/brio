package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.ClasseInfo;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.RoleCompte;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
class SessionController {

    private final CompteService compteService;
    private final ClasseService classeService;

    SessionController(CompteService compteService, ClasseService classeService) {
        this.compteService = compteService;
        this.classeService = classeService;
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

    /**
     * The caller's classes: a student's enrolments, or the classes a teacher runs. Lets the web
     * scope entraide threads to a class (ADR 0023) without a role-specific endpoint.
     */
    @GetMapping("/moi/classes")
    List<ClasseInfo> classesDuCompte(@AuthenticationPrincipal UserDetails principal) {
        UUID compteId = UUID.fromString(principal.getUsername());
        Compte compte = compteService.findById(compteId)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable"));
        return compte.getRole() == RoleCompte.enseignant
                ? classeService.classesDeLEnseignant(compteId)
                : classeService.classesDeLEleve(compteId);
    }
}
