package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

/**
 * A teacher-authored course (ADR 0019). Metadata plus the current working draft
 * ({@code brouillonContent}); published, immutable snapshots live in {@link CoursVersion}.
 * Statut follows ADR 0019 ({@code brouillon}/{@code publie}/{@code archive}) — deliberately
 * different from {@link Chapitre}'s {@code published}/{@code draft} (V26 header).
 */
@Entity
@Table(name = "cours", schema = "contenu")
public class Cours implements Persistable<UUID> {

    public static final String STATUT_BROUILLON = "brouillon";
    public static final String STATUT_PUBLIE = "publie";
    public static final String STATUT_ARCHIVE = "archive";

    @Id
    private UUID id;

    @Transient
    private boolean isNew = true;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "etablissement_id", nullable = false)
    private UUID etablissementId;

    @Column(nullable = false)
    private String titre;

    @Column(name = "niveau_code", nullable = false)
    private String niveauCode;

    @Column(name = "matiere_code", nullable = false)
    private String matiereCode;

    @Column(nullable = false)
    private String statut;

    @Column(name = "version_publiee")
    private Integer versionPubliee;

    @Column(name = "brouillon_content", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String brouillonContent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Cours() {}

    public Cours(UUID auteurId, UUID etablissementId, String titre,
                 String niveauCode, String matiereCode, String brouillonContent) {
        this.id = UUID.randomUUID();
        this.auteurId = auteurId;
        this.etablissementId = etablissementId;
        this.titre = titre;
        this.niveauCode = niveauCode;
        this.matiereCode = matiereCode;
        this.statut = STATUT_BROUILLON;
        this.brouillonContent = brouillonContent;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    /** Overwrite the working draft (the "Enregistrer" action). */
    public void modifierBrouillon(String titre, String brouillonContent) {
        this.titre = titre;
        this.brouillonContent = brouillonContent;
        this.updatedAt = Instant.now();
    }

    /** Mark the course published at the given version (the "Publier" action). */
    public void marquerPublie(int version) {
        this.statut = STATUT_PUBLIE;
        this.versionPubliee = version;
        this.updatedAt = Instant.now();
    }

    @Override public boolean isNew() { return isNew; }
    @Override public UUID getId() { return id; }
    public UUID getAuteurId() { return auteurId; }
    public UUID getEtablissementId() { return etablissementId; }
    public String getTitre() { return titre; }
    public String getNiveauCode() { return niveauCode; }
    public String getMatiereCode() { return matiereCode; }
    public String getStatut() { return statut; }
    public Integer getVersionPubliee() { return versionPubliee; }
    public String getBrouillonContent() { return brouillonContent; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
