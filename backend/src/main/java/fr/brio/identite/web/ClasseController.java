package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/classes")
class ClasseController {

    private final ClasseService classeService;

    ClasseController(ClasseService classeService) {
        this.classeService = classeService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ClasseInfo creer(@Valid @RequestBody CreerClasseRequest req) {
        return classeService.creerClasse(
                req.etablissementId(), req.niveauCode(), req.libelle(), req.anneeScolaire(),
                req.enseignantPrincipalId());
    }

    @PutMapping("/{id}/enseignant-principal")
    ClasseInfo assignerEnseignant(@PathVariable UUID id,
                                  @Valid @RequestBody AssignerEnseignantRequest req) {
        return classeService.assignerEnseignantPrincipal(id, req.enseignantId());
    }

    @PostMapping("/{id}/codes")
    @ResponseStatus(HttpStatus.CREATED)
    CodeClasseCreee genererCode(@PathVariable UUID id,
                                 @Valid @RequestBody GenererCodeRequest req,
                                 Authentication auth) {
        UUID adminId = UUID.fromString(auth.getName());
        int ttl  = req.expireDansJours() != null ? req.expireDansJours() : 14;
        int usages = req.usagesMax() != null ? req.usagesMax() : 40;
        return classeService.genererCode(id, adminId, ttl, usages);
    }

    @GetMapping("/{id}/codes/actif")
    CodeClasseInfo getCodeInfo(@PathVariable UUID id, Authentication auth) {
        UUID demandePar = UUID.fromString(auth.getName());
        boolean isAdmin = hasRole(auth, "ROLE_ADMIN_BRIO");
        return classeService.getCodeInfo(id, demandePar, isAdmin);
    }

    @DeleteMapping("/{id}/codes/actif")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoquerCode(@PathVariable UUID id, Authentication auth) {
        UUID demandePar = UUID.fromString(auth.getName());
        boolean isAdmin = hasRole(auth, "ROLE_ADMIN_BRIO");
        classeService.revoquerCode(id, demandePar, isAdmin);
    }

    @PostMapping("/rejoindre")
    @ResponseStatus(HttpStatus.CREATED)
    EleveInscritInfo rejoindre(@Valid @RequestBody RejoindreClasseRequest req) {
        return classeService.rejoindreParCode(req.code(), req.motDePasse(), req.nomAffiche());
    }

    @GetMapping("/{id}/inscriptions")
    List<InscriptionInfo> listerInscrits(@PathVariable UUID id, Authentication auth) {
        UUID demandePar = UUID.fromString(auth.getName());
        boolean isAdmin = hasRole(auth, "ROLE_ADMIN_BRIO");
        return classeService.listerInscrits(id, demandePar, isAdmin);
    }

    @PatchMapping("/{id}/inscriptions/{compteId}")
    InscriptionInfo renommerEleve(@PathVariable UUID id,
                                   @PathVariable UUID compteId,
                                   @Valid @RequestBody RenommerInscriptionRequest req,
                                   Authentication auth) {
        UUID demandePar = UUID.fromString(auth.getName());
        boolean isAdmin = hasRole(auth, "ROLE_ADMIN_BRIO");
        return classeService.renommerEleve(id, compteId, req.nomAffiche(), demandePar, isAdmin);
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(role));
    }
}
