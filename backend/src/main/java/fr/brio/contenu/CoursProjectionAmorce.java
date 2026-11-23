package fr.brio.contenu;

import fr.brio.contenu.domain.Cours;
import fr.brio.contenu.domain.CoursVersionId;
import fr.brio.contenu.infrastructure.CoursRepository;
import fr.brio.contenu.infrastructure.CoursVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Re-announces the structure of every published teacher course at startup (ADR 0050 §1), so
 * courses published before progression projected them — or whose event was lost — are caught up.
 * Harmless when nothing changed: progression's projection is idempotent and guarded by version,
 * and the event is structural (no student, no XP, no completion; ADR 0050 §4, S2).
 */
@Component
class CoursProjectionAmorce {

    private final CoursRepository coursRepository;
    private final CoursVersionRepository coursVersionRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    CoursProjectionAmorce(
            CoursRepository coursRepository,
            CoursVersionRepository coursVersionRepository,
            ObjectMapper objectMapper,
            ApplicationEventPublisher events) {
        this.coursRepository = coursRepository;
        this.coursVersionRepository = coursVersionRepository;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    // The transaction carries the events: progression listens after commit (#252).
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void amorcer() {
        for (Cours cours : coursRepository.findByStatut(Cours.STATUT_PUBLIE)) {
            if (cours.getVersionPubliee() == null) {
                continue;
            }
            int version = cours.getVersionPubliee();
            coursVersionRepository.findById(new CoursVersionId(cours.getId(), version)).ifPresent(v -> {
                try {
                    events.publishEvent(CoursStructure.de(cours.getId(), version, objectMapper.readTree(v.getContent())));
                } catch (Exception e) {
                    throw new IllegalStateException("Stored course version content is not valid JSON: " + cours.getId(), e);
                }
            });
        }
    }
}
