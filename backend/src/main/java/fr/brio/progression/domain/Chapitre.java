package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * progression's projection of a published chapter's structure (ADR 0022), built
 * from the {@code ChapitrePublie} event. Non-per-student: it lets progression
 * enumerate a track and know the counts that define completion ("toutes sections
 * + ≥ 80 % des exercices") without ever calling contenu.
 */
// Distinct entity name: contenu also has a Chapitre entity, and Hibernate requires
// entity names to be unique across the whole persistence unit.
@Entity(name = "ProgressionChapitre")
@Table(name = "chapitres", schema = "progression")
public class Chapitre {

    @Id
    @Column(name = "chapitre_id")
    private String chapitreId;

    @Column(name = "niveau_code", nullable = false)
    private String niveauCode;

    @Column(name = "matiere_code", nullable = false)
    private String matiereCode;

    @Column(nullable = false)
    private int ordre;

    @Column(nullable = false)
    private String statut;

    @Column(name = "total_sections", nullable = false)
    private int totalSections;

    @Column(name = "total_exercices", nullable = false)
    private int totalExercices;

    @Column(name = "maj_at", nullable = false)
    private Instant majAt;

    protected Chapitre() {}

    public Chapitre(String chapitreId) {
        this.chapitreId = chapitreId;
    }

    public void maj(String niveauCode, String matiereCode, int ordre, String statut,
                    int totalSections, int totalExercices) {
        this.niveauCode = niveauCode;
        this.matiereCode = matiereCode;
        this.ordre = ordre;
        this.statut = statut;
        this.totalSections = totalSections;
        this.totalExercices = totalExercices;
        this.majAt = Instant.now();
    }

    public String getChapitreId() { return chapitreId; }
    public String getNiveauCode() { return niveauCode; }
    public String getMatiereCode() { return matiereCode; }
    public int getOrdre() { return ordre; }
    public String getStatut() { return statut; }
    public int getTotalSections() { return totalSections; }
    public int getTotalExercices() { return totalExercices; }
}
