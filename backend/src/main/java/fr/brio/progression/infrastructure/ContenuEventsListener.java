package fr.brio.progression.infrastructure;

import fr.brio.contenu.api.ChapitrePublie;
import fr.brio.contenu.api.SectionTerminee;
import fr.brio.progression.ProgressionService;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Feeds progression from contenu's events (ADR 0022). {@code ChapitrePublie} keeps
 * the local chapter projection current; {@code SectionTerminee} records reads and
 * advances completion. Both run after the publishing transaction commits and are
 * persisted in {@code event_publication}, so they survive a crash and can be
 * replayed — while keeping progression decoupled from contenu.
 */
@Component
class ContenuEventsListener {

    private final ProgressionService progression;

    ContenuEventsListener(ProgressionService progression) {
        this.progression = progression;
    }

    @ApplicationModuleListener
    void onChapitrePublie(ChapitrePublie evenement) {
        progression.enregistrerChapitre(evenement);
    }

    @ApplicationModuleListener
    void onSectionTerminee(SectionTerminee evenement) {
        progression.onSectionTerminee(evenement);
    }
}
