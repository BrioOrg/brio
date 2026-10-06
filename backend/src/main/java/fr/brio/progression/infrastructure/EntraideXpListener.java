package fr.brio.progression.infrastructure;

import fr.brio.progression.ProgressionService;
import fr.brio.social.api.ReponseUtileValidee;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Traduit une réponse d'entraide marquée utile ({@code social}) en attribution d'XP
 * (ADR 0022, ADR 0023). Même pattern que {@link SoumissionXpListener}.
 */
@Component
class EntraideXpListener {

    private final ProgressionService progression;

    EntraideXpListener(ProgressionService progression) {
        this.progression = progression;
    }

    @ApplicationModuleListener
    void onReponseUtileValidee(ReponseUtileValidee evenement) {
        progression.onReponseUtileValidee(evenement);
    }
}
