package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "exercices", schema = "contenu")
public class Exercice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "chapitre_id", nullable = false)
    private String chapitreId;

    @Column(nullable = false)
    private String slug;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String evaluation;

    @Column(columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> competencies;

    protected Exercice() {}

    public Exercice(UUID id, String chapitreId, String slug, String type, String evaluation, List<String> competencies) {
        this.id = id;
        this.chapitreId = chapitreId;
        this.slug = slug;
        this.type = type;
        this.evaluation = evaluation;
        this.competencies = competencies != null ? competencies : List.of();
    }

    public UUID getId() { return id; }
    public String getChapitreId() { return chapitreId; }
    public String getSlug() { return slug; }
    public String getType() { return type; }
    public String getEvaluation() { return evaluation; }
    public List<String> getCompetencies() { return competencies; }
}
