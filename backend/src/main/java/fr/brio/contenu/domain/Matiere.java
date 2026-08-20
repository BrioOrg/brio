package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "matieres", schema = "contenu")
public class Matiere {

    @Id
    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String libelle;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Matiere() {}

    public Matiere(String code, String libelle) {
        this.code = code;
        this.libelle = libelle;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public String getCode() { return code; }
    public String getLibelle() { return libelle; }
}
