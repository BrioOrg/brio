package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Sanction appliquée à un compte par le modérateur de sa classe (ADR 0023).
 * {@code lecture_seule} empêche d'écrire jusqu'à {@code fin} (null = sans échéance).
 */
@Entity
@Table(name = "sanctions", schema = "social")
public class Sanction {

    public static final String TYPE_AVERTISSEMENT = "avertissement";
    public static final String TYPE_LECTURE_SEULE = "lecture_seule";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "compte_id", nullable = false)
    private UUID compteId;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "motif")
    private String motif;

    @Column(name = "decidee_par", nullable = false)
    private UUID decideePar;

    @Column(name = "debut", nullable = false)
    private Instant debut = Instant.now();

    @Column(name = "fin")
    private Instant fin;

    protected Sanction() {}

    public Sanction(UUID compteId, String type, String motif, UUID decideePar, Instant fin) {
        this.compteId = compteId;
        this.type = type;
        this.motif = motif;
        this.decideePar = decideePar;
        this.fin = fin;
    }

    /** Vraie si la sanction interdit d'écrire à l'instant donné. */
    public boolean interditEcriture(Instant maintenant) {
        if (!TYPE_LECTURE_SEULE.equals(type)) {
            return false;
        }
        return fin == null || maintenant.isBefore(fin);
    }

    public UUID getId() {
        return id;
    }

    public UUID getCompteId() {
        return compteId;
    }

    public String getType() {
        return type;
    }

    public String getMotif() {
        return motif;
    }

    public Instant getDebut() {
        return debut;
    }

    public Instant getFin() {
        return fin;
    }
}
