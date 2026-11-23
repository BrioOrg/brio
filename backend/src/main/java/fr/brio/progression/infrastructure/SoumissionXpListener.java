package fr.brio.progression.infrastructure;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionService;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Turns exercise submissions into XP. `@ApplicationModuleListener` runs after the
 * publishing transaction commits and is persisted in `event_publication`, so the
 * award survives a crash and can be replayed — while keeping `progression`
 * fully decoupled from `exercices`. A teacher-course solve is then recorded by its stable key,
 * in the same transaction, before the streak (ADR 0050).
 */
@Component
class SoumissionXpListener {

    private final ProgressionService progression;
    private final ProgressionCoursService progressionCours;

    SoumissionXpListener(ProgressionService progression, ProgressionCoursService progressionCours) {
        this.progression = progression;
        this.progressionCours = progressionCours;
    }

    @ApplicationModuleListener
    void onSoumissionEnregistree(SoumissionEnregistree evenement) {
        // Course follow-up lock first, then streak and mastery (lock order, ADR 0050 §4).
        progressionCours.onSoumission(evenement);
        progression.attribuerPourSoumission(evenement);
    }
}
