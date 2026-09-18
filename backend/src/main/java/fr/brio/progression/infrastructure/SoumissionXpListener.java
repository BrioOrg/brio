package fr.brio.progression.infrastructure;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.ProgressionService;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Turns exercise submissions into XP. `@ApplicationModuleListener` runs after the
 * publishing transaction commits and is persisted in `event_publication`, so the
 * award survives a crash and can be replayed — while keeping `progression`
 * fully decoupled from `exercices`.
 */
@Component
class SoumissionXpListener {

    private final ProgressionService progression;

    SoumissionXpListener(ProgressionService progression) {
        this.progression = progression;
    }

    @ApplicationModuleListener
    void onSoumissionEnregistree(SoumissionEnregistree evenement) {
        progression.attribuerPourSoumission(evenement);
    }
}
