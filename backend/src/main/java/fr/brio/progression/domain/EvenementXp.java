package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One XP award. The unique constraint (eleve_id, source_type, source_ref, motif)
 * — declared in V19 — makes attribution idempotent (ADR 0022 §2).
 */
@Entity
@Table(name = "evenements_xp", schema = "progression")
public class EvenementXp {

    @Id
    private UUID id;

    @Column(name = "eleve_id", nullable = false)
    private UUID eleveId;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "source_ref", nullable = false)
    private String sourceRef;

    @Column(nullable = false)
    private String motif;

    @Column(nullable = false)
    private short points;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected EvenementXp() {}

    public EvenementXp(UUID eleveId, String sourceType, String sourceRef, String motif,
                       short points, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.eleveId = eleveId;
        this.sourceType = sourceType;
        this.sourceRef = sourceRef;
        this.motif = motif;
        this.points = points;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getEleveId() { return eleveId; }
    public String getSourceType() { return sourceType; }
    public String getSourceRef() { return sourceRef; }
    public String getMotif() { return motif; }
    public short getPoints() { return points; }
    public Instant getCreatedAt() { return createdAt; }
}
