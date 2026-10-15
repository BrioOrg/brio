package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Un salon de classe de groupe, créé par un enseignant (F6b, ADR 0033). */
@Entity
@Table(name = "salons", schema = "social")
public class Salon {

    public static final String STATUT_OUVERT = "ouvert";
    public static final String STATUT_ARCHIVE = "archive";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "classe_id", nullable = false)
    private UUID classeId;

    @Column(name = "titre", nullable = false)
    private String titre;

    @Column(name = "cree_par", nullable = false)
    private UUID creePar;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_OUVERT;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Salon() {}

    public Salon(UUID classeId, String titre, UUID creePar) {
        this.classeId = classeId;
        this.titre = titre;
        this.creePar = creePar;
    }

    public void archiver() {
        this.statut = STATUT_ARCHIVE;
    }

    public UUID getId() {
        return id;
    }

    public UUID getClasseId() {
        return classeId;
    }

    public String getTitre() {
        return titre;
    }

    public UUID getCreePar() {
        return creePar;
    }

    public String getStatut() {
        return statut;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
