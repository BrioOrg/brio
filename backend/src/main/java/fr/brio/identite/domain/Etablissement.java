package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "etablissements")
public class Etablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nom;

    private String uai;

    @Column(nullable = false)
    private String type;

    @Column(name = "convention_signee_le")
    private LocalDate conventionSigneeLe;

    @Column(name = "convention_reference")
    private String conventionReference;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Etablissement() {}

    public static Etablissement creer(String nom, String uai, String type,
                                      LocalDate conventionSigneeLe, String conventionReference) {
        var e = new Etablissement();
        e.nom = nom;
        e.uai = uai;
        e.type = type;
        e.conventionSigneeLe = conventionSigneeLe;
        e.conventionReference = conventionReference;
        return e;
    }

    /** Convention gate (ADR 0018 §3): both fields must be set for path A to be active. */
    public boolean peutUtiliserPathA() {
        return conventionSigneeLe != null
                && conventionReference != null
                && !conventionReference.isBlank();
    }

    public UUID getId() { return id; }
    public String getNom() { return nom; }
    public String getUai() { return uai; }
    public String getType() { return type; }
    public LocalDate getConventionSigneeLe() { return conventionSigneeLe; }
    public String getConventionReference() { return conventionReference; }
}
