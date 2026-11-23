package fr.brio.progression.web;

import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.ContenuAReprendre;
import fr.brio.progression.api.MaitriseInfo;
import fr.brio.progression.api.ParcoursChapitre;
import fr.brio.progression.api.ProgressionCoursInfo;
import fr.brio.progression.api.ProgressionInfo;
import fr.brio.progression.api.SerieInfo;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
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
    private final ProgressionCoursService progressionCours;
    private final ReprendreAssembleur reprendre;

    ProgressionController(
            ProgressionService progression,
            ProgressionCoursService progressionCours,
            ReprendreAssembleur reprendre) {
        this.progression = progression;
        this.progressionCours = progressionCours;
        this.reprendre = reprendre;
    }

    /** XP and level of the authenticated student. */
    @GetMapping("/moi")
    ProgressionInfo moi(@AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return progression.pour(eleveId);
    }

    /**
     * Day streak of the authenticated student, decayed to today (a broken streak
     * reads 0). Feeds the top-bar flame (#81).
     */
    @GetMapping("/serie")
    SerieInfo serie(@AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return progression.serie(eleveId);
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

    /**
     * The content the authenticated student left unfinished, for the home page (#323): a chapter
     * or a teacher course they can still open (ADR 0050 §5), told apart by {@code type}.
     */
    @GetMapping("/reprendre")
    @ApiResponse(responseCode = "200", description = "Dernier chapitre ou cours en cours")
    @ApiResponse(responseCode = "204", description = "Rien à reprendre", content = @Content)
    ResponseEntity<ContenuAReprendre> reprendre(@AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return reprendre.reprendre(eleveId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * The authenticated student's gauge for a teacher course (ADR 0050 §5). 204 when the course is
     * not projected or the student has no row for it. Only ever reads the session's own rows.
     */
    @GetMapping("/cours/{coursId}")
    @ApiResponse(responseCode = "200", description = "Jauge du cours pour l'élève connecté")
    @ApiResponse(responseCode = "204", description = "Pas de jauge (cours inconnu ou jamais ouvert)", content = @Content)
    ResponseEntity<ProgressionCoursInfo> progressionCours(
            @PathVariable UUID coursId, @AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return progressionCours.jauge(eleveId, coursId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * Mastery per competence for the authenticated student. Only competences the student
     * has submitted to appear; niveau is null while the sample is too small (#96).
     */
    @GetMapping("/maitrise")
    List<MaitriseInfo> maitrise(@AuthenticationPrincipal UserDetails principal) {
        UUID eleveId = UUID.fromString(principal.getUsername());
        return progression.maitrise(eleveId);
    }
}
