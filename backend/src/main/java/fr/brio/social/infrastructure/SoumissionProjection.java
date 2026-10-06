package fr.brio.social.infrastructure;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.social.domain.SoumissionVue;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Tient la projection « cet élève a soumis cet exercice » en écoutant les soumissions
 * d'{@code exercices} (ADR 0023). Sert la garde anti-triche des fils d'exercice.
 *
 * <p>Idempotent : Spring Modulith rejoue les événements après un crash, et un élève
 * peut soumettre plusieurs fois le même exercice — on n'insère qu'une fois par
 * {@code (élève, exercice)}.
 */
@Component
class SoumissionProjection {

    private final SoumissionVueRepository soumissionsVues;

    SoumissionProjection(SoumissionVueRepository soumissionsVues) {
        this.soumissionsVues = soumissionsVues;
    }

    @ApplicationModuleListener
    void onSoumissionEnregistree(SoumissionEnregistree evenement) {
        if (soumissionsVues.existsByEleveIdAndExerciceId(evenement.eleveId(), evenement.exerciceId())) {
            return;
        }
        soumissionsVues.save(new SoumissionVue(evenement.eleveId(), evenement.exerciceId()));
    }
}
