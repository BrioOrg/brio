package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.ClasseDuCompte;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.RoleCompte;
import fr.brio.identite.infrastructure.CompteInfoAssembler;
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
    private final CompteInfoAssembler compteInfos;

    SessionController(CompteService compteService, ClasseService classeService,
                      CompteInfoAssembler compteInfos) {
        this.compteService = compteService;
        this.classeService = classeService;
        this.compteInfos = compteInfos;
    }

    @GetMapping("/moi")
    ResponseEntity<CompteInfo> moi(@AuthenticationPrincipal UserDetails principal) {
        UUID compteId = UUID.fromString(principal.getUsername());
        Compte compte = compteService.findById(compteId)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable"));

        return ResponseEntity.ok(compteInfos.pour(compte));
    }

    /**
     * The caller's classes: a student's enrolments, or the classes a teacher runs. Lets the web
     * scope entraide threads to a class (ADR 0023) without a role-specific endpoint.
     */
    @GetMapping("/moi/classes")
    List<ClasseDuCompte> classesDuCompte(@AuthenticationPrincipal UserDetails principal) {
        UUID compteId = UUID.fromString(principal.getUsername());
        Compte compte = compteService.findById(compteId)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable"));
        return classeService.classesDuCompte(compteId, compte.getRole() == RoleCompte.enseignant);
    }
}
