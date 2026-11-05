package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Solde;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SoldeRepository extends JpaRepository<Solde, UUID> {

    /** Creates the balance row if missing, atomically — same first-activity race as the streak (#344). */
    @Modifying
    @Query(value = "INSERT INTO progression.soldes (eleve_id) VALUES (:eleveId) "
            + "ON CONFLICT (eleve_id) DO NOTHING", nativeQuery = true)
    void creerSiAbsent(@Param("eleveId") UUID eleveId);

    /**
     * Locks the student's balance row (the row must already exist — call {@link #creerSiAbsent}
     * first). Concurrent recomputes for one student then serialize, so each sums the XP events
     * only after the other has committed and the materialised total never drops an award (#344).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Solde s WHERE s.eleveId = :eleveId")
    Optional<Solde> verrouiller(@Param("eleveId") UUID eleveId);
}
