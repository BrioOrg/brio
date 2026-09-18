package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Materialised current balance for fast reads. It is a projection of
 * {@link EvenementXp} and can be recomputed from it at any time (ADR 0022).
 */
@Entity
@Table(name = "soldes", schema = "progression")
public class Solde {

    @Id
    @Column(name = "eleve_id")
    private UUID eleveId;

    @Column(name = "xp_total", nullable = false)
    private int xpTotal;

    @Column(nullable = false)
    private short niveau;

    @Column(name = "calcule_at", nullable = false)
    private Instant calculeAt;

    protected Solde() {}

    public Solde(UUID eleveId, int xpTotal, short niveau, Instant calculeAt) {
        this.eleveId = eleveId;
        this.xpTotal = xpTotal;
        this.niveau = niveau;
        this.calculeAt = calculeAt;
    }

    public UUID getEleveId() { return eleveId; }
    public int getXpTotal() { return xpTotal; }
    public short getNiveau() { return niveau; }
    public Instant getCalculeAt() { return calculeAt; }
}
