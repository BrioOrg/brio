package fr.brio.social.infrastructure;

import fr.brio.social.domain.SalonMessage;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalonMessageRepository extends JpaRepository<SalonMessage, UUID> {

    List<SalonMessage> findBySalonIdOrderByCreatedAtAsc(UUID salonId);

    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);

    /**
     * Rétention (ADR 0023 §6) : au-delà de la fenêtre, le message reste mais son auteur
     * devient le compte anonyme. Idempotent, renvoie le nombre de lignes anonymisées.
     */
    @Modifying
    @Query(
            """
            update SalonMessage m
               set m.auteurId = :anonyme
             where m.createdAt < :seuil and m.auteurId <> :anonyme
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);
}
