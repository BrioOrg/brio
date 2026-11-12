package fr.brio.progression.infrastructure;

import fr.brio.progression.ProgressionService;
import fr.brio.social.api.ReponseUtileRevoquee;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Retire l'XP « réponse utile » quand {@code social} révoque une réponse jugée non conforme
 * (suivi #338, ADR 0035). Miroir de {@link EntraideXpListener}.
 */
@Component
class EntraideXpRevocationListener {

    private final ProgressionService progression;

    EntraideXpRevocationListener(ProgressionService progression) {
        this.progression = progression;
    }

    @ApplicationModuleListener
    void onReponseUtileRevoquee(ReponseUtileRevoquee evenement) {
        progression.onReponseUtileRevoquee(evenement);
    }
}
