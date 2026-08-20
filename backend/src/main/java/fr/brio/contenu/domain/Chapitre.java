package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chapitres", schema = "contenu")
public class Chapitre {

    @Id
    @Column(nullable = false)
    private String id;

    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String content;

    @Column(name = "niveau_code", nullable = false)
    private String niveauCode;

    @Column(name = "matiere_code", nullable = false)
    private String matiereCode;

    @Column(nullable = false)
    private int ordre;

    @Column(nullable = false)
    private String statut;

    @Column(nullable = false)
    private String titre;

    @Column(name = "duree_estimee_minutes", nullable = false)
    private int dureeEstimeeMinutes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Chapitre() {}

    public Chapitre(String id, String content, String niveauCode, String matiereCode,
                    int ordre, String statut, String titre, int dureeEstimeeMinutes) {
        this.id = id;
        this.content = content;
        this.niveauCode = niveauCode;
        this.matiereCode = matiereCode;
        this.ordre = ordre;
        this.statut = statut;
        this.titre = titre;
        this.dureeEstimeeMinutes = dureeEstimeeMinutes;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public String getId() { return id; }
    public String getContent() { return content; }
    public String getNiveauCode() { return niveauCode; }
    public String getMatiereCode() { return matiereCode; }
    public int getOrdre() { return ordre; }
    public String getStatut() { return statut; }
    public String getTitre() { return titre; }
    public int getDureeEstimeeMinutes() { return dureeEstimeeMinutes; }
}
