package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.EvenementXp;
import java.time.Instant;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Cuts the reference from an entraide XP event to the social content that earned it, once that
 * content is anonymised by the social retention purge (ADR 0023 §6).
 *
 * <p>The XP row stays (the student's balance does not move) but its {@code source_ref} — the id
 * of the answer, which next to {@code eleve_id} would give the anonymised author back — becomes
 * {@code anonymise:<id of the XP row>}: opaque, and unique per row so the {@code
 * uq_evenements_xp_source} constraint still holds. Idempotent: a reference already cut no longer
 * matches any content id.
 */
interface XpAnonymisationRepository extends Repository<EvenementXp, UUID> {

    /** Source type of entraide XP — mirrors {@code ProgressionService.SOURCE_ENTRAIDE}. */
    String SOURCE_ENTRAIDE = "entraide";

    @Modifying
    @Query(
            value =
                    """
                    update progression.evenements_xp
                       set source_ref = 'anonymise:' || id::text
                     where source_type = :sourceType and source_ref in (:refs)
                    """,
            nativeQuery = true)
    int couperReferences(
            @Param("sourceType") String sourceType, @Param("refs") Collection<String> refs);

    /**
     * Backstop: cuts every entraide reference on an XP event itself older than the threshold. The
     * content it points at is older still, hence already anonymised — always safe, and it covers a
     * {@code ContenusAnonymises} delivery that failed.
     */
    @Modifying
    @Query(
            value =
                    """
                    update progression.evenements_xp
                       set source_ref = 'anonymise:' || id::text
                     where source_type = :sourceType and created_at < :seuil
                       and source_ref not like 'anonymise:%'
                    """,
            nativeQuery = true)
    int couperReferencesAvant(@Param("sourceType") String sourceType, @Param("seuil") Instant seuil);
}
