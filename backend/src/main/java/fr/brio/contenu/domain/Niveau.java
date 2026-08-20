package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "niveaux", schema = "contenu")
public class Niveau {

    @Id
    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String libelle;

    @Column(nullable = false)
    private short ordre;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Niveau() {}

    public Niveau(String code, String libelle, short ordre) {
        this.code = code;
        this.libelle = libelle;
        this.ordre = ordre;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public String getCode() { return code; }
    public String getLibelle() { return libelle; }
    public short getOrdre() { return ordre; }
}
