package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.ReinitialisationAccesService;
import fr.brio.identite.api.ChangerMotDePasseRequest;
import fr.brio.identite.api.ClasseDuCompte;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.RoleCompte;
import fr.brio.identite.infrastructure.CompteInfoAssembler;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
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
    private final ReinitialisationAccesService reinitialisations;

    SessionController(CompteService compteService, ClasseService classeService,
                      CompteInfoAssembler compteInfos, ReinitialisationAccesService reinitialisations) {
        this.compteService = compteService;
        this.classeService = classeService;
        this.compteInfos = compteInfos;
        this.reinitialisations = reinitialisations;
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

    /**
     * The student's own password, after a teacher-led reset (ADR 0036 §5). 409 when no change is
     * pending, 422 when it is the provisional password. Closes the account's other sessions.
     */
    @PostMapping("/moi/mot-de-passe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changerMotDePasse(@AuthenticationPrincipal UserDetails principal,
                           @Valid @RequestBody ChangerMotDePasseRequest req,
                           HttpSession session) {
        // This session stays signed in; every other one of the account is closed.
        reinitialisations.changerMotDePasse(UUID.fromString(principal.getUsername()),
                req.nouveauMotDePasse(), session.getId());
    }
}
