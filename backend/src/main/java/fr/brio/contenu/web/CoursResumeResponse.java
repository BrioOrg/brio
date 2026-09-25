package fr.brio.contenu.web;

import fr.brio.contenu.domain.Cours;
import java.time.Instant;
import java.util.UUID;

/** One row of a teacher's "Mes cours" listing — metadata only, no content. */
record CoursResumeResponse(
        UUID id,
        String titre,
        String niveauCode,
        String matiereCode,
        String statut,
        Integer versionPubliee,
        Instant updatedAt) {

    static CoursResumeResponse from(Cours c) {
        return new CoursResumeResponse(
                c.getId(), c.getTitre(), c.getNiveauCode(), c.getMatiereCode(),
                c.getStatut(), c.getVersionPubliee(), c.getUpdatedAt());
    }
}
