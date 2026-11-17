package fr.brio.identite.web;

import fr.brio.identite.CompteService;
import fr.brio.identite.ReinitialisationAccesService;
import fr.brio.identite.api.PseudonymeInfo;
import fr.brio.identite.api.ReinitialisationAccesInfo;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Account support actions, ADMIN_BRIO only (see SecurityConfig). */
@RestController
@RequestMapping("/api/admin/comptes")
class AdminComptesController {

    private final CompteService comptes;
    private final ReinitialisationAccesService reinitialisations;

    AdminComptesController(CompteService comptes, ReinitialisationAccesService reinitialisations) {
        this.comptes = comptes;
        this.reinitialisations = reinitialisations;
    }

    /** Replaces a student's pseudonym, on request (unfortunate pairing, harassment): #325. */
    @PostMapping("/{id}/pseudonyme")
    PseudonymeInfo regenererPseudonyme(@PathVariable UUID id) {
        return new PseudonymeInfo(comptes.regenererPseudonyme(id));
    }

    /**
     * Resets the access of any active student account, whether or not it is in a class (ADR 0036
     * §1bis). Meant for the students no teacher can reach — signed up via /commencer, or whose
     * class was archived — but not restricted to them: the brio team may reset any student.
     * Only a student account can be the target (404 otherwise, an adult included; 409 when it is
     * not active). Never cached: the provisional password is in the body.
     */
    @PostMapping("/{id}/reinitialisation-acces")
    ResponseEntity<ReinitialisationAccesInfo> reinitialiserAccesHorsClasse(@PathVariable UUID id, Authentication auth) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(reinitialisations.reinitialiserHorsClasse(id, UUID.fromString(auth.getName())));
    }
}
