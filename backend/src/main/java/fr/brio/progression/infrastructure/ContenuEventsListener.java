package fr.brio.progression.infrastructure;

import fr.brio.contenu.api.ChapitrePublie;
import fr.brio.contenu.api.CoursPublie;
import fr.brio.contenu.api.SectionCoursLue;
import fr.brio.contenu.api.SectionTerminee;
import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionService;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Feeds progression from contenu's events (ADR 0022). {@code ChapitrePublie} keeps
 * the local chapter projection current; {@code SectionTerminee} records reads and
 * advances completion. Both run after the publishing transaction commits and are
 * persisted in {@code event_publication}, so they survive a crash and can be
 * replayed — while keeping progression decoupled from contenu. {@code CoursPublie} and
 * {@code SectionCoursLue} do the same for teacher courses (ADR 0050).
 */
@Component
class ContenuEventsListener {

    private final ProgressionService progression;
    private final ProgressionCoursService progressionCours;

    ContenuEventsListener(ProgressionService progression, ProgressionCoursService progressionCours) {
        this.progression = progression;
        this.progressionCours = progressionCours;
    }

    @ApplicationModuleListener
    void onChapitrePublie(ChapitrePublie evenement) {
        progression.enregistrerChapitre(evenement);
    }

    @ApplicationModuleListener
    void onSectionTerminee(SectionTerminee evenement) {
        progression.onSectionTerminee(evenement);
    }

    @ApplicationModuleListener
    void onCoursPublie(CoursPublie evenement) {
        progressionCours.enregistrerCours(evenement);
    }

    @ApplicationModuleListener
    void onSectionCoursLue(SectionCoursLue evenement) {
        progressionCours.onSectionCoursLue(evenement);
    }
}
