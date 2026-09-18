package fr.brio.progression.web;

import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.ProgressionInfo;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
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
}
