package fr.brio.progression.infrastructure;

import fr.brio.social.api.ContenusAnonymises;
import java.util.List;
import java.util.UUID;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the social retention purge whole across modules (ADR 0023 §6): when {@code social}
 * anonymises answers that earned XP, the matching XP events stop pointing at them.
 */
@Component
class ContenusAnonymisesListener {

    private final XpAnonymisationRepository xp;

    ContenusAnonymisesListener(XpAnonymisationRepository xp) {
        this.xp = xp;
    }

    @ApplicationModuleListener
    void onContenusAnonymises(ContenusAnonymises evenement) {
        List<String> refs = evenement.contenuIds().stream().map(UUID::toString).toList();
        if (!refs.isEmpty()) {
            xp.couperReferences(XpAnonymisationRepository.SOURCE_ENTRAIDE, refs);
        }
        xp.couperReferencesAvant(XpAnonymisationRepository.SOURCE_ENTRAIDE, evenement.seuil());
    }
}
