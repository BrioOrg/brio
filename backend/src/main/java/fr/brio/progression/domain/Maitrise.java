package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Materialized mastery of one competence for one student (ADR 0022 §1, §6). A pure
 * derivation of {@link SoumissionCompetence}: {@link #niveau} is rebuilt from the last
 * {@link NiveauMaitrise#FENETRE} first attempts and is {@code null} while the sample is
 * below {@link NiveauMaitrise#SEUIL_ECHANTILLON}. Keyed by (eleve, competence) so the
 * recompute is an upsert per competence, never a duplicate row.
 */
@Entity
@Table(name = "maitrise", schema = "progression")
public class Maitrise {

    @EmbeddedId
    private MaitriseId id;

    // Nullable on purpose: no honest level yet under the sample threshold (ADR 0022 §6).
    @Column
    private Short niveau;

    @Column(nullable = false)
    private int echantillon;

    @Column(name = "maj_at", nullable = false)
    private Instant majAt;

    protected Maitrise() {}

    public Maitrise(UUID eleveId, String competenceCode, Short niveau, int echantillon, Instant majAt) {
        this.id = new MaitriseId(eleveId, competenceCode);
        this.niveau = niveau;
        this.echantillon = echantillon;
        this.majAt = majAt;
    }

    public UUID getEleveId() { return id.eleveId(); }
    public String getCompetenceCode() { return id.competenceCode(); }
    public Short getNiveau() { return niveau; }
    public int getEchantillon() { return echantillon; }

    @Embeddable
    public record MaitriseId(
            @Column(name = "eleve_id", nullable = false) UUID eleveId,
            @Column(name = "competence_code", nullable = false) String competenceCode)
            implements Serializable {

        public MaitriseId {
            Objects.requireNonNull(eleveId);
            Objects.requireNonNull(competenceCode);
        }
    }
}
