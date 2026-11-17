package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Compte;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface CompteRepository extends JpaRepository<Compte, UUID> {
    Optional<Compte> findByIdentifiantConnexion(String identifiantConnexion);

    /** Adult accounts only carry an e-mail; unique case-insensitively (V34). */
    Optional<Compte> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPseudonyme(String pseudonyme);

    /**
     * Loads the compte holding its row lock until the transaction ends ({@code SELECT … FOR
     * UPDATE}): serialises the access resets of one adult and of one student, so their rate limits
     * are counted against a stable trail (ADR 0036 §6), and a password change against a reset.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Compte c WHERE c.id = :id")
    Optional<Compte> verrouiller(@Param("id") UUID id);

    /**
     * Marks the provisional password used, in ONE conditional statement (ADR 0036 §3): 1 when this
     * call consumed it, 0 when it was already used (or expired, or no change is pending, or it is
     * no longer the reset {@code reinitialiseLe} the login checked its password against). Two
     * logins racing with the same provisional password cannot both get 1: Postgres re-evaluates the
     * {@code utilise_le IS NULL} condition after the first commit. A login checked against the
     * account as it was BEFORE a reset (old password, or an older provisional one) carries an
     * older {@code reinitialiseLe} (null if never reset), so it can never consume the provisional
     * password issued since. Clears the persistence context, so the compte is re-read afterwards.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            UPDATE Compte c SET c.motDePasseProvisoireUtiliseLe = :maintenant
            WHERE c.id = :id AND c.doitChangerMotDePasse = true
              AND c.motDePasseProvisoireUtiliseLe IS NULL
              AND c.motDePasseProvisoireExpireLe > :maintenant
              AND c.accesReinitialiseLe = :reinitialiseLe""")
    int consommerMotDePasseProvisoire(@Param("id") UUID id,
                                      @Param("reinitialiseLe") Instant reinitialiseLe,
                                      @Param("maintenant") Instant maintenant);
}
