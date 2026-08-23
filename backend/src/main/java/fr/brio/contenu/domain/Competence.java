package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "competences", schema = "contenu")
public class Competence implements Persistable<String> {

    @Id
    private String code;

    // Hibernate sets this to false via @PostLoad after loading from the DB.
    // Freshly-constructed entities start as true so Spring Data calls persist()
    // (INSERT) rather than merge() (UPDATE) even though the ID is already set.
    @Transient
    private boolean isNew = true;

    @Column(nullable = false)
    private String intitule;

    // short: the column is SMALLINT (V4); Hibernate schema validation rejects an int mapping.
    @Column(nullable = false)
    private short cycle;

    @Column(nullable = false, columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> niveaux;

    @Column(nullable = false)
    private String domaine;

    @Column(name = "reference_officielle", nullable = false)
    private String referenceOfficielle;

    @Column(name = "deprecated_since")
    private String deprecatedSince;

    @Column(name = "remplace_par", columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> remplacePar;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Competence() {}

    public Competence(String code, String intitule, int cycle, List<String> niveaux,
                      String domaine, String referenceOfficielle) {
        this.code = code;
        this.createdAt = Instant.now();
        update(intitule, cycle, niveaux, domaine, referenceOfficielle, null, null);
    }

    /** Codes are immutable (ADR 0009); everything else follows the referential file. */
    public void update(String intitule, int cycle, List<String> niveaux,
                       String domaine, String referenceOfficielle,
                       String deprecatedSince, List<String> remplacePar) {
        this.intitule = intitule;
        this.cycle = (short) cycle;
        this.niveaux = niveaux;
        this.domaine = domaine;
        this.referenceOfficielle = referenceOfficielle;
        this.deprecatedSince = deprecatedSince;
        this.remplacePar = remplacePar;
        this.updatedAt = Instant.now();
    }

    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    @Override public boolean isNew() { return isNew; }
    @Override public String getId() { return code; }
    public String getCode() { return code; }
    public String getIntitule() { return intitule; }
    public int getCycle() { return cycle; }
    public List<String> getNiveaux() { return niveaux; }
    public String getDomaine() { return domaine; }
    public String getReferenceOfficielle() { return referenceOfficielle; }
    public String getDeprecatedSince() { return deprecatedSince; }
    public List<String> getRemplacePar() { return remplacePar; }
    public boolean isDeprecated() { return deprecatedSince != null; }
}
