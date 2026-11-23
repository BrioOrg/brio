package fr.brio.progression.web;

import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionCoursService.CoursEnCours;
import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.ChapitreAReprendre;
import fr.brio.progression.api.ContenuAReprendre;
import fr.brio.progression.api.CoursAReprendre;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Composes « Reprendre » from chapters and teacher courses (ADR 0050 §5). The <b>only</b> place
 * progression reads another module synchronously (ADR 0050 §2, amending ADR 0022 §3): one
 * read-only call to {@link CoursAccesApi#titresVisiblesPourEleve} drops a course the student can no
 * longer open — unpublished, out of scope, or the student left the class — by the very rule of the
 * course page, and gives its published title. Writes never go through here.
 */
@Component
class ReprendreAssembleur {

    private final ProgressionService progression;
    private final ProgressionCoursService progressionCours;
    private final CoursAccesApi coursAcces;

    ReprendreAssembleur(
            ProgressionService progression, ProgressionCoursService progressionCours, CoursAccesApi coursAcces) {
        this.progression = progression;
        this.progressionCours = progressionCours;
        this.coursAcces = coursAcces;
    }

    /** The most recently read unfinished content, chapter or course; a tie goes to the chapter. */
    Optional<ContenuAReprendre> reprendre(UUID eleveId) {
        Optional<ChapitreAReprendre> chapitre = progression.reprendre(eleveId);
        Optional<CoursAReprendre> cours = premierCoursVisible(eleveId);
        if (cours.isEmpty()) {
            return chapitre.map(c -> c);
        }
        if (chapitre.isEmpty() || cours.get().derniereActivite().isAfter(chapitre.get().derniereActivite())) {
            return cours.map(c -> c);
        }
        return chapitre.map(c -> c);
    }

    private Optional<CoursAReprendre> premierCoursVisible(UUID eleveId) {
        List<CoursEnCours> candidats = progressionCours.coursEnCours(eleveId);
        if (candidats.isEmpty()) {
            return Optional.empty();
        }
        Set<UUID> ids = new LinkedHashSet<>();
        candidats.forEach(c -> ids.add(c.coursId()));
        Map<UUID, String> titres = coursAcces.titresVisiblesPourEleve(eleveId, ids);
        return candidats.stream()
                .filter(c -> titres.containsKey(c.coursId()))
                .findFirst()
                .map(c -> new CoursAReprendre(c.coursId(), titres.get(c.coursId()),
                        Math.min(c.sectionsLues(), c.sectionsTotal()), c.sectionsTotal(), c.derniereLecture()));
    }
}
