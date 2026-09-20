package fr.brio.progression.web;

import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.ParcoursChapitre;
import fr.brio.progression.api.ProgressionInfo;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/progression")
class ProgressionController {

    private final ProgressionService progression;

    ProgressionController(ProgressionService progression) {
        this.progression = progression;
    }

    /** XP and level of the authenticated student. */
    @GetMapping("/moi")
    ProgressionInfo moi(@AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return progression.pour(eleveId);
    }

    /**
     * Path state of a niveau/matière track for the authenticated student: each
     * chapter's state (fait / en cours / verrouillé) and completion percentage,
     * in order. The client joins it to the public catalogue by chapter id.
     */
    @GetMapping("/parcours/{niveau}/{matiere}")
    List<ParcoursChapitre> parcours(
            @PathVariable String niveau,
            @PathVariable String matiere,
            @AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return progression.parcours(niveau, matiere, eleveId);
    }
}
