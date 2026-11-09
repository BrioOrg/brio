package fr.brio.identite.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Per-IP login rate limiting (ADR 0017 §7): a fixed one-minute window counter, keyed by the
 * truncated client IP. Incremented atomically; the window resets once older than a minute.
 */
public interface DebitConnexionRepository extends JpaRepository<DebitConnexion, String> {

    @Modifying
    @Query(value = """
            INSERT INTO identite.debit_connexion (ip_tronquee, fenetre_debut, nb)
            VALUES (:ip, now(), 1)
            ON CONFLICT (ip_tronquee) DO UPDATE SET
                nb = CASE
                    WHEN debit_connexion.fenetre_debut <= now() - INTERVAL '1 minute'
                    THEN 1
                    ELSE debit_connexion.nb + 1 END,
                fenetre_debut = CASE
                    WHEN debit_connexion.fenetre_debut <= now() - INTERVAL '1 minute'
                    THEN now()
                    ELSE debit_connexion.fenetre_debut END
            """, nativeQuery = true)
    void enregistrerTentative(@Param("ip") String ip);

    @Query(value = "SELECT nb FROM identite.debit_connexion WHERE ip_tronquee = :ip", nativeQuery = true)
    Integer compteActuel(@Param("ip") String ip);
}
