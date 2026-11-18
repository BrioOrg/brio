package fr.brio.identite.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Audit row of a teacher-led access reset (ADR 0036 §7): who reset whose access, through which
 * class, and until when the provisional password was valid. Never the password nor its hash.
 * Also the counter behind the reset rate limit (§6).
 */
@Entity
@Table(schema = "identite", name = "reinitialisations_acces")
public class ReinitialisationAcces {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "compte_id", nullable = false, updatable = false)
    private UUID compteId;

    @Column(name = "par_compte_id", nullable = false, updatable = false)
    private UUID parCompteId;

    @Column(name = "classe_id", updatable = false)
    private UUID classeId;

    @Column(name = "cree_le", nullable = false, updatable = false)
    private Instant creeLe;

    @Column(name = "expire_le", nullable = false, updatable = false)
    private Instant expireLe;

    protected ReinitialisationAcces() {}

    public static ReinitialisationAcces tracer(UUID compteId, UUID parCompteId, UUID classeId,
                                               Instant creeLe, Instant expireLe) {
        var r = new ReinitialisationAcces();
        r.compteId = compteId;
        r.parCompteId = parCompteId;
        r.classeId = classeId;
        r.creeLe = creeLe;
        r.expireLe = expireLe;
        return r;
    }

    public UUID getId() { return id; }
    public UUID getCompteId() { return compteId; }
    public UUID getParCompteId() { return parCompteId; }
    public UUID getClasseId() { return classeId; }
    public Instant getCreeLe() { return creeLe; }
    public Instant getExpireLe() { return expireLe; }
}
