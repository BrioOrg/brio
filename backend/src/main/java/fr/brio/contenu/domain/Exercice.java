package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "exercices", schema = "contenu")
public class Exercice implements Persistable<UUID> {

    @Id
    private UUID id;

    // Hibernate sets this to false via @PostLoad after loading from the DB.
    // Freshly-constructed entities start as true so Spring Data calls persist()
    // (INSERT) rather than merge() (UPDATE) even though the ID is already set.
    @Transient
    private boolean isNew = true;

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

    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    @Override public boolean isNew() { return isNew; }
    @Override public UUID getId() { return id; }
    public String getChapitreId() { return chapitreId; }
    public String getSlug() { return slug; }
    public String getType() { return type; }
    public String getEvaluation() { return evaluation; }
    public List<String> getCompetencies() { return competencies; }
}
