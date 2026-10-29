package fr.brio.identite.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Failed-login state for one identifiant (ADR 0017 §7). Written through native upserts in
 * {@link EchecConnexionRepository}; this mapping exists for schema validation and deletion.
 */
@Entity
@Table(schema = "identite", name = "echecs_connexion")
class EchecConnexion {

    @Id
    private String identifiant;

    @Column(name = "nb_echecs", nullable = false)
    private int nbEchecs;

    @Column(name = "verrou_jusqu_a")
    private Instant verrouJusquA;

    @Column(name = "derniere_tentative", nullable = false)
    private Instant derniereTentative;

    protected EchecConnexion() {}
}
