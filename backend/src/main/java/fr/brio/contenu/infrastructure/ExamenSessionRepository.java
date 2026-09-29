package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.ExamenSession;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamenSessionRepository extends JpaRepository<ExamenSession, UUID> {

  /** Vrai si l'élève a une session non close et non expirée (garde tuteur). */
  boolean existsByEleveIdAndStatutAndEndsAtAfter(UUID eleveId, String statut, Instant now);

  /** La session ouverte la plus récente de l'élève (pour le bandeau/chrono). */
  Optional<ExamenSession> findFirstByEleveIdAndStatutAndEndsAtAfterOrderByStartedAtDesc(
      UUID eleveId, String statut, Instant now);

  /** Une session ouverte de l'élève sur cette annale précise (pour éviter les doublons). */
  Optional<ExamenSession> findFirstByEleveIdAndAnnaleChapitreIdAndStatutAndEndsAtAfter(
      UUID eleveId, String annaleChapitreId, String statut, Instant now);
}
