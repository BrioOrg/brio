package fr.brio.social.infrastructure;

import fr.brio.social.domain.Message;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByFilIdOrderByCreatedAtAsc(UUID filId);

    long countByFilIdAndStatut(UUID filId, String statut);

    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);

    /**
     * Rétention (ADR 0023 §6) : au-delà de la fenêtre, le contenu reste mais le lien vers
     * l'auteur (donnée d'identification, LCEN) est coupé — l'auteur et l'éventuel « marqué
     * utile par » deviennent le compte anonyme. Idempotent : les lignes déjà anonymisées
     * (auteur = compte anonyme) sont ignorées. Renvoie le nombre de lignes anonymisées.
     */
    @Modifying
    @Query(
            """
            update Message m
               set m.auteurId = :anonyme,
                   m.marqueUtilePar = case when m.marqueUtilePar is not null then :anonyme else null end
             where m.createdAt < :seuil and m.auteurId <> :anonyme
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);
}
