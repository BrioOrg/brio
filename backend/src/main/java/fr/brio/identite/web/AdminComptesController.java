package fr.brio.identite.web;

import fr.brio.identite.CompteService;
import fr.brio.identite.api.PseudonymeInfo;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Account support actions, ADMIN_BRIO only (see SecurityConfig). */
@RestController
@RequestMapping("/api/admin/comptes")
class AdminComptesController {

    private final CompteService comptes;

    AdminComptesController(CompteService comptes) {
        this.comptes = comptes;
    }

    /** Replaces a student's pseudonym, on request (unfortunate pairing, harassment): #325. */
    @PostMapping("/{id}/pseudonyme")
    PseudonymeInfo regenererPseudonyme(@PathVariable UUID id) {
        return new PseudonymeInfo(comptes.regenererPseudonyme(id));
    }
}
