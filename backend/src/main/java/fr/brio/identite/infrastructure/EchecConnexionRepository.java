package fr.brio.identite.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Progressive-lockout state (ADR 0017 §7), keyed by normalised identifiant. The counters are
 * mutated with atomic Postgres upserts so concurrent login attempts cannot lose an increment.
 */
public interface EchecConnexionRepository extends JpaRepository<EchecConnexion, String> {

    @Query(value = "SELECT count(*) > 0 FROM identite.echecs_connexion "
            + "WHERE identifiant = :id AND verrou_jusqu_a > now()", nativeQuery = true)
    boolean estVerrouille(@Param("id") String id);

    /**
     * Records one failure for the identifiant, atomically. If a previous lock has already
     * expired, the counter restarts from 1 and the stale lock is cleared.
     */
    @Modifying
    @Query(value = """
            INSERT INTO identite.echecs_connexion (identifiant, nb_echecs, derniere_tentative)
            VALUES (:id, 1, now())
            ON CONFLICT (identifiant) DO UPDATE SET
                nb_echecs = CASE
                    WHEN echecs_connexion.verrou_jusqu_a IS NOT NULL
                         AND echecs_connexion.verrou_jusqu_a <= now()
                    THEN 1
                    ELSE echecs_connexion.nb_echecs + 1 END,
                verrou_jusqu_a = CASE
                    WHEN echecs_connexion.verrou_jusqu_a IS NOT NULL
                         AND echecs_connexion.verrou_jusqu_a <= now()
                    THEN NULL
                    ELSE echecs_connexion.verrou_jusqu_a END,
                derniere_tentative = now()
            """, nativeQuery = true)
    void enregistrerEchec(@Param("id") String id);

    /** Locks the identifiant for the given minutes once it has reached the failure threshold. */
    @Modifying
    @Query(value = """
            UPDATE identite.echecs_connexion
            SET verrou_jusqu_a = now() + CAST(:minutes AS integer) * INTERVAL '1 minute',
                nb_echecs = 0
            WHERE identifiant = :id AND nb_echecs >= :seuil
            """, nativeQuery = true)
    void appliquerVerrou(@Param("id") String id, @Param("minutes") int minutes, @Param("seuil") int seuil);

    /** Idempotent: a no-op when there is no failure row (the common case on a clean login). */
    @Modifying
    @Query(value = "DELETE FROM identite.echecs_connexion WHERE identifiant = :id", nativeQuery = true)
    void supprimer(@Param("id") String id);
}
